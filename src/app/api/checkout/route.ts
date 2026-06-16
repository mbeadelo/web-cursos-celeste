import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { checkoutIpLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SITE_URL =
  env.AUTH_URL?.replace(/\/$/, "") ?? "https://bienvenidoatuplaza.com";

/**
 * POST /api/checkout
 * Body (form-urlencoded): courseId=<cuid>
 *
 * Creates a Stripe Checkout Session for the given course and 303-redirects
 * the browser to Stripe's hosted page. No login required — Stripe collects
 * the email and the webhook provisions the User after payment.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
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

  const form = await req.formData();
  const courseId = form.get("courseId");
  if (typeof courseId !== "string" || courseId.length === 0) {
    return badRequest("Falta courseId.");
  }

  const course = await db.course.findUnique({
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
    },
  });
  if (!course) return badRequest("Curso no encontrado.");
  if (!course.published) return badRequest("Curso no disponible.");

  // If the user is already logged in and already enrolled, send them to the
  // course directly instead of charging again.
  const session = await auth();
  if (session) {
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

  const stripe = requireStripe();

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: course.currency.toLowerCase(),
          unit_amount: course.priceCents,
          // El precio guardado (priceCents) es el que paga el alumno: IVA
          // incluido. "inclusive" hace que Stripe Tax desglose el IVA de ese
          // total en vez de sumarlo encima (que sería "exclusive").
          tax_behavior: "inclusive",
          product_data: {
            name: course.title,
            description: course.description.slice(0, 500),
            images: course.coverUrl ? [course.coverUrl] : undefined,
          },
        },
      },
    ],
    metadata: { courseId: course.id },
    // Pre-fill customer email if logged in. Otherwise Stripe asks for it.
    customer_email: session?.user.email ?? undefined,
    // Stripe Tax: requires Tax registration set up in the Stripe dashboard.
    // Falls back to no-tax automatically if not enabled in the account.
    automatic_tax: { enabled: true },
    // Allow promo codes (admin can create them in Stripe dashboard later).
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/cursos/${course.slug}`,
    locale: "es",
  });

  if (!checkout.url) {
    return badRequest("No se pudo iniciar el checkout.");
  }

  return NextResponse.redirect(checkout.url, 303);
}

function badRequest(message: string) {
  return new Response(message, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
