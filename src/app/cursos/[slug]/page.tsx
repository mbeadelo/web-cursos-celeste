import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { isStripeConfigured } from "@/lib/stripe";

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

const lessonTypeLabel: Record<"VIDEO" | "PDF" | "TEXT", string> = {
  VIDEO: "Vídeo",
  PDF: "PDF",
  TEXT: "Texto",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, description: true, published: true },
  });
  if (!course || !course.published) return { title: "Curso no encontrado" };
  return {
    title: course.title,
    description: course.description.slice(0, 160),
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, order: true, title: true, type: true },
      },
    },
  });
  if (!course || !course.published) notFound();

  const session = await auth();
  const enrolled = session
    ? Boolean(
        await db.enrollment.findUnique({
          where: {
            userId_courseId: { userId: session.user.id, courseId: course.id },
          },
          select: { id: true },
        })
      )
    : false;

  const stripeReady = isStripeConfigured();

  return (
    <>
      <PublicHeader />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto space-y-10">
          <Link
            href="/cursos"
            className="text-sm text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            ← Volver al catálogo
          </Link>

          <header className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-start">
            <div className="space-y-4">
              {course.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.coverUrl}
                  alt=""
                  className="w-full aspect-[16/9] object-cover rounded-xl border border-neutral-200"
                />
              ) : (
                <div className="w-full aspect-[16/9] rounded-xl border border-neutral-200 bg-gradient-to-br from-brand-celeste/20 to-brand-magenta/20" />
              )}
              <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
              <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
            </div>

            <aside className="md:w-64 md:sticky md:top-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Precio
                </p>
                <p className="text-2xl font-semibold text-brand-celeste-deep">
                  {formatter.format(course.priceCents / 100)}
                </p>
              </div>
              {enrolled ? (
                <Link
                  href="/dashboard"
                  className="block w-full text-center rounded-md bg-brand-celeste text-brand-celeste-foreground px-4 py-2.5 font-medium hover:bg-brand-celeste-deep transition"
                >
                  Ir al curso
                </Link>
              ) : stripeReady ? (
                <>
                  <form action="/api/checkout" method="POST">
                    <input type="hidden" name="courseId" value={course.id} />
                    <button
                      type="submit"
                      className="block w-full rounded-md bg-brand-celeste text-brand-celeste-foreground px-4 py-2.5 font-medium hover:bg-brand-celeste-deep transition cursor-pointer"
                    >
                      Comprar curso
                    </button>
                  </form>
                  {!session && (
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      No necesitas crear cuenta antes — la generamos al
                      completar la compra.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="block w-full rounded-md bg-neutral-200 text-neutral-500 px-4 py-2.5 font-medium cursor-not-allowed"
                  >
                    Comprar (próximamente)
                  </button>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    Pagos pendientes de activar en este entorno.
                  </p>
                </>
              )}
              <p className="text-xs text-neutral-500">
                {course.lessons.length} lección
                {course.lessons.length === 1 ? "" : "es"}
              </p>
            </aside>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Contenido del curso</h2>
            {course.lessons.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Aún no hay lecciones publicadas.
              </p>
            ) : (
              <ol className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-200 overflow-hidden">
                {course.lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-sm tabular-nums text-neutral-400 w-6">
                        {l.order}
                      </span>
                      <span className="font-medium truncate">{l.title}</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-neutral-500 shrink-0">
                      {lessonTypeLabel[l.type]}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
