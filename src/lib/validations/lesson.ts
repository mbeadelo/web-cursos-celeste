import { z } from "zod";

const baseSchema = z.object({
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
});

export const VideoLessonSchema = baseSchema.extend({
  type: z.literal("VIDEO"),
  muxPlaybackId: z
    .string()
    .trim()
    .min(1, "Pega el playback ID de Mux")
    .max(200),
});

export const PdfLessonSchema = baseSchema.extend({
  type: z.literal("PDF"),
  fileKey: z.string().trim().min(1, "Pega la key del PDF en R2").max(500),
});

export const TextLessonSchema = baseSchema.extend({
  type: z.literal("TEXT"),
  body: z.string().trim().min(1, "Contenido requerido").max(20000),
});

export const LessonInputSchema = z.discriminatedUnion("type", [
  VideoLessonSchema,
  PdfLessonSchema,
  TextLessonSchema,
]);

export type LessonInput = z.infer<typeof LessonInputSchema>;
