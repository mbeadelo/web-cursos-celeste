import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isStorageConfigured } from "@/lib/storage";
import { ArticleForm } from "../_form";
import { updateArticle } from "../_actions";

export const metadata: Metadata = { title: "Editar artículo" };

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await db.article.findUnique({ where: { id } });
  if (!article) notFound();

  const storageEnabled = isStorageConfigured();

  async function action(input: Parameters<typeof updateArticle>[1]) {
    "use server";
    return updateArticle(id, input);
  }

  return (
    <main className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin/articulos"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            ← Volver a artículos
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/articulos/${article.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-neutral-700 hover:text-brand-celeste-deep"
            >
              Vista previa ↗
            </Link>
            {article.published &&
              article.publishedAt &&
              article.publishedAt <= new Date() && (
              <Link
                href={`/articulos/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-celeste-deep hover:text-brand-magenta"
              >
                Ver publicado ↗
              </Link>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <ArticleForm
          initial={{
            title: article.title,
            slug: article.slug,
            excerpt: article.excerpt,
            body: article.body,
            coverUrl: article.coverUrl,
            published: article.published,
            publishedAt: article.publishedAt?.toISOString() ?? null,
          }}
          action={action}
          submitLabel="Guardar cambios"
          storageEnabled={storageEnabled}
        />
      </div>
    </main>
  );
}
