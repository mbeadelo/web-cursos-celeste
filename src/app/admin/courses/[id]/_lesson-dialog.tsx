"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LessonInputSchema, type LessonInput } from "@/lib/validations/lesson";
import { createLesson, updateLesson } from "./_lessons-actions";

type LessonType = "VIDEO" | "PDF" | "TEXT";

type ExistingLesson = {
  id: string;
  type: LessonType;
  title: string;
  muxPlaybackId: string | null;
  fileKey: string | null;
  body: string | null;
};

type Props = {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: ExistingLesson; // if present → edit mode
};

// Single union schema we resolve in the form. We carry all fields and trust
// the discriminated union to validate the relevant ones depending on type.
const FormSchema = z.object({
  type: z.enum(["VIDEO", "PDF", "TEXT"]),
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  muxPlaybackId: z.string().trim().max(200).optional().or(z.literal("")),
  fileKey: z.string().trim().max(500).optional().or(z.literal("")),
  body: z.string().trim().max(20000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof FormSchema>;

export function LessonDialog({ courseId, open, onOpenChange, lesson }: Props) {
  const isEdit = !!lesson;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      type: lesson?.type ?? "VIDEO",
      title: lesson?.title ?? "",
      muxPlaybackId: lesson?.muxPlaybackId ?? "",
      fileKey: lesson?.fileKey ?? "",
      body: lesson?.body ?? "",
    },
  });

  // Re-sync defaults when the lesson prop changes (e.g. switching from add to edit).
  useEffect(() => {
    reset({
      type: lesson?.type ?? "VIDEO",
      title: lesson?.title ?? "",
      muxPlaybackId: lesson?.muxPlaybackId ?? "",
      fileKey: lesson?.fileKey ?? "",
      body: lesson?.body ?? "",
    });
    setServerError(null);
  }, [lesson, reset]);

  const type = watch("type");

  async function onSubmit(values: FormValues) {
    setServerError(null);

    let payload: LessonInput;
    if (values.type === "VIDEO") {
      payload = {
        type: "VIDEO",
        title: values.title,
        muxPlaybackId: values.muxPlaybackId ?? "",
      };
    } else if (values.type === "PDF") {
      payload = {
        type: "PDF",
        title: values.title,
        fileKey: values.fileKey ?? "",
      };
    } else {
      payload = {
        type: "TEXT",
        title: values.title,
        body: values.body ?? "",
      };
    }

    // Surface field-level errors from the discriminated-union schema before
    // hitting the server.
    const parsed = LessonInputSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(
        parsed.error.issues.map((i) => i.message).join(" · ")
      );
      return;
    }

    const result = isEdit
      ? await updateLesson(lesson.id, parsed.data)
      : await createLesson(courseId, parsed.data);

    if (result.ok) {
      onOpenChange(false);
    } else {
      setServerError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lección" : "Nueva lección"}</DialogTitle>
          <DialogDescription>
            VIDEO, PDF o TEXTO. Los uploads reales se conectan en Fase 2b.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lesson-type">Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => setValue("type", v as LessonType, { shouldDirty: true })}
            >
              <SelectTrigger id="lesson-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIDEO">Vídeo</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="TEXT">Texto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Título</Label>
            <Input id="lesson-title" {...register("title")} placeholder="Introducción" />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          {type === "VIDEO" && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-mux">Mux playback ID</Label>
              <Input
                id="lesson-mux"
                {...register("muxPlaybackId")}
                placeholder="vS024...XYZ"
              />
              <p className="text-xs text-neutral-500">
                Pega el playback ID del vídeo subido a Mux. La subida directa llega en Fase 4.
              </p>
            </div>
          )}

          {type === "PDF" && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-key">File key (R2)</Label>
              <Input
                id="lesson-key"
                {...register("fileKey")}
                placeholder="cursos/123/intro.pdf"
              />
              <p className="text-xs text-neutral-500">
                Pega la key del PDF en R2. La subida directa llega en Fase 2b.
              </p>
            </div>
          )}

          {type === "TEXT" && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-body">Contenido</Label>
              <Textarea
                id="lesson-body"
                rows={8}
                {...register("body")}
                placeholder="Markdown..."
              />
            </div>
          )}

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {serverError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear lección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
