import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

/**
 * POST /api/billing-portal
 *
 * Redirects the logged-in student to their Stripe Billing Portal session,
 * where they can update the card or cancel the subscription themselves.
 * Requires the portal configuration to be saved once in the Stripe dashboard
 * (Settings → Billing → Customer portal).
 */
export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(`${SITE_URL}/login`, 303);
  }
  if (!isStripeConfigured()) {
    return new Response("Stripe no está configurado en este entorno.", {
      status: 400,
    });
  }

  // El customer más reciente del alumno. Con un solo producto por suscripción
  // todos sus rows comparten customer en la práctica.
  const sub = await db.subscription.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { stripeCustomerId: true },
  });
  if (!sub) {
    return NextResponse.redirect(`${SITE_URL}/dashboard`, 303);
  }

  const stripe = requireStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${SITE_URL}/dashboard`,
    locale: "es",
  });

  return NextResponse.redirect(portal.url, 303);
}
