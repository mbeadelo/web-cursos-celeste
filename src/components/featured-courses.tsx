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
  coverUrl: string;
  isDemo: boolean;
  badge: Badge | null;
};

const demos: Card[] = [
  {
    href: "/cursos",
    title: "Curso de demostración 1",
    description: "Un curso de ejemplo mientras se publica el catálogo real.",
    priceCents: 4900,
    coverUrl: "/demo/course-1.jpg",
    isDemo: true,
    badge: null,
  },
  {
    href: "/cursos",
    title: "Curso de demostración 2",
    description: "Lecciones grabadas y material descargable para practicar.",
    priceCents: 6900,
    coverUrl: "/demo/course-2.jpg",
    isDemo: true,
    badge: null,
  },
  {
    href: "/cursos",
    title: "Curso de demostración 3",
    description: "Aprende paso a paso a tu propio ritmo, con acceso ilimitado.",
    priceCents: 8900,
    coverUrl: "/demo/course-3.jpg",
    isDemo: true,
    badge: null,
  },
  {
    href: "/cursos",
    title: "Curso de demostración 4",
    description: "Contenido directo y aplicable. Sin relleno.",
    priceCents: 5900,
    coverUrl: "/demo/course-4.jpg",
    isDemo: true,
    badge: null,
  },
  {
    href: "/cursos",
    title: "Curso de demostración 5",
    description: "Diseñado para quienes empiezan, útil también si ya tienes base.",
    priceCents: 7900,
    coverUrl: "/demo/course-5.jpg",
    isDemo: true,
    badge: null,
  },
  {
    href: "/cursos",
    title: "Curso de demostración 6",
    description: "Comunidad activa y resolución de dudas semanales.",
    priceCents: 9900,
    coverUrl: "/demo/course-6.jpg",
    isDemo: true,
    badge: null,
  },
];

export async function FeaturedCourses() {
  const real = await db.course.findMany({
    where: { published: true },
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
    coverUrl: c.coverUrl ?? "/demo/course-1.jpg",
    isDemo: false,
    badge: c.badge,
  }));

  // Fill with demos so the carousel always feels populated.
  const filled = [...cards, ...demos.slice(0, Math.max(0, 6 - cards.length))];

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Cursos destacados
          </h2>
          <p className="text-neutral-600 mt-1">
            Lo más buscado por la comunidad. Desliza para ver más.
          </p>
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
        {filled.map((c, idx) => (
          <Link
            key={`${c.title}-${idx}`}
            href={c.href}
            className="group snap-start shrink-0 w-72 sm:w-80 rounded-xl bg-white ring-1 ring-foreground/10 overflow-hidden transition hover:ring-brand-celeste/50 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste"
          >
            <div className="relative aspect-[16/9] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.coverUrl}
                alt=""
                className="w-full h-full object-cover transition group-hover:scale-[1.03]"
              />
              {c.isDemo ? (
                <span className="absolute top-2 left-2 rounded-full bg-white/90 backdrop-blur text-[10px] uppercase tracking-wide px-2 py-0.5 text-neutral-700">
                  Demo
                </span>
              ) : (
                <CourseBadge badge={c.badge} floating />
              )}
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
