"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/rich-editor";
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
import {
  createLesson,
  updateLesson,
  requestLessonFileUploadUrl,
} from "./_lessons-actions";

type LessonType = "VIDEO" | "PDF" | "TEXT";

type ExistingLesson = {
  id: string;
  type: LessonType;
  title: string;
  moduleId: string | null;
  muxPlaybackId: string | null;
  fileKey: string | null;
  body: string | null;
};

type Props = {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson?: ExistingLesson;
  /** Modules/fases of the course, for the "Fase" selector. Empty = packs/flat. */
  modules: { id: string; title: string }[];
  /** When true the admin can upload PDFs directly to R2 from the dialog. */
  storageEnabled: boolean;
  /** When true the admin can upload videos directly to Mux from the dialog. */
  muxConfigured: boolean;
  /** When true (packs) only PDF lessons are allowed. */
  pdfOnly?: boolean;
};

const FormSchema = z.object({
  type: z.enum(["VIDEO", "PDF", "TEXT"]),
  title: z.string().trim().min(2, "Mínimo 2 caracteres").max(200),
  moduleId: z.string().optional(),
  muxPlaybackId: z.string().trim().max(200).optional().or(z.literal("")),
  fileKey: z.string().trim().max(500).optional().or(z.literal("")),
  body: z.string().trim().max(20000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof FormSchema>;

export function LessonDialog({
  courseId,
  open,
  onOpenChange,
  lesson,
  modules,
  storageEnabled,
  muxConfigured,
  pdfOnly,
}: Props) {
  const isEdit = !!lesson;
  const [serverError, setServerError] = useState<string | null>(null);
  const defaultType: LessonType = pdfOnly ? "PDF" : "VIDEO";

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
      type: lesson?.type ?? defaultType,
      title: lesson?.title ?? "",
      moduleId: lesson?.moduleId ?? "",
      muxPlaybackId: lesson?.muxPlaybackId ?? "",
      fileKey: lesson?.fileKey ?? "",
      body: lesson?.body ?? "",
    },
  });

  useEffect(() => {
    reset({
      type: lesson?.type ?? defaultType,
      title: lesson?.title ?? "",
      moduleId: lesson?.moduleId ?? "",
      muxPlaybackId: lesson?.muxPlaybackId ?? "",
      fileKey: lesson?.fileKey ?? "",
      body: lesson?.body ?? "",
    });
    setServerError(null);
  }, [lesson, reset, defaultType]);

  const type = watch("type");
  const moduleId = watch("moduleId");
  const fileKey = watch("fileKey");
  const muxPlaybackId = watch("muxPlaybackId");
  const body = watch("body");

  async function onSubmit(values: FormValues) {
    setServerError(null);

    const moduleId = values.moduleId || undefined;
    let payload: LessonInput;
    if (values.type === "VIDEO") {
      payload = {
        type: "VIDEO",
        title: values.title,
        moduleId,
        muxPlaybackId: values.muxPlaybackId ?? "",
      };
    } else if (values.type === "PDF") {
      payload = {
        type: "PDF",
        title: values.title,
        moduleId,
        fileKey: values.fileKey ?? "",
      };
    } else {
      payload = {
        type: "TEXT",
        title: values.title,
        moduleId,
        body: values.body ?? "",
      };
    }

    const parsed = LessonInputSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues.map((i) => i.message).join(" · "));
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
            VIDEO sube directo a Mux. PDF sube a Cloudflare R2. Texto se
            guarda en la base de datos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!pdfOnly && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-type">Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setValue("type", v as LessonType, { shouldDirty: true })
                }
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
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lesson-title">Título</Label>
            <Input id="lesson-title" {...register("title")} placeholder="Introducción" />
            {errors.title && (
              <p className="text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          {modules.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="lesson-module">Fase</Label>
              <Select
                value={moduleId || "none"}
                onValueChange={(v) =>
                  setValue("moduleId", v && v !== "none" ? v : "", {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="lesson-module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin fase</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "VIDEO" && (
            <div className="space-y-1.5">
              <Label>Vídeo</Label>
              {isEdit && muxConfigured ? (
                <VideoUpload
                  lessonId={lesson.id}
                  currentPlaybackId={muxPlaybackId ?? ""}
                />
              ) : isEdit && !muxConfigured ? (
                <p className="text-xs text-neutral-500">
                  Mux no está configurado. Configura las claves para habilitar
                  la subida directa.
                </p>
              ) : (
                <p className="text-xs text-neutral-500">
                  Crea la lección primero — después podrás subir el vídeo
                  desde la pantalla de edición.
                </p>
              )}
              <div className="pt-2">
                <Label htmlFor="lesson-mux" className="text-xs text-neutral-500">
                  Playback ID (avanzado)
                </Label>
                <Input
                  id="lesson-mux"
                  {...register("muxPlaybackId")}
                  placeholder="vS024...XYZ"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Se rellena automáticamente cuando Mux termina de procesar el vídeo.
                </p>
              </div>
            </div>
          )}

          {type === "PDF" && (
            <div className="space-y-1.5">
              <Label>PDF</Label>
              {isEdit ? (
                <PdfUpload
                  lessonId={lesson.id}
                  currentKey={fileKey ?? ""}
                  storageEnabled={storageEnabled}
                  onUploaded={(key) =>
                    setValue("fileKey", key, { shouldDirty: true })
                  }
                />
              ) : (
                <p className="text-xs text-neutral-500">
                  Crea la lección primero — después podrás subir el PDF desde
                  la pantalla de edición.
                </p>
              )}
              <div className="pt-2">
                <Label htmlFor="lesson-key" className="text-xs text-neutral-500">
                  File key (avanzado)
                </Label>
                <Input
                  id="lesson-key"
                  {...register("fileKey")}
                  placeholder="lesson-files/abc/intro.pdf"
                />
              </div>
            </div>
          )}

          {type === "TEXT" && (
            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <RichEditor
                value={body ?? ""}
                onChange={(html) => setValue("body", html, { shouldDirty: true })}
                placeholder="Texto de la lección…"
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

function PdfUpload({
  lessonId,
  currentKey,
  storageEnabled,
  onUploaded,
}: {
  lessonId: string;
  currentKey: string;
  storageEnabled: boolean;
  onUploaded: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<"idle" | "signing" | "uploading">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  if (!storageEnabled) {
    return (
      <p className="text-xs text-neutral-500">
        R2 no está configurado en este entorno.
      </p>
    );
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setProgress("signing");

    const signed = await requestLessonFileUploadUrl({
      lessonId,
      filename: file.name,
      contentType: file.type || "application/pdf",
    });
    if (!signed.ok) {
      setError(signed.error);
      setProgress("idle");
      return;
    }

    setProgress("uploading");
    try {
      const res = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" },
      });
      if (!res.ok) throw new Error(`Upload falló (${res.status})`);
      onUploaded(signed.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo el PDF");
    } finally {
      setProgress("idle");
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileSelected}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== "idle"}
        >
          {progress === "signing" && "Pidiendo URL…"}
          {progress === "uploading" && "Subiendo…"}
          {progress === "idle" && (currentKey ? "Cambiar PDF" : "Subir PDF")}
        </Button>
        {currentKey && (
          <span className="text-xs text-neutral-600 truncate max-w-[280px]">
            ✓ {currentKey.split("/").pop()}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function VideoUpload({
  lessonId,
  currentPlaybackId,
}: {
  lessonId: string;
  currentPlaybackId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<
    "idle" | "signing" | "uploading" | "processing"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setProgress("signing");

    let signed: { uploadUrl: string; uploadId: string };
    try {
      const res = await fetch("/api/mux/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      if (!res.ok) throw new Error(`Mux upload-url falló (${res.status})`);
      signed = await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error pidiendo URL Mux");
      setProgress("idle");
      return;
    }

    setProgress("uploading");
    try {
      const res = await fetch(signed.uploadUrl, {
        method: "PUT",
        body: file,
      });
      if (!res.ok) throw new Error(`Upload falló (${res.status})`);
      setProgress("processing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error subiendo el vídeo");
      setProgress("idle");
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onFileSelected}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== "idle" && progress !== "processing"}
        >
          {progress === "signing" && "Pidiendo URL…"}
          {progress === "uploading" && "Subiendo a Mux…"}
          {progress === "processing" && "Procesando…"}
          {progress === "idle" &&
            (currentPlaybackId ? "Reemplazar vídeo" : "Subir vídeo")}
        </Button>
        {currentPlaybackId && (
          <span className="text-xs text-emerald-700">
            ✓ Vídeo listo ({currentPlaybackId.slice(0, 8)}…)
          </span>
        )}
      </div>
      {progress === "processing" && (
        <p className="text-xs text-amber-700">
          Mux está procesando el vídeo. Cierra el diálogo y vuelve a abrir
          esta lección en unos minutos para ver el playback ID actualizado.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
