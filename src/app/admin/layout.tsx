import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "Admin · %s" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth — middleware already gates this, but we re-check
  // server-side in case a request bypasses middleware.
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex flex-col flex-1">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <Link
            href="/admin"
            className="text-sm font-semibold flex items-center gap-2 shrink-0"
          >
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full bg-gradient-to-br from-brand-celeste to-brand-magenta"
            />
            Admin · Bienvenido a tu plaza
          </Link>
          <nav className="flex gap-4 text-sm flex-wrap justify-end">
            <Link
              href="/admin"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Inicio
            </Link>
            <Link
              href="/admin/courses"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Cursos
            </Link>
            <Link
              href="/admin/enrollments"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Alumnos
            </Link>
            <Link
              href="/admin/articulos"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Artículos
            </Link>
            <Link
              href="/admin/reviews"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Reseñas
            </Link>
            <Link
              href="/admin/contenido"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Contenido
            </Link>
            <Link
              href="/admin/legal"
              className="text-neutral-600 hover:text-brand-celeste-deep transition"
            >
              Legal
            </Link>
            <Link
              href="/dashboard"
              className="text-neutral-500 hover:text-neutral-900 transition"
            >
              Salir del admin
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
