import type { Metadata } from "next";
import Link from "next/link";
import { isStorageConfigured } from "@/lib/storage";
import { ArticleForm } from "../_form";
import { createArticle } from "../_actions";

export const metadata: Metadata = { title: "Nuevo artículo" };

export default function NewArticlePage() {
  const storageEnabled = isStorageConfigured();
  return (
    <main className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          href="/admin/articulos"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Volver a artículos
        </Link>
        <h1 className="text-2xl font-semibold">Nuevo artículo</h1>
        <ArticleForm
          action={createArticle}
          submitLabel="Crear artículo"
          storageEnabled={storageEnabled}
        />
      </div>
    </main>
  );
}
