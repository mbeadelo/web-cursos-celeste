/**
 * Schema.org JSON-LD builders. Each function returns a plain object that the
 * page renders inside a <script type="application/ld+json"> tag.
 *
 * Google's rich results docs:
 *   https://developers.google.com/search/docs/appearance/structured-data/course
 *   https://developers.google.com/search/docs/appearance/structured-data/article
 *
 * Validate after deploy with https://search.google.com/test/rich-results
 */

const SITE_URL = "https://bienvenidoatuplaza.com";

const ORGANIZATION = {
  "@type": "Organization",
  name: "Bienvenido a tu plaza",
  url: SITE_URL,
} as const;

type CourseInput = {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  coverUrl: string | null;
  reviewAvg?: number;
  reviewCount?: number;
};

/**
 * Course schema — Google requires `provider` + at least one `hasCourseInstance`
 * with `courseMode` and either instructor/location/startDate. We mark the
 * course as on-demand online (no fixed dates).
 */
export function buildCourseJsonLd(course: CourseInput) {
  const url = `${SITE_URL}/cursos/${course.slug}`;
  const offers = {
    "@type": "Offer",
    url,
    price: (course.priceCents / 100).toFixed(2),
    priceCurrency: course.currency.toUpperCase(),
    availability: "https://schema.org/InStock",
    category: "Paid",
  };

  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    url,
    provider: ORGANIZATION,
    offers,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: "PT5H", // ~5h placeholder until lessons carry duration
    },
  };

  if (course.coverUrl) json.image = course.coverUrl;

  if (course.reviewCount && course.reviewCount > 0 && course.reviewAvg) {
    json.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: course.reviewAvg.toFixed(1),
      reviewCount: course.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return json;
}

type ArticleInput = {
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
};

/**
 * Article schema — minimal valid set: headline, datePublished, author.
 * Used for SEO + Google Discover surfacing.
 */
export function buildArticleJsonLd(article: ArticleInput) {
  const url = `${SITE_URL}/articulos/${article.slug}`;
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: url,
    datePublished:
      article.publishedAt?.toISOString() ?? article.updatedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: article.authorName ?? "Bienvenido a tu plaza",
    },
    publisher: ORGANIZATION,
  };

  if (article.coverUrl) json.image = article.coverUrl;

  return json;
}

/**
 * Render-helper: stringifies a JSON-LD object for insertion into a
 * `<script type="application/ld+json">` via dangerouslySetInnerHTML.
 * Escapes `</script>` defensively in case any text field contains it.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
