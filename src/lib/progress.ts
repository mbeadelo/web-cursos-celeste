"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Server actions for student lesson progress. All actions require an
 * authenticated user with an Enrollment for the course that owns the lesson —
 * we resolve courseId from lessonId so the client only needs to pass the
 * lesson id.
 *
 * `lastSeconds` is only meaningful for VIDEO lessons. PDF/TEXT lessons store
 * 0 there and rely on `completedAt` being set.
 */

const VIDEO_COMPLETE_THRESHOLD = 0.95; // 95% watched marks the video complete

async function getEnrolledLesson(lessonId: string) {
  const session = await auth();
  if (!session) return null;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, courseId: true },
  });
  if (!lesson) return null;
  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: lesson.courseId },
    },
    select: { id: true },
  });
  if (!enrollment) return null;
  return { userId: session.user.id, lessonId: lesson.id };
}

/**
 * Upsert progress for a video lesson. Called periodically from the player on
 * timeUpdate (throttled client-side) and on ended. Auto-marks complete when
 * `lastSeconds / duration >= 0.95`.
 *
 * Silent no-op (returns false) when not authorized — we don't want the player
 * to throw and break playback if the session expired mid-lesson.
 */
export async function recordVideoProgress(input: {
  lessonId: string;
  lastSeconds: number;
  durationSeconds: number;
}): Promise<{ ok: boolean }> {
  const ctx = await getEnrolledLesson(input.lessonId);
  if (!ctx) return { ok: false };

  const lastSeconds = Math.max(0, Math.floor(input.lastSeconds));
  const completed =
    input.durationSeconds > 0 &&
    lastSeconds / input.durationSeconds >= VIDEO_COMPLETE_THRESHOLD;

  await db.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId: ctx.userId, lessonId: ctx.lessonId },
    },
    create: {
      userId: ctx.userId,
      lessonId: ctx.lessonId,
      lastSeconds,
      completedAt: completed ? new Date() : null,
    },
    update: {
      lastSeconds,
      // Only flip to completed; never un-complete a lesson the student
      // already finished (e.g. if they re-watch from the start).
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });
  return { ok: true };
}

/**
 * Mark a PDF or TEXT lesson complete. Called from a "Marcar como completada"
 * button in the viewer. Idempotent — re-clicking does nothing.
 */
export async function markLessonComplete(
  lessonId: string
): Promise<{ ok: boolean }> {
  const ctx = await getEnrolledLesson(lessonId);
  if (!ctx) return { ok: false };

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: ctx.userId, lessonId: ctx.lessonId } },
    create: {
      userId: ctx.userId,
      lessonId: ctx.lessonId,
      lastSeconds: 0,
      completedAt: new Date(),
    },
    update: { completedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Toggle completion off for a lesson — the student can mark a lesson as not
 * completed if they want to revisit it. Mostly there for symmetry with the
 * mark-complete button.
 */
export async function unmarkLessonComplete(
  lessonId: string
): Promise<{ ok: boolean }> {
  const ctx = await getEnrolledLesson(lessonId);
  if (!ctx) return { ok: false };

  await db.lessonProgress.updateMany({
    where: { userId: ctx.userId, lessonId: ctx.lessonId },
    data: { completedAt: null },
  });
  return { ok: true };
}
