import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { LEGAL_SLUGS } from "@/lib/legal";

const BASE = "https://bienvenidoatuplaza.com";

// El sitemap es estático por defecto; lo revalidamos cada hora para que los
// artículos programados aparezcan cuando su fecha de publicación llega, sin
// necesidad de un nuevo deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, articles] = await Promise.all([
    db.course.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    }),
    db.article.findMany({
      // Igual que el blog público: solo los ya publicados (fecha pasada).
      where: { published: true, publishedAt: { lte: new Date() } },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/cursos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE}/articulos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  const courseEntries: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${BASE}/cursos/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const articleEntries: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${BASE}/articulos/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const legalEntries: MetadataRoute.Sitemap = LEGAL_SLUGS.map((slug) => ({
    url: `${BASE}/legal/${slug}`,
    lastModified: now,
    changeFrequency: "yearly",
    priority: 0.3,
  }));

  return [...staticEntries, ...courseEntries, ...articleEntries, ...legalEntries];
}
