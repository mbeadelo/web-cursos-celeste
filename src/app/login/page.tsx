import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Acceder" };

async function loginAction(formData: FormData) {
  "use server";
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    redirect("/login?error=invalid-email");
  }
  await signIn("resend", {
    email,
    redirectTo: "/dashboard",
  });
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
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {error === "invalid-email" && (
            <p className="text-sm text-red-600">Introduce un email válido.</p>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-700 transition"
          >
            Enviar enlace
          </button>
        </form>
      </div>
    </main>
  );
}
