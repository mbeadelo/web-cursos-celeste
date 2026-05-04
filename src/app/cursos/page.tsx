import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cursos",
  description: "Catálogo de cursos online en Bienvenido a tu plaza.",
};

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export default async function CursosPage() {
  const courses = await db.course.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceCents: true,
      coverUrl: true,
    },
  });

  return (
    <>
      <PublicHeader />
      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Cursos</h1>
            <p className="text-neutral-600">
              {courses.length === 0
                ? "Pronto añadiremos cursos."
                : `${courses.length} curso${courses.length === 1 ? "" : "s"} disponible${courses.length === 1 ? "" : "s"}.`}
            </p>
          </header>

          {courses.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/cursos/${c.slug}`}
                  className="group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste rounded-xl"
                >
                  <Card className="h-full transition group-hover:ring-brand-celeste/40 group-hover:-translate-y-0.5">
                    {c.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.coverUrl}
                        alt=""
                        className="w-full aspect-[16/9] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[16/9] bg-gradient-to-br from-brand-celeste/20 to-brand-magenta/20" />
                    )}
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
