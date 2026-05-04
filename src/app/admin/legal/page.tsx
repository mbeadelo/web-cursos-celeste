import type { Metadata } from "next";
import Link from "next/link";
import { getAllLegalDocuments } from "@/lib/legal";

export const metadata: Metadata = { title: "Legal" };

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export default async function AdminLegalIndexPage() {
  const docs = await getAllLegalDocuments();

  return (
    <main className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Documentos legales</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Edita la política de privacidad, los términos y la política de
            cookies. Las plantillas por defecto son un punto de partida —{" "}
            <strong>revísalas con un abogado</strong> antes de publicar.
          </p>
        </header>

        <ul className="space-y-3">
          {docs.map((d) => (
            <li
              key={d.slug}
              className="rounded-lg border border-neutral-200 bg-white p-5 flex items-baseline justify-between gap-4"
            >
              <div>
                <Link
                  href={`/admin/legal/${d.slug}`}
                  className="font-medium hover:underline"
                >
                  {d.title}
                </Link>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {d.isDefault ? (
                    <span className="text-amber-700">
                      ⚠ Mostrando plantilla por defecto. Edita y guarda para
                      personalizar.
                    </span>
                  ) : (
                    <>
                      Última actualización:{" "}
                      {d.updatedAt ? dateFormatter.format(d.updatedAt) : "—"}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500 shrink-0">
                <Link
                  href={`/legal/${d.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutral-900"
                >
                  Ver público ↗
                </Link>
                <span>·</span>
                <Link
                  href={`/admin/legal/${d.slug}`}
                  className="hover:text-neutral-900"
                >
                  Editar →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
