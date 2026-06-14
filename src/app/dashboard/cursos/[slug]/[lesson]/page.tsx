import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canAccessCourse } from "@/lib/access";
import { signPlaybackTokens, type MuxPlaybackTokens } from "@/lib/mux";
import { lessonHref, lessonSegment, lessonIdFromParam } from "@/lib/lesson-url";
import { VideoPlayer } from "@/components/video-player";
import { MarkLessonComplete } from "@/components/mark-lesson-complete";
import { ReviewForm } from "@/components/review-form";

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

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lesson: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { slug, lesson: lessonParam } = await params;
  const lessonId = lessonIdFromParam(lessonParam);

  // Watermark inputs: email + best-effort IP from request headers.
  const hdrs = await headers();
  const watermarkIp =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    hdrs.get("x-real-ip") ??
    "—";
  const watermarkEmail = session.user.email ?? "—";

  const course = await db.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        select: { id: true, title: true },
      },
      lessons: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          type: true,
          moduleId: true,
          muxPlaybackId: true,
          fileKey: true,
          body: true,
        },
      },
    },
  });
  if (!course) notFound();

  // Admins can preview any course without an Enrollment. `isPreview` is true
  // when an admin views a course they're not enrolled in — used to hide the
  // reviews block (it requires enrollment to post anyway).
  const enrolled = await canAccessCourse(session.user.id, course.id);
  const isAdmin = session.user.role === "ADMIN";
  if (!enrolled && !isAdmin) redirect("/dashboard");
  const isPreview = isAdmin && !enrolled;

  // Resolve the lesson from the path id. Unknown id → bounce to the course
  // entry point, which redirects to the first lesson.
  const active = course.lessons.find((l) => l.id === lessonId) ?? null;
  if (!active) redirect(`/dashboard/cursos/${course.slug}`);

  // Canonical URL: if the cosmetic slug part is stale (lesson renamed, or a
  // hand-typed/garbage slug), 308 to the canonical form so the address bar and
  // shared links stay clean.
  const canonicalSegment = lessonSegment(active);
  if (lessonParam !== canonicalSegment) {
    redirect(`/dashboard/cursos/${course.slug}/${canonicalSegment}`);
  }

  const activeIndex = course.lessons.findIndex((l) => l.id === active.id);
  const prev = activeIndex > 0 ? course.lessons[activeIndex - 1] : null;
  const next =
    activeIndex >= 0 && activeIndex < course.lessons.length - 1
      ? course.lessons[activeIndex + 1]
      : null;

  // Sign Mux tokens only for the active video lesson — keeps the page light
  // (one signing op instead of N) and the token short-lived. Returns null if
  // signing keys aren't configured; the player then plays without a token.
  const activeTokens =
    active.type === "VIDEO" && active.muxPlaybackId
      ? await signPlaybackTokens(active.muxPlaybackId)
      : null;

  // Load all progress rows for this user×course in one query — used for the
  // sidebar checkmarks, the active-lesson resume position, and the course
  // progress bar in the header.
  const progressRows = await db.lessonProgress.findMany({
    where: {
      userId: session.user.id,
      lessonId: { in: course.lessons.map((l) => l.id) },
    },
    select: { lessonId: true, lastSeconds: true, completedAt: true },
  });
  const progressByLesson = new Map(progressRows.map((p) => [p.lessonId, p]));
  const completedCount = progressRows.filter((p) => p.completedAt).length;
  const completionPct =
    course.lessons.length === 0
      ? 0
      : Math.round((completedCount / course.lessons.length) * 100);
  const activeProgress = progressByLesson.get(active.id);
  const activeCompleted = Boolean(activeProgress?.completedAt);
  const activeStartAt = activeProgress?.lastSeconds ?? 0;

  // Existing review by this user for this course (any status). Used to
  // pre-fill the review form so the student can edit instead of stacking new
  // submissions.
  const existingReview = await db.review.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: course.id },
    },
    select: { rating: true, body: true, status: true },
  });

  // Group lessons by module/fase for the sidebar. Loose lessons (moduleId null)
  // render flat — either as the whole list (courses/packs without fases) or
  // under "Otras lecciones" when fases exist.
  const hasModules = course.modules.length > 0;
  const moduleIds = new Set(course.modules.map((m) => m.id));
  const lessonsInModule = (moduleId: string) =>
    course.lessons.filter((l) => l.moduleId === moduleId);
  // Loose = no module OR a module that no longer exists (orphaned). Including the
  // orphan case is essential: otherwise such lessons vanish from the sidebar
  // while still counting toward the progress total, so it never reaches 100%.
  const looseLessons = course.lessons.filter(
    (l) => !l.moduleId || !moduleIds.has(l.moduleId)
  );

  // idx is the position WITHIN its group (fase), so numbering restarts at 1 per
  // fase. Each `.map(renderLesson)` over a fase's lessons passes a fresh index.
  const renderLesson = (l: (typeof course.lessons)[number], idx: number) => {
    const isActive = active.id === l.id;
    const lessonCompleted = Boolean(progressByLesson.get(l.id)?.completedAt);
    return (
      <li key={l.id}>
        <Link
          href={lessonHref(course.slug, l)}
          className={
            "block rounded-lg px-3 py-2.5 transition border " +
            (isActive
              ? "bg-brand-celeste/10 border-brand-celeste/40 text-brand-celeste-deep"
              : "bg-white border-transparent hover:border-neutral-200 hover:bg-neutral-50")
          }
        >
          <div className="flex items-start gap-3">
            <span
              className={
                "mt-0.5 w-5 shrink-0 inline-flex items-center justify-center text-xs tabular-nums " +
                (lessonCompleted
                  ? "size-5 rounded-full bg-brand-celeste/20 text-brand-celeste-deep font-bold"
                  : "text-neutral-400")
              }
              aria-label={lessonCompleted ? "Lección completada" : undefined}
            >
              {lessonCompleted ? "✓" : idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={
                  "text-sm leading-snug " +
                  (isActive ? "font-semibold" : "font-medium")
                }
              >
                {l.title}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 mt-0.5">
                <span className="mr-1">{lessonTypeIcon(l.type)}</span>
                {lessonTypeLabel[l.type]}
              </p>
            </div>
          </div>
        </Link>
      </li>
    );
  };

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
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {course.title}
            </h1>
            <p className="text-sm text-neutral-500">
              {completedCount} / {course.lessons.length} completadas
            </p>
          </div>
          {course.lessons.length > 0 && (
            <div
              className="mt-3 h-1.5 rounded-full bg-neutral-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={completionPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso del curso"
            >
              <div
                className="h-full bg-gradient-to-r from-brand-celeste to-brand-magenta transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="lg:sticky lg:top-6 lg:self-start space-y-2">
          <p className="text-xs uppercase tracking-wide text-neutral-500 px-2">
            Contenido
          </p>
          {course.lessons.length === 0 ? (
            <p className="text-sm text-neutral-500 px-2">
              Aún no hay lecciones publicadas.
            </p>
          ) : hasModules ? (
            <div className="space-y-4">
              {course.modules.map((m) => {
                const ls = lessonsInModule(m.id);
                if (ls.length === 0) return null;
                return (
                  <div key={m.id} className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-700 px-2 pt-1">
                      {m.title}
                    </p>
                    <ol className="space-y-1">{ls.map(renderLesson)}</ol>
                  </div>
                );
              })}
              {looseLessons.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-neutral-500 px-2 pt-1">
                    Otras lecciones
                  </p>
                  <ol className="space-y-1">{looseLessons.map(renderLesson)}</ol>
                </div>
              )}
            </div>
          ) : (
            <ol className="space-y-1">{course.lessons.map(renderLesson)}</ol>
          )}
        </aside>

        <section className="min-w-0 space-y-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-brand-magenta-deep font-semibold">
              Lección {active.order} · {lessonTypeLabel[active.type]}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              {active.title}
            </h2>
          </header>

          <LessonBody
            lesson={active}
            watermarkEmail={watermarkEmail}
            watermarkIp={watermarkIp}
            tokens={activeTokens}
            startAt={activeStartAt}
          />

          {/* Manual completion toggle. Video lessons auto-complete at 95%
              via the player; PDF/TEXT need this button. We render it for
              all types so video viewers can also mark/unmark explicitly. */}
          <div className="flex items-center justify-end pt-2">
            <MarkLessonComplete
              lessonId={active.id}
              initialCompleted={activeCompleted}
            />
          </div>

          <footer className="flex items-center justify-between gap-3 pt-4 border-t border-neutral-200">
            {prev ? (
              <Link
                href={lessonHref(course.slug, prev)}
                className="text-sm text-neutral-700 hover:text-brand-celeste-deep transition"
              >
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={lessonHref(course.slug, next)}
                className="text-sm font-medium text-brand-celeste-deep hover:text-brand-magenta transition"
              >
                {next.title} →
              </Link>
            ) : (
              <span className="text-sm text-neutral-500">Última lección</span>
            )}
          </footer>

          {/* Reviews hidden in admin preview — it's the last section, so
              not rendering it doesn't shift anything above. */}
          {!isPreview && (
            <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 space-y-3">
              <header className="space-y-1">
                <h3 className="text-lg font-semibold">
                  {existingReview ? "Tu reseña" : "Cuenta tu experiencia"}
                </h3>
                <p className="text-sm text-neutral-600">
                  Tu valoración ayuda a otros alumnos a decidir. La publicaremos
                  cuando la moderemos.
                </p>
              </header>
              <ReviewForm
                courseId={course.id}
                initial={existingReview ?? undefined}
              />
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

type Lesson = {
  id: string;
  order: number;
  title: string;
  type: "VIDEO" | "PDF" | "TEXT";
  muxPlaybackId: string | null;
  fileKey: string | null;
  body: string | null;
};

function LessonBody({
  lesson,
  watermarkEmail,
  watermarkIp,
  tokens,
  startAt,
}: {
  lesson: Lesson;
  watermarkEmail: string;
  watermarkIp: string;
  tokens: MuxPlaybackTokens | null;
  startAt: number;
}) {
  if (lesson.type === "VIDEO") {
    if (lesson.muxPlaybackId) {
      // Sticky on desktop: as the student scrolls through the lesson (mark
      // complete, prev/next, reviews) the player stays pinned and follows them
      // down. Plain CSS sticky — no scroll listeners. Off on mobile, where a
      // pinned video would eat most of the small screen.
      return (
        <div className="lg:sticky lg:top-6 lg:z-20">
          <VideoPlayer
            playbackId={lesson.muxPlaybackId}
            watermarkEmail={watermarkEmail}
            watermarkIp={watermarkIp}
            title={lesson.title}
            tokens={tokens ?? undefined}
            lessonId={lesson.id}
            startAt={startAt}
          />
        </div>
      );
    }
    return (
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-700 aspect-video flex items-center justify-center text-center p-8">
        <div className="space-y-2 text-white">
          <p className="text-4xl">▶</p>
          <p className="font-medium">Vídeo en preparación</p>
          <p className="text-sm text-white/70 max-w-md">
            El admin todavía no ha subido el vídeo de esta lección o aún se está
            procesando en Mux.
          </p>
        </div>
      </div>
    );
  }

  if (lesson.type === "PDF") {
    if (!lesson.fileKey) {
      return (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-neutral-700 font-medium">PDF pendiente de subir</p>
          <p className="text-sm text-neutral-500 mt-1">
            El admin aún no ha asociado un archivo a esta lección.
          </p>
        </div>
      );
    }
    // Served through our gated route (Enrollment-checked + per-student
    // watermark), never a public R2 URL. The viewer is a same-origin iframe
    // (allowed by frame-src 'self'); the download link forces an attachment.
    const fileUrl = `/api/lessons/${lesson.id}/file`;
    return (
      <div className="space-y-3">
        <div className="rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100">
          <iframe src={fileUrl} title={lesson.title} className="w-full h-[78vh]" />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-neutral-500">
            📄 Documento con tu marca de agua personal. No lo compartas.
          </p>
          <a
            href={`${fileUrl}?download=1`}
            className="inline-block rounded-full bg-brand-celeste text-brand-celeste-foreground px-5 py-2.5 font-medium hover:bg-brand-celeste-deep transition"
          >
            Descargar PDF
          </a>
        </div>
      </div>
    );
  }

  // TEXT — body is HTML sanitized at save time (src/lib/html.ts) from TipTap.
  return (
    <article className="rounded-2xl bg-white border border-neutral-200 p-6 md:p-10">
      {lesson.body ? (
        <div
          className="prose prose-neutral max-w-none prose-a:text-brand-celeste-deep hover:prose-a:text-brand-magenta"
          dangerouslySetInnerHTML={{ __html: lesson.body }}
        />
      ) : (
        <p className="text-neutral-500 italic">
          Esta lección aún no tiene texto.
        </p>
      )}
    </article>
  );
}
