import type { Metadata } from "next";
import Link from "next/link";
import { CourseForm } from "../_form";
import { createCourse } from "../_actions";

export const metadata: Metadata = { title: "Nuevo curso" };

export default function NewCoursePage() {
  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Nuevo curso</h1>
          <Link href="/admin/courses" className="text-sm text-neutral-600 hover:text-neutral-900 underline">
            Volver
          </Link>
        </header>

        <CourseForm action={createCourse} submitLabel="Crear curso" />
      </div>
    </main>
  );
}
