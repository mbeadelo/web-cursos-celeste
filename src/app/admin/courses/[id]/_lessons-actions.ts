"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { LessonInputSchema, type LessonInput } from "@/lib/validations/lesson";

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
  // Each variant carries different fields; persist only the relevant ones.
  switch (input.type) {
    case "VIDEO":
      return {
        type: "VIDEO" as const,
        title: input.title,
        muxPlaybackId: input.muxPlaybackId,
        fileKey: null,
        body: null,
      };
    case "PDF":
      return {
        type: "PDF" as const,
        title: input.title,
        fileKey: input.fileKey,
        muxPlaybackId: null,
        body: null,
      };
    case "TEXT":
      return {
        type: "TEXT" as const,
        title: input.title,
        body: input.body,
        muxPlaybackId: null,
        fileKey: null,
      };
  }
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

  await db.lesson.create({
    data: {
      ...mapInputToData(parsed.data),
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

  const updated = await db.lesson.update({
    where: { id: lessonId },
    data: mapInputToData(parsed.data),
    select: { courseId: true },
  });

  revalidatePath(`/admin/courses/${updated.courseId}`);
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
