import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { Card, CardContent } from "@/components/ui/card";
import { estimateReadingTimeMinutes } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Artículos sobre los temas que tratamos en los cursos. Aprende sin comprar nada, completamente gratis.",
  openGraph: {
    title: "Blog · Bienvenido a tu plaza",
    description:
      "Artículos sobre los temas que tratamos en los cursos. Aprende sin comprar nada, completamente gratis.",
    url: "/articulos",
  },
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "long",
});

export default async function ArticlesIndex() {
  const articles = await db.article.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverUrl: true,
      publishedAt: true,
      body: true, // for reading time estimate
    },
  });

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        <div className="border-b border-neutral-200 bg-gradient-to-b from-brand-celeste/8 to-white">
          <div className="max-w-5xl mx-auto px-6 py-14 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
              Blog · Bienvenido a tu plaza
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Aprende, lee, vuelve.
            </h1>
            <p className="text-neutral-600 max-w-2xl leading-relaxed pt-2">
              Reflexiones, guías y notas sueltas sobre lo que enseñamos en los
              cursos. Material abierto, gratis, para masticar a tu ritmo.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-12">
          {articles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center">
              <p className="text-neutral-700 font-medium">
                Aún no hay artículos publicados.
              </p>
              <p className="text-sm text-neutral-500 mt-1">
                Vuelve pronto — estamos preparando contenido.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/articulos/${a.slug}`}
                  className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-celeste rounded-xl"
                >
                  <Card className="md:grid md:grid-cols-[280px_1fr] md:gap-6 overflow-hidden transition group-hover:ring-brand-celeste/40">
                    <div className="aspect-[16/9] md:aspect-auto md:h-full overflow-hidden bg-neutral-100">
                      {a.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.coverUrl}
                          alt=""
                          className="w-full h-full object-cover transition group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-celeste/20 to-brand-magenta/20" />
                      )}
                    </div>
                    <CardContent className="space-y-2 py-4">
                      <p className="text-xs uppercase tracking-wide text-brand-magenta-deep font-semibold">
                        {a.publishedAt
                          ? dateFormatter.format(a.publishedAt)
                          : "Borrador"}
                        {" · "}
                        {estimateReadingTimeMinutes(a.body)} min lectura
                      </p>
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight leading-tight">
                        {a.title}
                      </h2>
                      <p className="text-neutral-600 leading-relaxed line-clamp-3">
                        {a.excerpt}
                      </p>
                      <p className="pt-2 text-sm font-medium text-brand-celeste-deep group-hover:text-brand-magenta transition">
                        Leer →
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
