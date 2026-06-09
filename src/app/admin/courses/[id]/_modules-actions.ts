"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

function cleanTitle(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > 200) return null;
  return t;
}

export async function createModule(
  courseId: string,
  rawTitle: string
): Promise<ActionResult> {
  await ensureAdmin();
  const title = cleanTitle(rawTitle);
  if (!title) return { ok: false, error: "El título de la fase es obligatorio (máx 200)." };

  const last = await db.module.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.module.create({
    data: { courseId, title, order: (last?.order ?? 0) + 1 },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function renameModule(
  moduleId: string,
  rawTitle: string
): Promise<ActionResult> {
  await ensureAdmin();
  const title = cleanTitle(rawTitle);
  if (!title) return { ok: false, error: "El título de la fase es obligatorio (máx 200)." };

  const updated = await db.module.update({
    where: { id: moduleId },
    data: { title },
    select: { courseId: true },
  });
  revalidatePath(`/admin/courses/${updated.courseId}`);
  return { ok: true };
}

/**
 * Delete a module. Its lessons are NOT deleted — the schema's onDelete: SetNull
 * orphans them back to "sin fase" so no video/PDF content is lost.
 */
export async function deleteModule(moduleId: string): Promise<void> {
  await ensureAdmin();
  const deleted = await db.module.delete({
    where: { id: moduleId },
    select: { courseId: true },
  });
  revalidatePath(`/admin/courses/${deleted.courseId}`);
}
