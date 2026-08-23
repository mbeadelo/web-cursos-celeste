import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { checkoutIpLimiter, getClientIp } from "@/lib/rate-limit";

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
      billing: true,
      enrollmentFeeCents: true,
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

  const isSubscription = course.billing === "SUBSCRIPTION";
  const currency = course.currency.toLowerCase();

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
              description: course.description.slice(0, 500),
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
              description: course.description.slice(0, 500),
              images: course.coverUrl ? [course.coverUrl] : undefined,
            },
          },
        },
      ];

  const checkout = await stripe.checkout.sessions.create({
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
