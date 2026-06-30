import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { CourseBadge } from "@/components/course-badge";
import { RatingStars } from "@/components/rating-stars";
import { buildCourseJsonLd, jsonLdString } from "@/lib/json-ld";
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

function lessonTypeIcon(type: "VIDEO" | "PDF" | "TEXT") {
  if (type === "VIDEO") return "▶";
  if (type === "PDF") return "📄";
  return "✎";
}

function bullets(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Anonymized author label for reviews when the user has no display name.
 * Returns the local part with the last 4 chars masked, e.g. "alic***".
 */
function initialsFromEmail(email: string | null | undefined): string {
  if (!email) return "Alumno";
  const local = email.split("@")[0] ?? "";
  if (local.length <= 3) return `${local}***`;
  return `${local.slice(0, Math.max(3, local.length - 3))}***`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await db.course.findUnique({
    where: { slug },
    select: { title: true, description: true, coverUrl: true, published: true },
  });
  if (!course || !course.published) return { title: "Curso no encontrado" };
  const description = course.description.slice(0, 160);
  return {
    title: course.title,
    description,
    openGraph: {
      title: course.title,
      description,
      type: "website",
      url: `/cursos/${slug}`,
      // Si el curso tiene portada propia, manda; si no, el opengraph-image.tsx
      // de este segmento genera la tarjeta de marca como fallback.
      images: course.coverUrl ? [{ url: course.coverUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: course.title,
      description,
      images: course.coverUrl ? [course.coverUrl] : undefined,
    },
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
  const audience = bullets(course.targetAudience);
  const learn = bullets(course.whatYouLearn);
  const lessonCount = course.lessons.length;
  const videoCount = course.lessons.filter((l) => l.type === "VIDEO").length;
  const pdfCount = course.lessons.filter((l) => l.type === "PDF").length;

  // Approved reviews + aggregate stats. Computed in JS from a single query
  // (small N) — Postgres aggregates would be overkill until we hit thousands
  // per course.
  const reviews = await db.review.findMany({
    where: { courseId: course.id, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  const reviewCount = reviews.length;
  const reviewAvg =
    reviewCount === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;
  const reviewDist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));

  // CSP nonce for the JSON-LD <script>. Set by src/proxy.ts on every request.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const courseJsonLd = jsonLdString(
    buildCourseJsonLd({
      slug: course.slug,
      title: course.title,
      description: course.description,
      priceCents: course.priceCents,
      currency: course.currency,
      coverUrl: course.coverUrl,
      reviewAvg: reviewCount > 0 ? reviewAvg : undefined,
      reviewCount: reviewCount > 0 ? reviewCount : undefined,
    })
  );

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: courseJsonLd }}
      />
      <PublicHeader />
      <main className="flex-1 px-6 py-12 pb-28 md:pb-12">
        <div className="max-w-5xl mx-auto space-y-12">
          <Link
            href={course.type === "PACK" ? "/packs" : "/cursos"}
            className="text-sm text-neutral-600 hover:text-brand-celeste-deep transition"
          >
            ← Volver a {course.type === "PACK" ? "los packs" : "los cursos"}
          </Link>

          <header className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 items-start">
            <div className="space-y-5">
              <div className="relative">
                {course.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.coverUrl}
                    alt=""
                    className="w-full aspect-[16/9] object-cover rounded-2xl border border-neutral-200 shadow-sm"
                  />
                ) : (
                  <div className="w-full aspect-[16/9] rounded-2xl border border-neutral-200 bg-gradient-to-br from-brand-celeste/20 to-brand-magenta/20" />
                )}
                <CourseBadge badge={course.badge} floating />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {course.title}
              </h1>
              {reviewCount > 0 && (
                <a
                  href="#reseñas"
                  className="inline-flex items-center gap-2 text-sm text-neutral-700 hover:text-brand-celeste-deep transition"
                >
                  <RatingStars value={reviewAvg} size={14} />
                  <span className="font-semibold tabular-nums">
                    {reviewAvg.toFixed(1)}
                  </span>
                  <span className="text-neutral-500">
                    ({reviewCount} reseña{reviewCount === 1 ? "" : "s"})
                  </span>
                </a>
              )}
              <p className="text-neutral-700 leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600 pt-1">
                <Stat label="Lecciones" value={String(lessonCount)} />
                {videoCount > 0 && (
                  <Stat label="Vídeos" value={String(videoCount)} />
                )}
                {pdfCount > 0 && (
                  <Stat label="Materiales" value={String(pdfCount)} />
                )}
                <Stat label="Acceso" value="Ilimitado" />
              </dl>
            </div>

            <aside className="md:sticky md:top-6 hidden md:block space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <PriceBlock
                priceCents={course.priceCents}
                courseId={course.id}
                courseSlug={course.slug}
                enrolled={enrolled}
                stripeReady={stripeReady}
                hasSession={Boolean(session)}
              />
            </aside>
          </header>

          {learn.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Qué vas a aprender
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {learn.map((b, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                  >
                    <span className="size-6 shrink-0 rounded-full bg-brand-celeste/15 text-brand-celeste-deep flex items-center justify-center text-sm font-bold">
                      ✓
                    </span>
                    <span className="text-sm text-neutral-700 leading-relaxed">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {audience.length > 0 && (
            <section className="space-y-4 rounded-2xl bg-gradient-to-br from-brand-celeste/5 to-brand-magenta/5 border border-neutral-200 p-6 md:p-8">
              <h2 className="text-2xl font-bold tracking-tight">
                ¿Para quién es este curso?
              </h2>
              <ul className="space-y-2">
                {audience.map((b, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-neutral-700 leading-relaxed"
                  >
                    <span className="text-brand-magenta-deep font-bold">→</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reviewCount > 0 && (
            <section id="reseñas" className="space-y-6 scroll-mt-20">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight">
                  Lo que dicen los alumnos
                </h2>
                <p className="text-sm text-neutral-500 tabular-nums">
                  {reviewCount} reseña{reviewCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="md:border-r md:border-neutral-200 md:pr-6 text-center md:text-left">
                  <p className="text-5xl font-bold tabular-nums text-brand-celeste-deep">
                    {reviewAvg.toFixed(1)}
                  </p>
                  <RatingStars value={reviewAvg} size={20} />
                  <p className="text-xs text-neutral-500 mt-1">
                    sobre {reviewCount} reseña{reviewCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {reviewDist.map((d) => {
                    const pct = reviewCount === 0 ? 0 : (d.count / reviewCount) * 100;
                    return (
                      <div key={d.stars} className="flex items-center gap-3 text-xs">
                        <span className="w-6 text-neutral-600 tabular-nums">
                          {d.stars}★
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-neutral-500 tabular-nums">
                          {d.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((r) => {
                  const author = r.user.name?.trim() || initialsFromEmail(r.user.email);
                  return (
                    <li
                      key={r.id}
                      className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <RatingStars value={r.rating} size={14} />
                        <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                          {new Intl.DateTimeFormat("es-ES", {
                            month: "short",
                            year: "numeric",
                          }).format(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                        {r.body}
                      </p>
                      <p className="text-xs font-medium text-neutral-500 pt-1">
                        — {author}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Contenido del curso
              </h2>
              <p className="text-sm text-neutral-500 tabular-nums">
                {lessonCount} lección{lessonCount === 1 ? "" : "es"}
              </p>
            </div>
            {lessonCount === 0 ? (
              <p className="text-sm text-neutral-500">
                Aún no hay lecciones publicadas.
              </p>
            ) : (
              <ol className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-200 overflow-hidden">
                {course.lessons.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-sm tabular-nums text-neutral-400 w-6">
                        {l.order}
                      </span>
                      <span className="text-base mr-1">
                        {lessonTypeIcon(l.type)}
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

      {/* Mobile sticky CTA. Hidden on >= md (sidebar takes its place). */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-neutral-200 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">
              Precio
            </p>
            <p className="text-lg font-bold text-brand-celeste-deep tabular-nums leading-tight">
              {formatter.format(course.priceCents / 100)}
            </p>
          </div>
          <MobileCta
            courseId={course.id}
            courseSlug={course.slug}
            enrolled={enrolled}
            stripeReady={stripeReady}
          />
        </div>
      </div>

      <PublicFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-neutral-500">{label}:</dt>
      <dd className="font-semibold text-neutral-800">{value}</dd>
    </div>
  );
}

function PriceBlock({
  priceCents,
  courseId,
  courseSlug,
  enrolled,
  stripeReady,
  hasSession,
}: {
  priceCents: number;
  courseId: string;
  courseSlug: string;
  enrolled: boolean;
  stripeReady: boolean;
  hasSession: boolean;
}) {
  return (
    <>
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Precio</p>
        <p className="text-3xl font-bold text-brand-celeste-deep tabular-nums">
          {formatter.format(priceCents / 100)}
        </p>
      </div>
      {enrolled ? (
        <Link
          href={`/dashboard/cursos/${courseSlug}`}
          className="block w-full text-center rounded-full bg-brand-celeste text-brand-celeste-foreground px-4 py-3 font-semibold hover:bg-brand-celeste-deep transition"
        >
          Ir al curso →
        </Link>
      ) : stripeReady ? (
        <>
          <form action="/api/checkout" method="POST">
            <input type="hidden" name="courseId" value={courseId} />
            <button
              type="submit"
              className="block w-full rounded-full bg-brand-celeste text-brand-celeste-foreground px-4 py-3 font-semibold hover:bg-brand-celeste-deep transition cursor-pointer"
            >
              Comprar curso
            </button>
          </form>
          {!hasSession && (
            <p className="text-xs text-neutral-500 leading-relaxed">
              No necesitas crear cuenta antes — la generamos al completar la compra.
            </p>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            disabled
            className="block w-full rounded-full bg-neutral-200 text-neutral-500 px-4 py-3 font-semibold cursor-not-allowed"
          >
            Comprar (próximamente)
          </button>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Pagos pendientes de activar en este entorno.
          </p>
        </>
      )}
      <ul className="text-xs text-neutral-600 space-y-1.5 pt-2 border-t border-neutral-200">
        <li className="flex gap-2">
          <span className="text-brand-celeste-deep">✓</span>
          <span>Acceso ilimitado</span>
        </li>
        <li className="flex gap-2">
          <span className="text-brand-celeste-deep">✓</span>
          <span>Materiales descargables</span>
        </li>
        <li className="flex gap-2">
          <span className="text-brand-celeste-deep">✓</span>
          <span>Resolución de dudas</span>
        </li>
      </ul>
    </>
  );
}

function MobileCta({
  courseId,
  courseSlug,
  enrolled,
  stripeReady,
}: {
  courseId: string;
  courseSlug: string;
  enrolled: boolean;
  stripeReady: boolean;
}) {
  if (enrolled) {
    return (
      <Link
        href={`/dashboard/cursos/${courseSlug}`}
        className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-5 py-2.5 font-semibold text-sm shrink-0"
      >
        Ir al curso
      </Link>
    );
  }
  if (!stripeReady) {
    return (
      <button
        type="button"
        disabled
        className="rounded-full bg-neutral-200 text-neutral-500 px-5 py-2.5 font-semibold text-sm shrink-0"
      >
        Pronto
      </button>
    );
  }
  return (
    <form action="/api/checkout" method="POST" className="shrink-0">
      <input type="hidden" name="courseId" value={courseId} />
      <button
        type="submit"
        className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-5 py-2.5 font-semibold text-sm cursor-pointer"
      >
        Comprar
      </button>
    </form>
  );
}
