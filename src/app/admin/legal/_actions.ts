"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/legal";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

function isValidSlug(s: string): s is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(s);
}

export async function saveLegalDocument(input: {
  slug: string;
  title: string;
  body: string;
}): Promise<ActionResult> {
  await ensureAdmin();
  if (!isValidSlug(input.slug)) {
    return { ok: false, error: "Slug no válido." };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 3) {
    return { ok: false, error: "El título es demasiado corto." };
  }
  if (body.length < 50) {
    return { ok: false, error: "El cuerpo es demasiado corto." };
  }
  if (body.length > 100_000) {
    return { ok: false, error: "El cuerpo excede el límite (100 000 caracteres)." };
  }

  await db.legalDocument.upsert({
    where: { slug: input.slug },
    create: { slug: input.slug, title, body },
    update: { title, body },
  });

  revalidatePath("/admin/legal");
  revalidatePath(`/admin/legal/${input.slug}`);
  revalidatePath(`/legal/${input.slug}`);
  return { ok: true };
}

export async function resetLegalDocument(slug: string): Promise<ActionResult> {
  await ensureAdmin();
  if (!isValidSlug(slug)) {
    return { ok: false, error: "Slug no válido." };
  }
  await db.legalDocument
    .delete({ where: { slug } })
    .catch(() => null); // not present → no-op
  revalidatePath("/admin/legal");
  revalidatePath(`/admin/legal/${slug}`);
  revalidatePath(`/legal/${slug}`);
  return { ok: true };
}
