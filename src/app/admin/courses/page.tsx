import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublishSwitch, DeleteCourseButton } from "./_row-actions";

export const metadata: Metadata = { title: "Cursos" };

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export default async function AdminCoursesPage() {
  const courses = await db.course.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      published: true,
      createdAt: true,
    },
  });

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Cursos</h1>
            <p className="text-sm text-neutral-600">
              {courses.length} curso{courses.length === 1 ? "" : "s"} en total.
            </p>
          </div>
          <Button render={<Link href="/admin/courses/new" />}>Nuevo curso</Button>
        </header>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
            <p className="text-neutral-600">Aún no has creado ningún curso.</p>
            <Button className="mt-4" render={<Link href="/admin/courses/new" />}>
              Crear el primero
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-center">Publicado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="font-mono text-xs text-neutral-600">{c.slug}</TableCell>
                    <TableCell className="text-right">
                      {formatter.format(c.priceCents / 100)}
                    </TableCell>
                    <TableCell className="text-center">
                      <PublishSwitch id={c.id} initialPublished={c.published} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/courses/${c.id}`} />}
                      >
                        Editar
                      </Button>
                      <DeleteCourseButton id={c.id} title={c.title} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
