import Link from "next/link";
import { db } from "@/lib/db";
import { CourseBadge } from "@/components/course-badge";

type Badge = "BESTSELLER" | "NEW" | "COMING_SOON";

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

type Card = {
  href: string;
  title: string;
  description: string;
  priceCents: number;
  coverUrl: string | null;
  badge: Badge | null;
};

export async function FeaturedCourses({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const real = await db.course.findMany({
    where: { published: true, type: "COURSE" },
    orderBy: [
      { featuredOrder: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 8,
    select: {
      slug: true,
      title: true,
      description: true,
      priceCents: true,
      coverUrl: true,
      badge: true,
    },
  });

  const cards: Card[] = real.map((c) => ({
    href: `/cursos/${c.slug}`,
    title: c.title,
    description: c.description,
    priceCents: c.priceCents,
    coverUrl: c.coverUrl,
    badge: c.badge,
  }));

  // No published courses yet → gentle placeholder instead of an empty carousel.
  if (cards.length === 0) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-neutral-600 mt-1">
            Estamos preparando los primeros cursos. Vuelve pronto.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            {title}
          </h2>
          <p className="text-neutral-600 mt-1">{subtitle}</p>
        </div>
        <Link
          href="/cursos"
          className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-brand-celeste-deep hover:text-brand-magenta transition"
        >
          Ver todo →
        </Link>
      </div>

      <div
        className="
          flex gap-5 overflow-x-auto pb-4 -mx-6 px-6
          snap-x snap-mandatory
          [scrollbar-width:thin]
          [&::-webkit-scrollbar]:h-1.5
          [&::-webkit-scrollbar-thumb]:bg-neutral-300
          [&::-webkit-scrollbar-thumb]:rounded-full
        "
      >
        {cards.map((c, idx) => (
          <Link
            key={`${c.title}-${idx}`}
            href={c.href}
            className="group snap-start shrink-0 w-72 sm:w-80 rounded-xl bg-white ring-1 ring-foreground/10 overflow-hidden transition hover:ring-brand-celeste/50 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste"
          >
            <div className="relative aspect-[16/9] overflow-hidden">
              {c.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.coverUrl}
                  alt=""
                  className="w-full h-full object-cover transition group-hover:scale-[1.03]"
                />
              ) : (
                <div
                  aria-hidden
                  className="w-full h-full bg-gradient-to-br from-brand-celeste/30 to-brand-magenta/30"
                />
              )}
              <CourseBadge badge={c.badge} floating />
            </div>
            <div className="p-4 space-y-1.5">
              <h3 className="font-semibold leading-tight line-clamp-2">
                {c.title}
              </h3>
              <p className="text-sm text-neutral-600 line-clamp-2">
                {c.description}
              </p>
              <p className="pt-1 text-sm font-semibold text-brand-celeste-deep">
                {formatter.format(c.priceCents / 100)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/cursos"
        className="sm:hidden inline-flex items-center gap-1 text-sm font-medium text-brand-celeste-deep hover:text-brand-magenta transition"
      >
        Ver todo el catálogo →
      </Link>
    </section>
  );
}
