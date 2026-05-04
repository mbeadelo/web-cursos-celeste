import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  LEGAL_SLUGS,
  getLegalDocument,
  type LegalSlug,
} from "@/lib/legal";
import { LegalDocumentForm } from "../_form";

export const metadata: Metadata = { title: "Editar legal" };

function isLegalSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

export default async function EditLegalDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const doc = await getLegalDocument(slug);

  return (
    <main className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          href="/admin/legal"
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          ← Volver a documentos legales
        </Link>

        <header>
          <h1 className="text-2xl font-semibold">{doc.title}</h1>
          <p className="text-sm text-neutral-600 mt-1">
            URL pública:{" "}
            <Link
              href={`/legal/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono hover:underline"
            >
              /legal/{slug}
            </Link>
          </p>
        </header>

        <LegalDocumentForm
          slug={slug}
          initialTitle={doc.title}
          initialBody={doc.body}
          isDefault={doc.isDefault}
        />
      </div>
    </main>
  );
}
