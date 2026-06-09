import { z } from "zod";

const baseSchema = z.object({
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  // Optional module/fase to group the lesson under. Empty string / undefined
  // means "sin fase" (loose lesson). Normalised to null in the action.
  moduleId: z.string().trim().max(50).optional(),
});

export const VideoLessonSchema = baseSchema.extend({
  type: z.literal("VIDEO"),
  // Both optional: a video lesson can be created with the upload just started
  // (muxUploadId) — or even empty — and the webhook fills muxPlaybackId later,
  // matching the lesson by muxUploadId. No need to paste an id by hand.
  muxUploadId: z.string().trim().max(200).optional(),
  muxPlaybackId: z.string().trim().max(200).optional(),
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
