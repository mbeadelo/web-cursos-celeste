"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ManualEnrollmentSchema } from "@/lib/validations/enrollment";

type ActionResult =
  | { ok: true; created: boolean; alreadyEnrolled: boolean; userExisted: boolean }
  | { ok: false; error: string };

async function ensureAdmin(): Promise<void> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("No autorizado");
  }
}

export async function enrollUserManual(formData: FormData): Promise<ActionResult> {
  await ensureAdmin();

  const parsed = ManualEnrollmentSchema.safeParse({
    email: formData.get("email"),
    courseId: formData.get("courseId"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(". "),
    };
  }

  const { email, courseId } = parsed.data;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return { ok: false, error: "El curso no existe." };

  // Upsert User. We bypass the locked Auth.js adapter on purpose — manual
  // enrollment is a sanctioned provisioning path.
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const user = existing
    ? existing
    : await db.user.create({ data: { email }, select: { id: true } });

  // Idempotent: if already enrolled, just say so.
  const already = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (already) {
    return {
      ok: true,
      created: false,
      alreadyEnrolled: true,
      userExisted: Boolean(existing),
    };
  }

  await db.enrollment.create({
    data: { userId: user.id, courseId, source: "MANUAL" },
  });

  revalidatePath("/admin/enrollments");
  revalidatePath("/admin");
  return {
    ok: true,
    created: true,
    alreadyEnrolled: false,
    userExisted: Boolean(existing),
  };
}

export async function deleteEnrollment(id: string): Promise<ActionResult> {
  await ensureAdmin();
  await db.enrollment.delete({ where: { id } });
  revalidatePath("/admin/enrollments");
  revalidatePath("/admin");
  return { ok: true, created: false, alreadyEnrolled: false, userExisted: true };
}
