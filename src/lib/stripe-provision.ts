import "server-only";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { requireStripe } from "@/lib/stripe";
import { sendPurchaseWelcomeEmail } from "@/lib/email";

/**
 * Provisión de una compra: User + Order + Enrollment (+ Subscription).
 *
 * Vive fuera del webhook a propósito. El webhook `checkout.session.completed`
 * es el camino rápido, pero si se pierde (URL mal apuntada como en jul-2026,
 * Stripe agota reintentos a los 3 días, fila StripeEvent huérfana...) el
 * alumno ha pagado y no tiene cuenta ni acceso, y nada lo reparaba. Ahora la
 * página `/checkout/success` recupera la sesión por `session_id` y llama a
 * esto mismo: si el webhook ya pasó, no hace nada; si no, provisiona.
 *
 * Idempotente: `Order` se crea con `create` y un P2002 (ya existía) marca la
 * compra como ya provisionada. Aun así se repiten los upserts de Enrollment y
 * Subscription para curar una provisión a medias. El email de bienvenida solo
 * sale la primera vez.
 */
export type ProvisionResult =
  | { outcome: "provisioned"; email: string }
  | { outcome: "already"; email: string }
  | { outcome: "skipped"; reason: string };

export async function provisionCheckoutSession(
  session: Stripe.Checkout.Session,
  opts: { source: "webhook" | "success-page" }
): Promise<ProvisionResult> {
  const tag = `[stripe provision:${opts.source}]`;

  // Pagos asíncronos (SEPA, transferencia) llegan `unpaid` y se confirman en
  // `checkout.session.async_payment_succeeded`. Hoy solo hay tarjeta, pero
  // esta línea cierra la puerta a matricular sin cobrar si algún día se abre.
  if (session.payment_status === "unpaid") {
    return { outcome: "skipped", reason: "payment_status=unpaid" };
  }

  const courseId = session.metadata?.courseId;
  if (!courseId) {
    Sentry.captureMessage(`${tag} sesión sin courseId en metadata`, {
      level: "error",
      extra: { sessionId: session.id },
    });
    return { outcome: "skipped", reason: "sin courseId" };
  }

  const email = session.customer_details?.email?.toLowerCase();
  if (!email) {
    Sentry.captureMessage(`${tag} sesión sin email`, {
      level: "error",
      extra: { sessionId: session.id, courseId },
    });
    return { outcome: "skipped", reason: "sin email" };
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) {
    Sentry.captureMessage(`${tag} curso no encontrado`, {
      level: "error",
      extra: { sessionId: session.id, courseId, email },
    });
    return { outcome: "skipped", reason: "curso no encontrado" };
  }

  // Upsert User. Salta el adapter bloqueado de Auth.js a propósito: Stripe es
  // una vía de alta sancionada. Ver docs/fases/fase-1-auth.md.
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const user = existingUser
    ? existingUser
    : await db.user.create({ data: { email }, select: { id: true } });
  const isNewUser = !existingUser;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Order: registro durable de la transacción. `create` + P2002 = ya existía,
  // que es la señal atómica de "ya provisionado" (evita dos emails si webhook
  // y página de éxito corren a la vez).
  let alreadyProvisioned = false;
  try {
    await db.order.create({
      data: {
        userId: user.id,
        courseId: course.id,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        status: "PAID",
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "eur",
      },
    });
  } catch (err) {
    if (!isUniqueConstraint(err)) throw err;
    alreadyProvisioned = true;
    await db.order.update({
      where: { stripeSessionId: session.id },
      data: {
        stripePaymentIntentId: paymentIntentId,
        status: "PAID",
        amountCents: session.amount_total ?? 0,
      },
    });
  }

  // Enrollment por [userId, courseId]. Si el admin ya la dio a mano queda
  // MANUAL: no pisamos el source.
  await db.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    create: { userId: user.id, courseId: course.id, source: "PURCHASE" },
    update: {},
  });

  // Suscripción (preparación mensual): reflejar el estado de Stripe para el
  // portal y los eventos de ciclo de vida.
  if (session.mode === "subscription" && session.subscription) {
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const stripe = requireStripe();
    const sub = await stripe.subscriptions.retrieve(subId);
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const data = {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status: mapSubscriptionStatus(sub.status),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
    };
    await db.subscription.upsert({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
      create: { userId: user.id, courseId: course.id, ...data },
      update: data,
    });
  }

  if (alreadyProvisioned) {
    return { outcome: "already", email };
  }

  console.log(`${tag} provisionado ${email} → ${course.title} (${session.id})`);

  // Email de bienvenida, best-effort: un fallo aquí no deshace el acceso; el
  // alumno puede entrar por /login igualmente.
  try {
    await sendPurchaseWelcomeEmail({
      to: email,
      courseTitle: course.title,
      isNewUser,
    });
  } catch (err) {
    console.error(`${tag} welcome email failed:`, err);
    Sentry.captureException(err, {
      extra: { sessionId: session.id, email, stage: "welcome-email" },
    });
  }

  return { outcome: "provisioned", email };
}

export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    default:
      // canceled, incomplete, incomplete_expired, paused
      return "CANCELED";
  }
}

/**
 * Fin del periodo pagado. Desde la API "Basil" (2025-03) current_period_end
 * vive en cada subscription item, no en la suscripción; con un solo item
 * (nuestro caso) el primero es el ciclo de la cuota.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const ts = sub.items?.data?.[0]?.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

export function isUniqueConstraint(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string };
  return e.code === "P2002";
}
