import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { estimateReadingTimeMinutes } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Vista previa",
  robots: { index: false, follow: false },
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await db.article.findUnique({
    where: { id },
    include: { author: { select: { name: true, email: true } } },
  });
  if (!article) notFound();

  const authorName = article.author?.name ?? "Bienvenido a tu plaza";
  const displayDate = article.publishedAt ?? article.updatedAt;

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4 text-sm">
            <p className="text-amber-900">
              <strong>Vista previa</strong> — visible solo para admins.
              {!article.published && " Este artículo aún no está publicado."}
            </p>
            <Link
              href={`/admin/articulos/${article.id}`}
              className="font-medium text-amber-900 hover:text-amber-700 whitespace-nowrap"
            >
              ← Volver al editor
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <header className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
              {dateFormatter.format(displayDate)} · {authorName} ·{" "}
              {estimateReadingTimeMinutes(article.body)} min lectura
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              {article.title}
            </h1>
            <p className="text-lg text-neutral-700 leading-relaxed">
              {article.excerpt}
            </p>
          </header>

          {article.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.coverUrl}
              alt=""
              className="w-full aspect-[16/9] object-cover rounded-2xl border border-neutral-200"
            />
          )}

          <article
            className="prose prose-neutral max-w-none prose-headings:tracking-tight prose-headings:font-bold prose-a:text-brand-celeste-deep hover:prose-a:text-brand-magenta"
            // Safe: body comes from TipTap editor with whitelisted nodes/marks.
            dangerouslySetInnerHTML={{ __html: article.body }}
          />
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
