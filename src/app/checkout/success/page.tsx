import type { Metadata } from "next";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { isStripeConfigured, requireStripe } from "@/lib/stripe";
import { provisionCheckoutSession } from "@/lib/stripe-provision";

export const metadata: Metadata = {
  title: "Compra completada",
  robots: { index: false, follow: false },
};

type AccessState =
  /** Provisionado (por el webhook o por esta misma carga): puede entrar ya. */
  | { kind: "ready"; email: string }
  /** Stripe aún no da la sesión por completada/pagada (pago asíncrono). */
  | { kind: "pending" }
  /** Sin session_id válido o Stripe no respondió: mensaje genérico. */
  | { kind: "unknown" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  // Segunda vía de provisión, además del webhook. Si el evento de Stripe no
  // llegó (o aún no ha llegado), esta carga recupera la sesión por su id y
  // provisiona igual: el alumno que ha pagado nunca se queda sin cuenta. Es
  // idempotente: si el webhook ya pasó, no hace nada. El session_id no es
  // adivinable y la provisión usa el email que Stripe tiene en la sesión, así
  // que no otorga nada a quien lo trae.
  const state = await resolveAccess(session_id);

  return (
    <>
      <PublicHeader />
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-xl w-full py-16 space-y-8 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-gradient-to-br from-brand-celeste to-brand-magenta mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              ¡Compra completada!
            </h1>
            {state.kind === "ready" ? (
              <p className="text-neutral-700 leading-relaxed">
                Tu acceso ya está activo para{" "}
                <span className="font-medium">{state.email}</span>. Te hemos
                enviado un email con el enlace de entrada (revisa también la
                carpeta de spam).
              </p>
            ) : state.kind === "pending" ? (
              <p className="text-neutral-700 leading-relaxed">
                Estamos confirmando el pago con Stripe. En cuanto se confirme
                recibirás un email con el acceso; suele tardar unos minutos.
              </p>
            ) : (
              <p className="text-neutral-700 leading-relaxed">
                Te hemos enviado un email con instrucciones para acceder al
                curso. Revísalo (también la carpeta de spam, por si acaso).
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-left space-y-3">
            <p className="text-sm font-semibold text-neutral-900">Cómo acceder:</p>
            <ol className="text-sm text-neutral-700 leading-relaxed space-y-2 list-decimal list-inside">
              <li>
                Entra en{" "}
                <Link
                  href="/login"
                  className="text-brand-celeste-deep underline hover:text-brand-magenta"
                >
                  /login
                </Link>{" "}
                con el email que has usado al pagar
                {state.kind === "ready" ? (
                  <>
                    {" "}
                    (<span className="font-medium">{state.email}</span>)
                  </>
                ) : null}
                .
              </li>
              <li>Te llegará un enlace de un solo uso para entrar.</li>
              <li>
                Tu curso aparecerá en{" "}
                <span className="font-medium">Mis cursos</span>.
              </li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/login"
              className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-6 py-3 font-medium hover:bg-brand-celeste-deep transition"
            >
              Acceder ahora
            </Link>
            <Link
              href="/cursos"
              className="rounded-full border border-neutral-300 px-6 py-3 font-medium hover:border-brand-celeste hover:text-brand-celeste-deep transition"
            >
              Ver más cursos
            </Link>
          </div>

          {session_id && (
            <p className="text-xs text-neutral-400 pt-4">
              Referencia: {session_id.slice(0, 12)}…
            </p>
          )}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}

async function resolveAccess(sessionId: string | undefined): Promise<AccessState> {
  if (!sessionId || !/^cs_(live|test)_[A-Za-z0-9]{10,}$/.test(sessionId)) {
    return { kind: "unknown" };
  }
  if (!isStripeConfigured()) return { kind: "unknown" };

  try {
    const stripe = requireStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete" || session.payment_status === "unpaid") {
      return { kind: "pending" };
    }
    const r = await provisionCheckoutSession(session, { source: "success-page" });
    if (r.outcome === "skipped") return { kind: "pending" };
    return { kind: "ready", email: r.email };
  } catch (err) {
    // No romper la página de confirmación por un fallo de Stripe/DB: el
    // webhook sigue siendo la otra vía. Pero que quede registrado.
    console.error("[checkout success] no se pudo resolver la sesión:", err);
    Sentry.captureException(err, {
      tags: { area: "checkout-success" },
      extra: { sessionId },
    });
    return { kind: "unknown" };
  }
}
