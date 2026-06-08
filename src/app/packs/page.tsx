import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";
import { CourseBadge } from "@/components/course-badge";

export const metadata: Metadata = {
  title: "Packs",
  description:
    "Packs de materiales descargables (PDFs) en Bienvenido a tu plaza.",
};

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export default async function PacksPage() {
  const packs = await db.course.findMany({
    where: { published: true, type: "PACK" },
    orderBy: [
      { featuredOrder: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceCents: true,
      coverUrl: true,
      badge: true,
    },
  });

  return (
    <>
      <PublicHeader />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Packs</h1>
            <p className="text-neutral-600">
              {packs.length === 0
                ? "Pronto añadiremos packs de materiales."
                : `${packs.length} pack${packs.length === 1 ? "" : "s"} de materiales descargables.`}
            </p>
          </header>

          {packs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map((c) => (
                <Link
                  key={c.id}
                  href={`/cursos/${c.slug}`}
                  className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste rounded-xl"
                >
                  <Card className="h-full transition group-hover:ring-brand-celeste/40 group-hover:-translate-y-0.5">
                    <div className="relative">
                      {c.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.coverUrl}
                          alt=""
                          className="w-full aspect-[16/9] object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-[16/9] bg-gradient-to-br from-brand-magenta/20 to-brand-celeste/20" />
                      )}
                      <CourseBadge badge={c.badge} floating />
                    </div>
                    <CardContent className="space-y-2">
                      <h2 className="font-semibold text-lg leading-tight">
                        {c.title}
                      </h2>
                      <p className="text-sm text-neutral-600 line-clamp-2">
                        {c.description}
                      </p>
                      <p className="text-sm font-semibold pt-1 text-brand-celeste-deep">
                        {formatter.format(c.priceCents / 100)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
