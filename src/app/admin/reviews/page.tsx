import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { RatingStars } from "@/components/rating-stars";
import { ReviewModerationActions } from "./_actions-ui";

export const metadata: Metadata = { title: "Moderación de reseñas" };

const STATUS_LABEL: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_BADGE: Record<"PENDING" | "APPROVED" | "REJECTED", string> = {
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-900",
  REJECTED: "bg-red-100 text-red-900",
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter = ["PENDING", "APPROVED", "REJECTED"].includes(sp.status ?? "")
    ? (sp.status as "PENDING" | "APPROVED" | "REJECTED")
    : "PENDING";

  const [reviews, counts] = await Promise.all([
    db.review.findMany({
      where: { status: filter },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rating: true,
        body: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true, slug: true } },
      },
    }),
    db.review.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus: Record<string, number> = {};
  for (const c of counts) countByStatus[c.status] = c._count._all;

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Moderación de reseñas</h1>
            <p className="text-sm text-neutral-600 mt-1">
              Solo las aprobadas aparecen en la página pública del curso.
            </p>
          </div>
        </header>

        <nav className="flex gap-2 flex-wrap">
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => {
            const active = filter === s;
            return (
              <Link
                key={s}
                href={`/admin/reviews?status=${s}`}
                className={
                  "rounded-full px-4 py-1.5 text-sm font-medium transition border " +
                  (active
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white border-neutral-200 hover:border-neutral-400")
                }
              >
                {STATUS_LABEL[s]}{" "}
                <span className="ml-1 text-xs opacity-70 tabular-nums">
                  {countByStatus[s] ?? 0}
                </span>
              </Link>
            );
          })}
        </nav>

        {reviews.length === 0 ? (
          <p className="text-sm text-neutral-500 italic">
            No hay reseñas en esta categoría.
          </p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="space-y-1">
                    <Link
                      href={`/cursos/${r.course.slug}`}
                      className="font-semibold hover:text-brand-celeste-deep transition"
                    >
                      {r.course.title}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {r.user.name?.trim() || r.user.email} ·{" "}
                      {new Intl.DateTimeFormat("es-ES", {
                        dateStyle: "medium",
                      }).format(r.createdAt)}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full text-[11px] uppercase tracking-wide px-2.5 py-0.5 font-semibold " +
                      STATUS_BADGE[r.status]
                    }
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <RatingStars value={r.rating} size={16} />
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                  {r.body}
                </p>
                <ReviewModerationActions reviewId={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
