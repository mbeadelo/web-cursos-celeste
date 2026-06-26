import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import {
  LEGAL_SLUGS,
  LEGAL_LABELS,
  getLegalDocument,
  type LegalSlug,
} from "@/lib/legal";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});

function isLegalSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return { title: "Página no encontrada" };
  return {
    title: LEGAL_LABELS[slug],
    description: `${LEGAL_LABELS[slug]} de Bienvenido a tu plaza.`,
    robots: { index: true, follow: true },
  };
}

export async function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const doc = await getLegalDocument(slug);

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <Link
            href="/"
            className="text-sm text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            ← Volver al inicio
          </Link>

          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
              Información legal
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {doc.title}
            </h1>
            {doc.updatedAt && (
              <p className="text-sm text-neutral-500">
                Última actualización: {dateFormatter.format(doc.updatedAt)}
              </p>
            )}
          </header>

          <article
            className="prose prose-neutral max-w-none prose-a:text-brand-celeste-deep hover:prose-a:text-brand-magenta"
            // Safe: stored HTML is sanitized server-side on save
            // (sanitizeRichHtml in admin/legal/_actions.ts); defaults are
            // hardcoded templates in lib/legal.ts. No unsanitized user input.
            dangerouslySetInnerHTML={{ __html: doc.body }}
          />

          <footer className="pt-10 border-t border-neutral-200 text-sm text-neutral-500">
            <p>
              ¿Dudas?{" "}
              <a
                href="mailto:contacto@bienvenidoatuplaza.com"
                className="text-brand-celeste-deep hover:text-brand-magenta"
              >
                Escríbenos
              </a>
              .
            </p>
          </footer>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
