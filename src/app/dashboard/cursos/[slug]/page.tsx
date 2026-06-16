import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canAccessCourse } from "@/lib/access";
import { lessonHref } from "@/lib/lesson-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true },
  });
  return { title: course?.title ?? "Curso" };
}

/**
 * Course entry point. There's no content rendered at the bare course URL: it
 * resolves the target lesson and redirects to its pretty URL
 * (`/dashboard/cursos/<slug>/<title-slug>-<id>`), so the address bar always
 * shows a canonical lesson link.
 *
 * Backward compatibility: old links used `?l=<lessonId>`. If that param is
 * present and valid, we redirect to that lesson's pretty URL.
 *
 * Only when the course has zero lessons do we render here (an empty state).
 */
export default async function StudentCourseEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ l?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { slug } = await params;
  const { l: legacyLessonId } = await searchParams;

  const course = await db.course.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true },
      },
    },
  });
  if (!course) notFound();

  const enrolled = await canAccessCourse(session.user.id, course.id);
  const isAdmin = session.user.role === "ADMIN";
  if (!enrolled && !isAdmin) redirect("/dashboard");

  // Legacy `?l=<id>` link → canonical pretty URL for that lesson, if it exists.
  if (legacyLessonId) {
    const legacy = course.lessons.find((l) => l.id === legacyLessonId);
    if (legacy) redirect(lessonHref(course.slug, legacy));
  }

  // Default: jump to the first lesson.
  const first = course.lessons[0];
  if (first) redirect(lessonHref(course.slug, first));

  // Empty course — nothing to redirect to.
  return (
    <main className="flex-1">
      <div className="border-b border-neutral-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link
            href="/dashboard"
            className="text-sm text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            ← Mis cursos
          </Link>
          <h1 className="mt-3 text-2xl md:text-3xl font-bold tracking-tight">
            {course.title}
          </h1>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
          <p className="text-neutral-600">
            Este curso aún no tiene contenido publicado.
          </p>
        </div>
      </div>
    </main>
  );
}
