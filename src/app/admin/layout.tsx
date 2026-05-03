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
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/admin" className="text-sm font-semibold">
            Admin · Bienvenido a tu plaza
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">
              Inicio
            </Link>
            <Link href="/admin/courses" className="text-neutral-600 hover:text-neutral-900">
              Cursos
            </Link>
            <Link href="/dashboard" className="text-neutral-600 hover:text-neutral-900">
              Salir del admin
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
