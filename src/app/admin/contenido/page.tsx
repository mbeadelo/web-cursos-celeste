import type { Metadata } from "next";
import {
  SITE_CONTENT_KEYS,
  type SiteContentKey,
  getAllContent,
} from "@/lib/site-content";
import { SiteContentForm } from "./_form";

export const metadata: Metadata = { title: "Contenido" };

export default async function AdminContenidoPage() {
  const stored = await getAllContent();

  const values: Record<string, string> = {};
  const hasOverride: Record<string, boolean> = {};
  for (const key of Object.keys(SITE_CONTENT_KEYS) as SiteContentKey[]) {
    const v = stored.get(key);
    values[key] = v ?? SITE_CONTENT_KEYS[key].default;
    hasOverride[key] = v !== undefined;
  }

  return (
    <main className="px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Contenido de la web</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Edita los textos que aparecen en la home pública. Los cambios se
            aplican inmediatamente.
          </p>
        </header>
        <SiteContentForm values={values} hasOverride={hasOverride} />
      </div>
    </main>
  );
}
