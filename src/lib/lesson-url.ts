import slugify from "slugify";

/**
 * Pretty, shareable URLs for lessons inside the student dashboard.
 *
 * Shape: `/dashboard/cursos/<courseSlug>/<title-slug>-<lessonId>`
 *
 * The trailing lesson id (a Prisma `cuid`) is the REAL lookup key; the title
 * slug in front is purely cosmetic. This means:
 *   - no DB schema change (we already have the id),
 *   - URLs stay stable when lessons are reordered (unlike a position number),
 *   - renaming a lesson changes the cosmetic part but old links still resolve
 *     (we look up by id and 308-redirect to the canonical form).
 *
 * Robust parsing relies on cuids containing NO hyphens, so the id is always the
 * segment after the LAST hyphen. (Prisma `@default(cuid())` — see schema.)
 */

/** Cosmetic, descriptive slug from a lesson title. Capped for tidy URLs. */
export function lessonTitleSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: "es" }).slice(0, 80);
}

/** Canonical pretty path for a lesson. */
export function lessonHref(
  courseSlug: string,
  lesson: { id: string; title: string }
): string {
  const slug = lessonTitleSlug(lesson.title);
  const tail = slug ? `${slug}-${lesson.id}` : lesson.id;
  return `/dashboard/cursos/${courseSlug}/${tail}`;
}

/** The canonical `[lesson]` segment for a lesson (the part after the course). */
export function lessonSegment(lesson: { id: string; title: string }): string {
  const slug = lessonTitleSlug(lesson.title);
  return slug ? `${slug}-${lesson.id}` : lesson.id;
}

/** Extract the lesson id from a `[lesson]` route segment. */
export function lessonIdFromParam(param: string): string {
  const i = param.lastIndexOf("-");
  return i === -1 ? param : param.slice(i + 1);
}
