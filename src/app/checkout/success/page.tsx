import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export const metadata: Metadata = {
  title: "Compra completada",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  // We don't query Stripe here. The webhook is the source of truth for
  // provisioning (User + Order + Enrollment). This page is purely
  // informational so the buyer sees confirmation immediately after Stripe
  // bounces them back. If the webhook hasn't fired yet (rare), the email
  // arrives within seconds anyway.
  const { session_id } = await searchParams;

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
            <p className="text-neutral-700 leading-relaxed">
              Te hemos enviado un email con instrucciones para acceder al curso.
              Revísalo (también la carpeta de spam, por si acaso).
            </p>
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
                con el email que has usado al pagar.
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
