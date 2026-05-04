import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { env } from "@/lib/env";
import { estimateReadingTimeMinutes } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await db.article.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      coverUrl: true,
      published: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  if (!article || !article.published) return { title: "Artículo no encontrado" };
  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      images: article.coverUrl ? [{ url: article.coverUrl }] : undefined,
    },
    twitter: {
      card: article.coverUrl ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt,
      images: article.coverUrl ? [article.coverUrl] : undefined,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await db.article.findUnique({
    where: { slug },
    include: { author: { select: { name: true, email: true } } },
  });
  if (!article || !article.published) notFound();

  const canonicalUrl = `${env.AUTH_URL ?? "https://bienvenidoatuplaza.com"}/articulos/${article.slug}`;
  const authorName = article.author?.name ?? "Bienvenido a tu plaza";

  // JSON-LD schema.org/Article — enables rich results in Google.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: article.coverUrl ? [article.coverUrl] : undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: { "@type": "Person", name: authorName },
    publisher: {
      "@type": "Organization",
      name: "Bienvenido a tu plaza",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        <script
          type="application/ld+json"
          // Safe: we control all values, no user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
          <Link
            href="/articulos"
            className="text-sm text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            ← Volver al blog
          </Link>

          <header className="space-y-4">
            {article.publishedAt && (
              <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
                {dateFormatter.format(article.publishedAt)} · {authorName} ·{" "}
                {estimateReadingTimeMinutes(article.body)} min lectura
              </p>
            )}
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
            // Only admin (authenticated, role-gated) can write articles, and
            // the editor schema does not allow <script>, <iframe>, or event
            // handlers.
            dangerouslySetInnerHTML={{ __html: article.body }}
          />

          <footer className="pt-10 border-t border-neutral-200">
            <Link
              href="/articulos"
              className="text-sm font-medium text-brand-celeste-deep hover:text-brand-magenta transition"
            >
              ← Más artículos
            </Link>
          </footer>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
