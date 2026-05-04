import Link from "next/link";
import { LEGAL_SLUGS, LEGAL_LABELS } from "@/lib/legal";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full bg-brand-celeste"
            />
            Bienvenido a tu plaza
          </Link>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Cursos online sobre lo tuyo. Aprende a tu ritmo, con material que
            se queda contigo.
          </p>
          <p className="text-xs text-neutral-500">
            <a
              href="mailto:contacto@bienvenidoatuplaza.com"
              className="hover:text-brand-celeste-deep transition"
            >
              contacto@bienvenidoatuplaza.com
            </a>
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Plataforma
          </p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/cursos"
                className="text-neutral-700 hover:text-brand-celeste-deep transition"
              >
                Catálogo de cursos
              </Link>
            </li>
            <li>
              <Link
                href="/articulos"
                className="text-neutral-700 hover:text-brand-celeste-deep transition"
              >
                Blog
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-neutral-700 hover:text-brand-celeste-deep transition"
              >
                Acceder
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500 font-semibold">
            Información legal
          </p>
          <ul className="space-y-2 text-sm">
            {LEGAL_SLUGS.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/legal/${slug}`}
                  className="text-neutral-700 hover:text-brand-celeste-deep transition"
                >
                  {LEGAL_LABELS[slug]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-neutral-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
          <span>© {year} Bienvenido a tu plaza</span>
          <span>Hecho en España con cuidado.</span>
        </div>
      </div>
    </footer>
  );
}
