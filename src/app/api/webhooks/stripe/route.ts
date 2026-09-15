import { NextResponse } from "next/server";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  provisionCheckoutSession,
  mapSubscriptionStatus,
  subscriptionPeriodEnd,
  isUniqueConstraint,
} from "@/lib/stripe-provision";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 *
 * Receives signed events from Stripe. Mandatory checks:
 *
 *   1. Verify signature with STRIPE_WEBHOOK_SECRET against the RAW body.
 *   2. Idempotency: insert event.id into `StripeEvent`. If it already exists,
 *      Stripe is redelivering — return 200 without re-processing.
 *
 * Skipping step 2 leads to duplicate enrollments. Stripe retries aggressively
 * on any non-2xx, including transient timeouts.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return new Response("Stripe no configurado", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  // Read raw body for signature verification — must NOT parse as JSON first.
  const rawBody = await req.text();

  const stripe = requireStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid signature";
    return new Response(`Webhook signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  // ── Idempotency guard ──────────────────────────────────────────
  // Insert the event id; if it conflicts, Stripe is redelivering and we've
  // already processed this event. Bail with 200 to stop retries.
  try {
    await db.stripeEvent.create({
      data: { id: event.id, type: event.type },
    });
  } catch (err: unknown) {
    if (isUniqueConstraint(err)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  // ── Event dispatch ─────────────────────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
      // Pago asíncrono confirmado después (SEPA, etc.): misma provisión.
      case "checkout.session.async_payment_succeeded":
        await provisionCheckoutSession(event.data.object, { source: "webhook" });
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      // Ciclo de vida de suscripciones (preparación mensual). `updated` cubre
      // renovaciones (cambia current_period_end), impagos (past_due) y la
      // cancelación programada desde el portal; `deleted` es la cancelación
      // efectiva → retirar acceso.
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(event.data.object);
        break;
      default:
        // Unhandled types: still 200 so Stripe doesn't retry.
        // The StripeEvent row records that we saw it.
        break;
    }
  } catch (err) {
    // The handler failed AFTER the idempotency row was written. If we left the
    // row and returned 200, Stripe would never retry → a transient DB blip
    // would permanently lose the enrollment (customer paid, no access). So we
    // roll back the idempotency row and return 500 to let Stripe retry. Every
    // handler write is an idempotent upsert (keyed by session/payment_intent),
    // so re-processing the same event is safe. Permanent failures (no course,
    // no email) early-return without throwing, so they don't reach here and
    // won't loop.
    console.error(`[stripe webhook] error handling ${event.type}:`, err);
    Sentry.captureException(err, {
      tags: { area: "stripe-webhook", eventType: event.type },
      extra: { eventId: event.id },
    });
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {
      // Even the rollback failed → the row stays and will block retries. Log
      // so it can be replayed manually from the Stripe Dashboard.
      console.error(
        `[stripe webhook] could not roll back StripeEvent ${event.id}`
      );
      Sentry.captureMessage(
        `[stripe webhook] StripeEvent ${event.id} (${event.type}) huérfano: bloqueará reintentos, reenviar a mano desde Stripe`,
        { level: "fatal" }
      );
    });
    return new Response("Webhook handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// La provisión de checkout (User + Order + Enrollment + Subscription) vive en
// src/lib/stripe-provision.ts: la comparte con /checkout/success, que la
// ejecuta también por si este webhook no llega.

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.error("[stripe webhook] charge.refunded without payment_intent");
    return;
  }

  // Stripe emits `charge.refunded` on PARTIAL refunds too (e.g. a goodwill
  // 5 € back on a 100 € course). Only revoke access on a FULL refund —
  // `charge.refunded` is true solely when the whole charge has been returned;
  // we also compare amounts as a belt-and-suspenders check. A partial refund
  // must not strip the course the student largely paid for.
  const fullyRefunded =
    charge.refunded === true || charge.amount_refunded >= charge.amount;
  if (!fullyRefunded) {
    console.warn(
      `[stripe webhook] partial refund on ${paymentIntentId} ` +
        `(${charge.amount_refunded}/${charge.amount}) — access kept`
    );
    return;
  }

  const order = await db.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, userId: true, courseId: true },
  });
  if (!order) {
    console.error(
      "[stripe webhook] order not found for refund:",
      paymentIntentId
    );
    return;
  }

  // Mark order as refunded and revoke access. We don't touch the User row —
  // the alumno keeps their account in case they buy again later.
  await db.order.update({
    where: { id: order.id },
    data: { status: "REFUNDED" },
  });
  try {
    await db.enrollment.delete({
      where: {
        userId_courseId: { userId: order.userId, courseId: order.courseId },
      },
    });
  } catch {
    // Already removed (admin revoked, or duplicate refund event) → no-op.
  }
}

async function handleSubscriptionChanged(sub: Stripe.Subscription) {
  const row = await db.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true, userId: true, courseId: true },
  });
  if (!row) {
    // Puede llegar un `updated` de la creación antes de que nuestro handler de
    // checkout.session.completed haya insertado la fila (Stripe no garantiza
    // orden). Inofensivo: ese handler guarda el estado fresco al procesar.
    console.warn(
      `[stripe webhook] subscription ${sub.id} sin fila local — ignorado`
    );
    return;
  }

  const status = mapSubscriptionStatus(sub.status);
  await db.subscription.update({
    where: { id: row.id },
    data: {
      status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: subscriptionPeriodEnd(sub),
    },
  });

  if (status === "CANCELED") {
    // Modelo acordado: al cancelar (o agotar los reintentos de impago) se
    // pierde TODO el acceso, material inicial incluido.
    try {
      await db.enrollment.delete({
        where: {
          userId_courseId: { userId: row.userId, courseId: row.courseId },
        },
      });
    } catch {
      // Ya no existía (admin la quitó, evento duplicado) → no-op.
    }
  } else {
    // ACTIVE o PAST_DUE (acceso se mantiene mientras Stripe reintenta el
    // cobro). El upsert re-otorga acceso si un impago recuperado u otro flujo
    // lo hubiera retirado.
    await db.enrollment.upsert({
      where: {
        userId_courseId: { userId: row.userId, courseId: row.courseId },
      },
      create: { userId: row.userId, courseId: row.courseId, source: "PURCHASE" },
      update: {},
    });
  }
}

