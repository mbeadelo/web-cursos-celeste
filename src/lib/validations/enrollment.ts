import { z } from "zod";

export const ManualEnrollmentSchema = z.object({
  email: z
    .string()
    .min(3)
    .email("Email no válido")
    .transform((s) => s.trim().toLowerCase()),
  courseId: z.string().min(1, "Selecciona un curso"),
});

export type ManualEnrollmentInput = z.infer<typeof ManualEnrollmentSchema>;
