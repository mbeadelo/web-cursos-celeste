import "server-only";
import { db } from "@/lib/db";

/**
 * Whether `userId` has access to all lessons of `courseId`. Access is granted
 * via an `Enrollment` row, regardless of source (PURCHASE or MANUAL).
 *
 * Use this in any server route that exposes course content. Don't rely on the
 * middleware alone — it only gates `/dashboard`, not specific course IDs.
 */
export async function canAccessCourse(
  userId: string,
  courseId: string
): Promise<boolean> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return Boolean(enrollment);
}

/**
 * Whether `userId` can access a specific lesson. Resolves the course from the
 * lesson then delegates to `canAccessCourse`. Returns false if the lesson
 * doesn't exist.
 */
export async function canAccessLesson(
  userId: string,
  lessonId: string
): Promise<boolean> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { courseId: true },
  });
  if (!lesson) return false;
  return canAccessCourse(userId, lesson.courseId);
}
