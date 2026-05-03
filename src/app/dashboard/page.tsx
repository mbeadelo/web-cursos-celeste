import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = { title: "Mis cursos" };

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="flex-1 px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mis cursos</h1>
            <p className="text-sm text-neutral-600">
              {session.user.email}
              {session.user.role === "ADMIN" && (
                <>
                  {" · "}
                  <Link href="/admin" className="underline">
                    Panel de administración
                  </Link>
                </>
              )}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">Aún no tienes cursos.</p>
          <p className="text-sm text-neutral-500 mt-2">
            Cuando compres uno, aparecerá aquí.
          </p>
        </section>
      </div>
    </main>
  );
}
