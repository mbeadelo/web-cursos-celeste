import Link from "next/link";
import { auth } from "@/lib/auth";

export async function PublicHeader() {
  const session = await auth();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-icon.png"
            alt=""
            aria-hidden
            className="h-9 w-auto"
          />
          <span className="leading-none">
            <span className="text-brand-celeste-deep">Bienvenido a tu </span>
            <span className="text-brand-amber-deep">plaza</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/cursos"
            className="text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            Cursos
          </Link>
          <Link
            href="/articulos"
            className="text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            Blog
          </Link>
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-4 py-2 font-medium hover:bg-brand-celeste-deep transition"
            >
              Mis cursos
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-4 py-2 font-medium hover:bg-brand-celeste-deep transition"
            >
              Acceder
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
