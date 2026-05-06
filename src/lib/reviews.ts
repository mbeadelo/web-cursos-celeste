"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ReviewInputSchema,
  ReviewModerationSchema,
} from "@/lib/validations/review";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Submit a course review. Requirements:
 *   - User is authenticated
 *   - User has an Enrollment for the course (otherwise the review wouldn't
 *     be trustworthy and it'd be easy to spam the page)
 * The review starts in PENDING status; an admin moderates from /admin/reviews
 * before it appears on the public landing.
 *
 * The (userId, courseId) unique constraint means a student can only have one
 * review per course — submitting again updates the existing one and re-flags
 * it for moderation. That's intentional: lets students refine their words,
 * but the admin re-approves the new text.
 */
export async function submitReview(input: {
  courseId: string;
  rating: number;
  body: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session) return { ok: false, error: "Inicia sesión para opinar." };

  const parsed = ReviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Datos no válidos",
    };
  }

  const enrollment = await db.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: parsed.data.courseId,
      },
    },
    select: { id: true },
  });
  if (!enrollment) {
    return {
      ok: false,
      error: "Solo los alumnos del curso pueden dejar una reseña.",
    };
  }

  await db.review.upsert({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: parsed.data.courseId,
      },
    },
    create: {
      userId: session.user.id,
      courseId: parsed.data.courseId,
      rating: parsed.data.rating,
      body: parsed.data.body,
      status: "PENDING",
    },
    update: {
      rating: parsed.data.rating,
      body: parsed.data.body,
      // Re-submission goes back through moderation.
      status: "PENDING",
    },
  });

  // Revalidate course landing so admin can see the count change after a
  // refresh, and dashboard so the student sees the "pending" state.
  const course = await db.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { slug: true },
  });
  if (course) {
    revalidatePath(`/cursos/${course.slug}`);
    revalidatePath(`/dashboard/cursos/${course.slug}`);
  }
  revalidatePath("/admin/reviews");

  return { ok: true };
}

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

export async function moderateReview(input: {
  reviewId: string;
  status: "APPROVED" | "REJECTED" | "PENDING";
}): Promise<ActionResult> {
  await ensureAdmin();
  const parsed = ReviewModerationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos no válidos" };
  }
  const review = await db.review.update({
    where: { id: parsed.data.reviewId },
    data: { status: parsed.data.status },
    select: { course: { select: { slug: true } } },
  });
  revalidatePath("/admin/reviews");
  if (review.course) revalidatePath(`/cursos/${review.course.slug}`);
  return { ok: true };
}

export async function deleteReview(
  reviewId: string
): Promise<ActionResult> {
  await ensureAdmin();
  const review = await db.review.delete({
    where: { id: reviewId },
    select: { course: { select: { slug: true } } },
  });
  revalidatePath("/admin/reviews");
  if (review.course) revalidatePath(`/cursos/${review.course.slug}`);
  return { ok: true };
}
