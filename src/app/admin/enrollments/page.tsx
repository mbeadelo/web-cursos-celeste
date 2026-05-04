import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EnrollForm } from "./_form";
import { DeleteEnrollmentButton } from "./_row-actions";

export const metadata: Metadata = { title: "Alumnos" };

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
});

export default async function AdminEnrollmentsPage() {
  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    db.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { email: true } },
        course: { select: { title: true, slug: true } },
      },
    }),
  ]);

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Alumnos</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Da acceso manual a un alumno escribiendo su email y eligiendo un
            curso. Si el alumno no existe se crea su cuenta.
          </p>
        </header>

        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-neutral-600">
              Crea al menos un curso antes de enrolar alumnos.
            </p>
          </div>
        ) : (
          <EnrollForm courses={courses} />
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Enrollments recientes</h2>
          {enrollments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
              <p className="text-neutral-600">
                Aún no hay alumnos enrolados.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.user.email}</TableCell>
                      <TableCell>{e.course.title}</TableCell>
                      <TableCell>
                        <span
                          className={
                            e.source === "MANUAL"
                              ? "text-xs uppercase tracking-wide rounded-full bg-neutral-100 text-neutral-700 px-2 py-0.5"
                              : "text-xs uppercase tracking-wide rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5"
                          }
                        >
                          {e.source === "MANUAL" ? "Manual" : "Compra"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-neutral-600">
                        {dateFormatter.format(e.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeleteEnrollmentButton
                          id={e.id}
                          email={e.user.email}
                          courseTitle={e.course.title}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
