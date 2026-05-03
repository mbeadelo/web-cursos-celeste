import { z } from "zod";
import slugify from "slugify";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CourseInputSchema = z
  .object({
    title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
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
  })
  .transform((data) => ({
    ...data,
    slug: data.slug && data.slug.length > 0 ? data.slug : deriveSlug(data.title),
    coverUrl: data.coverUrl && data.coverUrl.length > 0 ? data.coverUrl : null,
  }));

export type CourseInput = z.input<typeof CourseInputSchema>;
export type CourseInputParsed = z.output<typeof CourseInputSchema>;

export function deriveSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: "es" });
}
