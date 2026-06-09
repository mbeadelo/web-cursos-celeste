"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LessonInputSchema, type LessonInput } from "@/lib/validations/lesson";
import {
  isStorageConfigured,
  buildLessonFileKey,
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

function mapInputToData(input: LessonInput) {
  // Empty string / undefined → null (loose lesson, no fase).
  const moduleId = input.moduleId && input.moduleId.length > 0 ? input.moduleId : null;
  // Each variant carries different fields; persist only the relevant ones.
  switch (input.type) {
    case "VIDEO":
      return {
        type: "VIDEO" as const,
        title: input.title,
        moduleId,
        muxUploadId: input.muxUploadId || null,
        muxPlaybackId: input.muxPlaybackId || null,
        fileKey: null,
        body: null,
      };
    case "PDF":
      return {
        type: "PDF" as const,
        title: input.title,
        moduleId,
        fileKey: input.fileKey,
        muxPlaybackId: null,
        body: null,
      };
    case "TEXT":
      return {
        type: "TEXT" as const,
        title: input.title,
        moduleId,
        body: input.body,
        muxPlaybackId: null,
        fileKey: null,
      };
  }
}

/**
 * Returns the moduleId only if that module exists AND belongs to this course;
 * otherwise null. Prevents attaching a lesson to another course's (or a
 * deleted) module, which would orphan it from the student view or throw a FK
 * error.
 */
async function resolveModuleId(
  courseId: string,
  moduleId: string | null
): Promise<string | null> {
  if (!moduleId) return null;
  const found = await db.module.findFirst({
    where: { id: moduleId, courseId },
    select: { id: true },
  });
  return found ? moduleId : null;
}

export async function createLesson(
  courseId: string,
  raw: LessonInput
): Promise<ActionResult> {
  await ensureAdmin();
  const parsed = LessonInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos no válidos",
      fieldErrors: flattenErrors(parsed.error),
    };
  }

  const last = await db.lesson.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  const data = mapInputToData(parsed.data);
  await db.lesson.create({
    data: {
      ...data,
      moduleId: await resolveModuleId(courseId, data.moduleId),
      courseId,
      order: nextOrder,
    },
  });

  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true };
}

export async function updateLesson(
  lessonId: string,
  raw: LessonInput
): Promise<ActionResult> {
  await ensureAdmin();
  const parsed = LessonInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Datos no válidos",
      fieldErrors: flattenErrors(parsed.error),
    };
  }

  const existing = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true },
  });
  if (!existing) return { ok: false, error: "Lección no encontrada." };

  const data = mapInputToData(parsed.data);
  await db.lesson.update({
    where: { id: lessonId },
    data: {
      ...data,
      moduleId: await resolveModuleId(existing.courseId, data.moduleId),
    },
  });

  revalidatePath(`/admin/courses/${existing.courseId}`);
  return { ok: true };
}

export async function deleteLesson(lessonId: string): Promise<void> {
  await ensureAdmin();
  const deleted = await db.lesson.delete({
    where: { id: lessonId },
    select: { courseId: true },
  });
  revalidatePath(`/admin/courses/${deleted.courseId}`);
}

/**
 * Reorder lessons of a course. The new order is given by the array of
 * lesson IDs (first element = order 1).
 *
 * Uses a two-step transaction: first set all to negative temporary
 * orders to avoid hitting the @@unique([courseId, order]) constraint,
 * then set the final positive orders.
 */
export async function reorderLessons(
  courseId: string,
  orderedLessonIds: string[]
): Promise<void> {
  await ensureAdmin();

  await db.$transaction(async (tx) => {
    // Verify all IDs belong to this course before touching anything.
    const owned = await tx.lesson.findMany({
      where: { id: { in: orderedLessonIds }, courseId },
      select: { id: true },
    });
    if (owned.length !== orderedLessonIds.length) {
      throw new Error("Lessons do not all belong to this course");
    }
    // Step 1: assign temporary negative orders to avoid the unique constraint.
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { order: -(i + 1) },
      });
    }
    // Step 2: assign final orders.
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await tx.lesson.update({
        where: { id: orderedLessonIds[i]! },
        data: { order: i + 1 },
      });
    }
  });

  revalidatePath(`/admin/courses/${courseId}`);
}

import type { ZodError } from "zod";

function flattenErrors(err: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "_";
    if (!out[path]) out[path] = [];
    out[path]!.push(issue.message);
  }
  return out;
}

const ALLOWED_PDF_TYPES = new Set(["application/pdf"]);

type LessonFileUploadResult =
  | { ok: true; uploadUrl: string; key: string }
  | { ok: false; error: string };

/**
 * Issue a signed PUT URL for the admin to upload a PDF directly to R2 from
 * the browser. Returns the resulting object key — the admin form then saves
 * it on the Lesson via updateLesson.
 */
export async function requestLessonFileUploadUrl(input: {
  lessonId: string;
  filename: string;
  contentType: string;
}): Promise<LessonFileUploadResult> {
  await ensureAdmin();
  if (!isStorageConfigured()) {
    return { ok: false, error: "R2 no está configurado en este entorno." };
  }
  if (!ALLOWED_PDF_TYPES.has(input.contentType)) {
    return { ok: false, error: "Solo se admiten archivos PDF." };
  }
  if (!input.filename || input.filename.length > 200) {
    return { ok: false, error: "Nombre de archivo inválido." };
  }
  const lesson = await db.lesson.findUnique({
    where: { id: input.lessonId },
    select: { id: true, type: true },
  });
  if (!lesson) return { ok: false, error: "Lección no encontrada." };
  if (lesson.type !== "PDF") {
    return { ok: false, error: "La lección no es de tipo PDF." };
  }

  const key = buildLessonFileKey({
    lessonId: lesson.id,
    filename: input.filename,
  });
  const { uploadUrl } = await createUploadUrl({
    key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, key };
}

/**
 * Like requestLessonFileUploadUrl but WITHOUT an existing lesson — lets the
 * admin upload a PDF while *creating* a lesson (or a pack material), before the
 * row exists. The key uses a random id as folder prefix; the resulting key is
 * saved into lesson.fileKey when the lesson is created/updated.
 */
export async function requestPdfUploadUrl(input: {
  filename: string;
  contentType: string;
}): Promise<LessonFileUploadResult> {
  await ensureAdmin();
  if (!isStorageConfigured()) {
    return { ok: false, error: "R2 no está configurado en este entorno." };
  }
  if (!ALLOWED_PDF_TYPES.has(input.contentType)) {
    return { ok: false, error: "Solo se admiten archivos PDF." };
  }
  if (!input.filename || input.filename.length > 200) {
    return { ok: false, error: "Nombre de archivo inválido." };
  }
  const key = buildLessonFileKey({
    lessonId: crypto.randomUUID(),
    filename: input.filename,
  });
  const { uploadUrl } = await createUploadUrl({
    key,
    contentType: input.contentType,
  });
  return { ok: true, uploadUrl, key };
}
