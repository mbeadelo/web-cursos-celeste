import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CourseForm } from "../_form";
import { updateCourse } from "../_actions";
import { LessonsList } from "./_lessons-list";
import { isStorageConfigured } from "@/lib/storage";
import { isMuxConfigured } from "@/lib/mux";

export const metadata: Metadata = { title: "Editar curso" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await db.course.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          type: true,
          muxPlaybackId: true,
          fileKey: true,
          body: true,
        },
      },
    },
  });
  if (!course) notFound();

  async function action(input: Parameters<typeof updateCourse>[1]) {
    "use server";
    return updateCourse(id, input);
  }

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Editar curso</h1>
            <p className="text-sm text-neutral-600 font-mono">{course.slug}</p>
          </div>
          <Link
            href="/admin/courses"
            className="text-sm text-neutral-600 hover:text-neutral-900 underline"
          >
            Volver a la lista
          </Link>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Datos del curso</h2>
          <CourseForm
            initial={{
              title: course.title,
              slug: course.slug,
              description: course.description,
              priceCents: course.priceCents,
              coverUrl: course.coverUrl,
              published: course.published,
            }}
            action={action}
            submitLabel="Guardar cambios"
            storageEnabled={isStorageConfigured()}
          />
        </section>

        <section className="space-y-4 pt-6 border-t border-neutral-200">
          <LessonsList
            courseId={course.id}
            initialLessons={course.lessons}
            storageEnabled={isStorageConfigured()}
            muxConfigured={isMuxConfigured()}
          />
        </section>
      </div>
    </main>
  );
}
