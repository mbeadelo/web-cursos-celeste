import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-8 py-24">
        <h1 className="text-5xl font-bold tracking-tight">Bienvenido a tu plaza</h1>
        <p className="text-xl text-neutral-600 leading-relaxed">
          Cursos online sobre lo tuyo. Aprende a tu ritmo.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-neutral-900 text-white px-6 py-3 font-medium hover:bg-neutral-700 transition"
            >
              Ir a mis cursos
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-neutral-900 text-white px-6 py-3 font-medium hover:bg-neutral-700 transition"
            >
              Acceder
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
