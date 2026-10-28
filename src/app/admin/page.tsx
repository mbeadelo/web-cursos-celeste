import Link from "next/link";
import { db } from "@/lib/db";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function AdminHome() {
  const weekAgo = daysAgo(7);
  const [
    coursesTotal,
    coursesPublished,
    enrollmentsTotal,
    reviewsPending,
    openErrors,
    failedCheckouts,
  ] = await Promise.all([
    db.course.count(),
    db.course.count({ where: { published: true } }),
    db.enrollment.count(),
    db.review.count({ where: { status: "PENDING" } }),
    db.opsEvent.count({ where: { level: "ERROR", resolvedAt: null } }),
    db.checkoutAttempt.count({
      where: { status: "FAILED", createdAt: { gte: weekAgo } },
    }),
  ]);
  const healthOk = openErrors === 0 && failedCheckouts === 0;

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Panel de administración</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Resumen rápido. Gestiona cursos, alumnos y ventas desde aquí.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admin/courses"
            className="rounded-lg border border-neutral-200 bg-white p-6 hover:border-neutral-400 transition"
          >
            <p className="text-sm text-neutral-600">Cursos totales</p>
            <p className="text-3xl font-semibold mt-1">{coursesTotal}</p>
            <p className="text-xs text-neutral-500 mt-2">{coursesPublished} publicados</p>
          </Link>
          <Link
            href="/admin/enrollments"
            className="rounded-lg border border-neutral-200 bg-white p-6 hover:border-neutral-400 transition"
          >
            <p className="text-sm text-neutral-600">Alumnos enrolados</p>
            <p className="text-3xl font-semibold mt-1">{enrollmentsTotal}</p>
            <p className="text-xs text-neutral-500 mt-2">
              Gestionar accesos manualmente
            </p>
          </Link>
          <Link
            href="/admin/reviews"
            className="rounded-lg border border-neutral-200 bg-white p-6 hover:border-neutral-400 transition"
          >
            <p className="text-sm text-neutral-600">Reseñas pendientes</p>
            <p className="text-3xl font-semibold mt-1">
              {reviewsPending}
              {reviewsPending > 0 && (
                <span className="ml-2 text-xs uppercase tracking-wide text-amber-700 align-middle">
                  Por moderar
                </span>
              )}
            </p>
            <p className="text-xs text-neutral-500 mt-2">Aprobar / rechazar</p>
          </Link>
          <Link
            href="/admin/salud"
            className={`rounded-lg border bg-white p-6 transition ${
              healthOk
                ? "border-neutral-200 hover:border-neutral-400"
                : "border-red-300 hover:border-red-500"
            }`}
          >
            <p className="text-sm text-neutral-600">Salud de la web</p>
            <p className="text-3xl font-semibold mt-1">
              {healthOk ? (
                <span className="text-emerald-700">OK</span>
              ) : (
                <span className="text-red-700">{openErrors}</span>
              )}
              {!healthOk && (
                <span className="ml-2 text-xs uppercase tracking-wide text-red-700 align-middle">
                  incidencias
                </span>
              )}
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              {failedCheckouts > 0
                ? `${failedCheckouts} pago(s) fallido(s) esta semana`
                : "Pagos, webhooks y proveedores"}
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
