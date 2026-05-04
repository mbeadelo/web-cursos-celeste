import { z } from "zod";
import slugify from "slugify";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ArticleInputSchema = z
  .object({
    title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
    slug: z
      .string()
      .trim()
      .regex(slugRegex, "Solo minúsculas, números y guiones")
      .max(120)
      .optional()
      .or(z.literal("")),
    excerpt: z.string().trim().min(10, "Mínimo 10 caracteres").max(500),
    body: z.string().trim().min(1, "El cuerpo no puede estar vacío"),
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
    slug:
      data.slug && data.slug.length > 0 ? data.slug : deriveSlug(data.title),
    coverUrl: data.coverUrl && data.coverUrl.length > 0 ? data.coverUrl : null,
  }));

export type ArticleInput = z.input<typeof ArticleInputSchema>;
export type ArticleInputParsed = z.output<typeof ArticleInputSchema>;

export function deriveSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: "es" });
}
