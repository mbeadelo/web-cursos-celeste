import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Mis cursos" };

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      course: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          coverUrl: true,
          lessons: { select: { id: true } },
        },
      },
    },
  });

  // One query for all completed-progress rows on this user's enrolled courses.
  // Group counts by courseId in JS — small fan-out compared to N course-scoped
  // count queries.
  const allLessonIds = enrollments.flatMap((e) => e.course.lessons.map((l) => l.id));
  const completed = allLessonIds.length
    ? await db.lessonProgress.findMany({
        where: {
          userId: session.user.id,
          lessonId: { in: allLessonIds },
          completedAt: { not: null },
        },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(completed.map((c) => c.lessonId));

  return (
    <main className="flex-1">
      <div className="border-b border-neutral-200 bg-gradient-to-b from-brand-celeste/8 to-white">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
              Tu plaza
            </p>
            <h1 className="text-3xl font-bold tracking-tight mt-1">Mis cursos</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {session.user.email}
              {session.user.role === "ADMIN" && (
                <>
                  {" · "}
                  <Link
                    href="/admin"
                    className="underline hover:text-brand-celeste-deep"
                  >
                    Panel de administración
                  </Link>
                </>
              )}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-neutral-600 hover:text-neutral-900 underline"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {enrollments.length === 0 ? (
          <section className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center space-y-3">
            <p className="text-neutral-700 font-medium">
              Aún no tienes cursos en tu plaza.
            </p>
            <p className="text-sm text-neutral-500">
              Cuando compres uno o el admin te enrole, aparecerá aquí.
            </p>
            <Link
              href="/cursos"
              className="inline-block mt-2 rounded-full bg-brand-celeste text-brand-celeste-foreground px-5 py-2.5 font-medium hover:bg-brand-celeste-deep transition"
            >
              Ver catálogo
            </Link>
          </section>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrollments.map((e) => {
              const total = e.course.lessons.length;
              const done = e.course.lessons.filter((l) =>
                completedSet.has(l.id)
              ).length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const ctaLabel =
                done === 0 ? "Empezar →" : pct === 100 ? "Repasar →" : "Continuar →";
              return (
                <Link
                  key={e.id}
                  href={`/dashboard/cursos/${e.course.slug}`}
                  className="group rounded-xl bg-white ring-1 ring-foreground/10 overflow-hidden transition hover:ring-brand-celeste/50 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {e.course.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.course.coverUrl}
                        alt=""
                        className="w-full h-full object-cover transition group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-celeste/20 to-brand-magenta/20" />
                    )}
                    {pct === 100 && (
                      <span className="absolute top-2 right-2 rounded-full bg-brand-celeste text-brand-celeste-foreground text-[10px] uppercase tracking-wide px-2 py-0.5 font-semibold">
                        ✓ Completado
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h2 className="font-semibold leading-tight line-clamp-2">
                      {e.course.title}
                    </h2>
                    {total > 0 && (
                      <>
                        <div
                          className="h-1.5 rounded-full bg-neutral-200 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-gradient-to-r from-brand-celeste to-brand-magenta"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-neutral-500 tabular-nums">
                          {done} / {total} lecciones · {pct}%
                        </p>
                      </>
                    )}
                    <p className="pt-1 text-sm font-medium text-brand-celeste-deep group-hover:text-brand-magenta transition">
                      {ctaLabel}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
