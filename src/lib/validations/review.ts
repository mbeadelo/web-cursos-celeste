import { z } from "zod";

export const ReviewInputSchema = z.object({
  courseId: z.string().min(1),
  rating: z
    .number({ message: "Valoración requerida" })
    .int()
    .min(1, "Mínimo 1 estrella")
    .max(5, "Máximo 5 estrellas"),
  body: z
    .string()
    .trim()
    .min(20, "Cuéntanos un poco más (mín. 20 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
});

export type ReviewInput = z.input<typeof ReviewInputSchema>;

export const ReviewModerationSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
});
