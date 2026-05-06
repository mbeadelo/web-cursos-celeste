import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  loginEmailLimiter,
  loginIpLimiter,
  getClientIp,
} from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Acceder" };

async function loginAction(formData: FormData) {
  "use server";
  const raw = formData.get("email");
  if (typeof raw !== "string" || !raw.includes("@")) {
    redirect("/login?error=invalid-email");
  }
  const email = raw.trim().toLowerCase();

  // Rate limit: per-IP first (broader axis), then per-email. We always burn a
  // token from each so concurrent flooders from the same IP also exhaust the
  // per-email limit when iterating different addresses.
  const ip = getClientIp(await headers());
  const [byIp, byEmail] = await Promise.all([
    loginIpLimiter.limit(ip),
    loginEmailLimiter.limit(email),
  ]);
  if (!byIp.success || !byEmail.success) {
    redirect("/login?error=rate-limited");
  }

  // Closed registration: only emails already in the User table can sign in.
  // The admin email is always allowed as a recovery path in case the DB is wiped.
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!existing && email !== env.ADMIN_EMAIL.toLowerCase()) {
    redirect("/login?error=not-registered");
  }

  await signIn("resend", { email, redirectTo: "/dashboard" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 py-16">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Acceder</h1>
          <p className="text-sm text-neutral-600">
            Te enviamos un enlace por email. Sin contraseñas.
          </p>
        </div>

        <form action={loginAction} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@email.com"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-celeste"
            />
          </div>

          {error === "invalid-email" && (
            <p className="text-sm text-red-600">Introduce un email válido.</p>
          )}
          {error === "not-registered" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-1">
              <p className="text-sm font-medium text-amber-900">
                Este email no está registrado.
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">
                Solo pueden entrar alumnos con un curso comprado. Si ya has
                comprado, revisa que el email es el mismo que usaste en el pago.
              </p>
            </div>
          )}
          {error === "rate-limited" && (
            <p className="text-sm text-red-600">
              Demasiados intentos. Espera unos minutos y vuelve a probar.
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-brand-celeste text-brand-celeste-foreground py-2 text-sm font-medium hover:bg-brand-celeste-deep transition"
          >
            Enviar enlace
          </button>
        </form>

        <p className="text-xs text-center text-neutral-500">
          ¿Aún no eres alumno?{" "}
          <Link href="/cursos" className="underline hover:text-neutral-900">
            Ver cursos disponibles
          </Link>
        </p>
      </div>
    </main>
  );
}
