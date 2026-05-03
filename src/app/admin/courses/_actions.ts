"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { CourseInputSchema, type CourseInput } from "@/lib/validations/course";
import {
  isStorageConfigured,
  buildCoverKey,
  createUploadUrl,
} from "@/lib/storage";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

export async function createCourse(raw: CourseInput): Promise<ActionResult> {
  await ensureAdmin();

  const parsed = CourseInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos no válidos", fieldErrors: flattenErrors(parsed.error) };
  }

  let created;
  try {
    created = await db.course.create({
      data: parsed.data,
      select: { id: true },
    });
  } catch (err: unknown) {
    if (isUniqueConstraint(err, "slug")) {
      return { ok: false, error: "Ese slug ya existe. Usa otro." };
    }
    throw err;
  }

  revalidatePath("/admin/courses");
  // Redirect to the edit page so the admin can immediately add lessons.
  redirect(`/admin/courses/${created.id}`);
}

export async function updateCourse(
  id: string,
  raw: CourseInput
): Promise<ActionResult> {
  await ensureAdmin();

  const parsed = CourseInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Datos no válidos", fieldErrors: flattenErrors(parsed.error) };
  }

  try {
    await db.course.update({ where: { id }, data: parsed.data });
  } catch (err: unknown) {
    if (isUniqueConstraint(err, "slug")) {
      return { ok: false, error: "Ese slug ya existe. Usa otro." };
    }
    throw err;
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { ok: true };
}

export async function togglePublishCourse(id: string): Promise<void> {
  await ensureAdmin();
  const course = await db.course.findUniqueOrThrow({
    where: { id },
    select: { published: true },
  });
  await db.course.update({
    where: { id },
    data: { published: !course.published },
  });
  revalidatePath("/admin/courses");
}

export async function deleteCourse(id: string): Promise<void> {
  await ensureAdmin();
  await db.course.delete({ where: { id } });
  revalidatePath("/admin/courses");
}

const ALLOWED_COVER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

type CoverUploadResult =
  | { ok: true; uploadUrl: string; publicUrl: string; key: string }
  | { ok: false; error: string };

export async function requestCoverUploadUrl(input: {
  filename: string;
  contentType: string;
}): Promise<CoverUploadResult> {
  await ensureAdmin();
  if (!isStorageConfigured()) {
    return { ok: false, error: "R2 no está configurado en este entorno." };
  }
  if (!ALLOWED_COVER_TYPES.has(input.contentType)) {
    return { ok: false, error: "Formato no soportado. Usa JPG, PNG, WebP, AVIF o GIF." };
  }
  if (!input.filename || input.filename.length > 200) {
    return { ok: false, error: "Nombre de archivo inválido." };
  }
  const key = buildCoverKey(input.filename);
  const { uploadUrl, publicUrl } = await createUploadUrl({
    key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, publicUrl, key };
}

function flattenErrors(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!out[path]) out[path] = [];
    out[path]!.push(issue.message);
  }
  return out;
}

function isUniqueConstraint(err: unknown, field: string): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return target === field;
}
