import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { checkoutIpLimiter, getClientIp } from "@/lib/rate-limit";
import { reportOps, shortErrorMessage } from "@/lib/ops";

export const runtime = "nodejs";

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

// stripe v22 no reexporta Checkout.SessionCreateParams en el namespace
// agregado; derivamos el tipo de line item de la firma del método.
type CheckoutCreateParams = NonNullable<
  Parameters<Stripe["checkout"]["sessions"]["create"]>[0]
>;
type CheckoutLineItem = NonNullable<CheckoutCreateParams["line_items"]>[number];

/**
 * POST /api/checkout
 * Body (form-urlencoded): courseId=<cuid>
 *
 * Creates a Stripe Checkout Session for the given course and 303-redirects
 * the browser to Stripe's hosted page. No login required — Stripe collects
 * the email and the webhook provisions the User after payment.
 *
 * Observabilidad propia: cada pulsación de "Comprar" deja una fila en
 * `CheckoutAttempt` (CREATED con el id de sesión, o FAILED con el error) y
 * cualquier excepción se registra con `reportOps` (email al admin) y devuelve
 * al alumno a la landing con `?pago=error` en vez de un 500 mudo. Esto es lo
 * que faltó el 21-oct-2026, cuando un alumno no pudo pagar y solo nos
 * enteramos por un email de Sentry sin contexto.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    await reportOps({
      level: "ERROR",
      area: "checkout",
      message: "Alguien pulsó Comprar pero Stripe no está configurado en este entorno",
    });
    return badRequest("Stripe no está configurado en este entorno.");
  }

  const ip = getClientIp(req.headers);
  const rl = await checkoutIpLimiter.limit(ip);
  if (!rl.success) {
    return new Response("Demasiadas peticiones. Espera un momento.", {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": String(Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))),
      },
    });
  }

  let courseId: string | null = null;
  try {
    const form = await req.formData();
    const raw = form.get("courseId");
    courseId = typeof raw === "string" && raw.length > 0 ? raw : null;
  } catch {
    courseId = null;
  }
  if (!courseId) {
    return badRequest("Falta courseId.");
  }

  let course: CourseForCheckout | null = null;
  try {
    course = await db.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        priceCents: true,
        currency: true,
        published: true,
        coverUrl: true,
        billing: true,
        enrollmentFeeCents: true,
      },
    });
  } catch (err) {
    // La DB no responde: no podemos ni registrar el intento, pero el email
    // de alerta no depende de la DB.
    await reportOps({
      level: "ERROR",
      area: "checkout",
      message: "No se pudo leer el curso de la base de datos al iniciar el pago",
      error: err,
      detail: { courseId, ip },
    });
    return NextResponse.redirect(`${SITE_URL}/cursos?pago=error`, 303);
  }
  if (!course) return badRequest("Curso no encontrado.");
  if (!course.published) return badRequest("Curso no disponible.");

  let userEmail: string | null = null;
  try {
    // If the user is already logged in and already enrolled, send them to the
    // course directly instead of charging again.
    const session = await auth();
    if (session) {
      userEmail = session.user.email ?? null;
      const existing = await db.enrollment.findUnique({
        where: {
          userId_courseId: { userId: session.user.id, courseId: course.id },
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.redirect(
          `${SITE_URL}/dashboard/cursos/${course.slug}`,
          303
        );
      }
    }

    const checkout = await createCheckoutSession(course, userEmail);

    if (!checkout.url) {
      throw new Error("Stripe devolvió una sesión sin URL");
    }

    await db.checkoutAttempt
      .create({
        data: {
          courseId: course.id,
          email: userEmail,
          ip,
          stripeSessionId: checkout.id,
          status: "CREATED",
        },
      })
      .catch((err) =>
        console.error("[checkout] no se pudo registrar el intento:", err)
      );

    return NextResponse.redirect(checkout.url, 303);
  } catch (err) {
    await db.checkoutAttempt
      .create({
        data: {
          courseId: course.id,
          email: userEmail,
          ip,
          status: "FAILED",
          error: shortErrorMessage(err),
        },
      })
      .catch((e) =>
        console.error("[checkout] no se pudo registrar el intento fallido:", e)
      );

    await reportOps({
      level: "ERROR",
      area: "checkout",
      message: `No se pudo iniciar el pago del curso "${course.slug}"`,
      error: err,
      detail: {
        courseId: course.id,
        billing: course.billing,
        priceCents: course.priceCents,
        enrollmentFeeCents: course.enrollmentFeeCents,
        userEmail,
        ip,
      },
    });

    return NextResponse.redirect(
      `${SITE_URL}/cursos/${course.slug}?pago=error`,
      303
    );
  }
}

type CourseForCheckout = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  published: boolean;
  coverUrl: string | null;
  billing: "ONE_TIME" | "SUBSCRIPTION";
  enrollmentFeeCents: number | null;
};

async function createCheckoutSession(
  course: CourseForCheckout,
  userEmail: string | null
) {
  const stripe = requireStripe();

  const isSubscription = course.billing === "SUBSCRIPTION";
  const currency = course.currency.toLowerCase();
  // Stripe rechaza strings vacíos en product_data.description ("cannot be
  // unset"); un curso sin descripción no debe tumbar el checkout.
  const description = course.description.trim().slice(0, 500) || undefined;

  // El precio guardado (priceCents) es el que paga el alumno: IVA incluido.
  // "inclusive" hace que Stripe Tax desglose el IVA de ese total en vez de
  // sumarlo encima (que sería "exclusive").
  const lineItems: CheckoutLineItem[] = isSubscription
    ? [
        // Cuota mensual recurrente…
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: course.priceCents,
            tax_behavior: "inclusive",
            recurring: { interval: "month" },
            product_data: {
              name: `${course.title} — cuota mensual`,
              description,
              images: course.coverUrl ? [course.coverUrl] : undefined,
            },
          },
        },
        // …más la matrícula/material, cargo único que Stripe añade solo a la
        // primera factura (los one-time items en mode=subscription no se
        // repiten en las renovaciones).
        ...(course.enrollmentFeeCents && course.enrollmentFeeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency,
                  unit_amount: course.enrollmentFeeCents,
                  tax_behavior: "inclusive" as const,
                  product_data: {
                    name: `${course.title} — matrícula y material inicial`,
                  },
                },
              },
            ]
          : []),
      ]
    : [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: course.priceCents,
            tax_behavior: "inclusive",
            product_data: {
              name: course.title,
              description,
              images: course.coverUrl ? [course.coverUrl] : undefined,
            },
          },
        },
      ];

  return stripe.checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    metadata: { courseId: course.id },
    // También en la suscripción de Stripe, para que los eventos
    // customer.subscription.* puedan mapearse al curso sin lookups extra.
    ...(isSubscription
      ? { subscription_data: { metadata: { courseId: course.id } } }
      : {}),
    // Pre-fill customer email if logged in. Otherwise Stripe asks for it.
    customer_email: userEmail ?? undefined,
    // Stripe Tax: requires Tax registration set up in the Stripe dashboard.
    automatic_tax: { enabled: true },
    // Allow promo codes (admin can create them in Stripe dashboard later).
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/cursos/${course.slug}`,
    locale: "es",
  });
}

function badRequest(message: string) {
  return new Response(message, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
