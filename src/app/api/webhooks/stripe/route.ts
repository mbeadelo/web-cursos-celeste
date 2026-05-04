import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { sendPurchaseWelcomeEmail } from "@/lib/email";

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
        await handleCheckoutCompleted(event.data.object);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      default:
        // Unhandled types: still 200 so Stripe doesn't retry.
        // The StripeEvent row records that we saw it.
        break;
    }
  } catch (err) {
    // If processing fails after the idempotency row was inserted, the
    // StripeEvent row blocks future retries. We log loudly so operations can
    // notice and fix manually. Throwing here would 500 → Stripe retries →
    // hits the idempotency conflict → silent skip. So: never throw.
    console.error(`[stripe webhook] error handling ${event.type}:`, err);
    // Optional: delete the StripeEvent row to allow manual retry. We don't
    // do that automatically because most failures are transient (DB blip)
    // and the next manual replay should work via Stripe Dashboard.
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const courseId = session.metadata?.courseId;
  if (!courseId) {
    console.error("[stripe webhook] checkout.session.completed without courseId metadata", session.id);
    return;
  }

  const email = session.customer_details?.email?.toLowerCase();
  if (!email) {
    console.error("[stripe webhook] checkout.session.completed without email", session.id);
    return;
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) {
    console.error("[stripe webhook] course not found:", courseId);
    return;
  }

  // Upsert User. This bypasses the locked Auth.js adapter on purpose — Stripe
  // is a sanctioned provisioning path. See docs/fases/fase-1-auth.md.
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
      : session.payment_intent?.id ?? null;

  // Order is the durable record of the transaction. Created idempotently:
  // upserts by stripeSessionId so a re-delivered event doesn't dupe.
  await db.order.upsert({
    where: { stripeSessionId: session.id },
    create: {
      userId: user.id,
      courseId: course.id,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      status: "PAID",
      amountCents: session.amount_total ?? 0,
      currency: session.currency ?? "eur",
    },
    update: {
      stripePaymentIntentId: paymentIntentId,
      status: "PAID",
      amountCents: session.amount_total ?? 0,
    },
  });

  // Enrollment: upsert by composite unique [userId, courseId]. If the admin
  // already enrolled them manually, this is a no-op and we keep MANUAL —
  // we don't want to overwrite the existing source.
  await db.enrollment.upsert({
    where: {
      userId_courseId: { userId: user.id, courseId: course.id },
    },
    create: {
      userId: user.id,
      courseId: course.id,
      source: "PURCHASE",
    },
    update: {},
  });

  // Welcome email. Best-effort — failure here doesn't roll back the
  // enrollment. The user can still log in via /login if the email never
  // arrives.
  try {
    await sendPurchaseWelcomeEmail({
      to: email,
      courseTitle: course.title,
      isNewUser,
    });
  } catch (err) {
    console.error("[stripe webhook] welcome email failed:", err);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  if (!paymentIntentId) {
    console.error("[stripe webhook] charge.refunded without payment_intent");
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

function isUniqueConstraint(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string };
  return e.code === "P2002";
}
