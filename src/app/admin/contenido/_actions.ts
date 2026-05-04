"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { SITE_CONTENT_KEYS, type SiteContentKey } from "@/lib/site-content-keys";

type ActionResult = { ok: true; updated: number } | { ok: false; error: string };

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

export async function saveSiteContent(formData: FormData): Promise<ActionResult> {
  await ensureAdmin();

  const updates: { key: string; value: string }[] = [];
  for (const key of Object.keys(SITE_CONTENT_KEYS) as SiteContentKey[]) {
    const raw = formData.get(key);
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value.length === 0) continue;
    if (value.length > 50_000) {
      return {
        ok: false,
        error: `El campo "${SITE_CONTENT_KEYS[key].label}" es demasiado largo.`,
      };
    }
    updates.push({ key, value });
  }

  if (updates.length === 0) {
    return { ok: false, error: "No hay cambios que guardar." };
  }

  await db.$transaction(
    updates.map((u) =>
      db.siteContent.upsert({
        where: { key: u.key },
        create: { key: u.key, value: u.value },
        update: { value: u.value },
      })
    )
  );

  // Public surfaces that read site content.
  revalidatePath("/");
  revalidatePath("/admin/contenido");

  return { ok: true, updated: updates.length };
}

export async function resetSiteContentKey(
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureAdmin();
  const exists = (Object.keys(SITE_CONTENT_KEYS) as string[]).includes(key);
  if (!exists) return { ok: false, error: "Clave no válida." };
  await db.siteContent
    .delete({ where: { key } })
    .catch(() => null); // already absent → no-op
  revalidatePath("/");
  revalidatePath("/admin/contenido");
  return { ok: true };
}
