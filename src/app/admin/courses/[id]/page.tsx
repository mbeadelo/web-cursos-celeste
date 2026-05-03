import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CourseForm } from "../_form";
import { updateCourse } from "../_actions";

export const metadata: Metadata = { title: "Editar curso" };

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await db.course.findUnique({ where: { id } });
  if (!course) notFound();

  async function action(input: Parameters<typeof updateCourse>[1]) {
    "use server";
    return updateCourse(id, input);
  }

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Editar curso</h1>
          <Link href="/admin/courses" className="text-sm text-neutral-600 hover:text-neutral-900 underline">
            Volver
          </Link>
        </header>

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
        />
      </div>
    </main>
  );
}
