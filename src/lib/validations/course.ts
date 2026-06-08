import { z } from "zod";
import slugify from "slugify";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CourseBadgeEnum = z.enum(["BESTSELLER", "NEW", "COMING_SOON"]);
export const CourseTypeEnum = z.enum(["COURSE", "PACK"]);

export const CourseInputSchema = z
  .object({
    title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
    // COURSE (default) or PACK (bundle of PDFs). Drives admin UI, public
    // section (/cursos vs /packs) and student rendering.
    type: CourseTypeEnum.default("COURSE"),
    slug: z
      .string()
      .trim()
      .regex(slugRegex, "Solo minúsculas, números y guiones")
      .max(100)
      .optional()
      .or(z.literal("")),
    description: z.string().trim().min(1, "Descripción requerida").max(5000),
    priceCents: z
      .number({ message: "Precio en céntimos" })
      .int("Debe ser entero (céntimos)")
      .nonnegative("No puede ser negativo")
      .max(1_000_000, "Máximo 10.000€"),
    currency: z.string().trim().toLowerCase().default("eur"),
    coverUrl: z
      .string()
      .trim()
      .url("URL no válida")
      .optional()
      .or(z.literal("")),
    published: z.boolean().default(false),
    badge: CourseBadgeEnum.optional().nullable(),
    featuredOrder: z
      .number()
      .int("Debe ser un entero")
      .min(0, "No puede ser negativo")
      .max(9999, "Demasiado grande")
      .optional()
      .nullable(),
    targetAudience: z.string().trim().max(2000).optional().nullable(),
    whatYouLearn: z.string().trim().max(2000).optional().nullable(),
  })
  .transform((data) => ({
    ...data,
    slug: data.slug && data.slug.length > 0 ? data.slug : deriveSlug(data.title),
    coverUrl: data.coverUrl && data.coverUrl.length > 0 ? data.coverUrl : null,
    badge: data.badge ?? null,
    featuredOrder: data.featuredOrder ?? null,
    targetAudience:
      data.targetAudience && data.targetAudience.length > 0
        ? data.targetAudience
        : null,
    whatYouLearn:
      data.whatYouLearn && data.whatYouLearn.length > 0 ? data.whatYouLearn : null,
  }));

export type CourseInput = z.input<typeof CourseInputSchema>;
export type CourseInputParsed = z.output<typeof CourseInputSchema>;

export function deriveSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: "es" });
}
