"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CoverUpload } from "../courses/_cover-upload";
import { RichEditor } from "@/components/rich-editor";

const FormSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  excerpt: z.string().trim().min(10, "Mínimo 10 caracteres").max(500),
  body: z.string().trim().min(1, "El cuerpo no puede estar vacío"),
  coverUrl: z.string().trim().url("URL no válida").optional().or(z.literal("")),
  published: z.boolean(),
});

type FormValues = z.infer<typeof FormSchema>;

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type Props = {
  initial?: {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    coverUrl: string | null;
    published: boolean;
  };
  action: (input: {
    title: string;
    slug?: string;
    excerpt: string;
    body: string;
    coverUrl?: string;
    published: boolean;
  }) => Promise<ActionResult | void>;
  submitLabel: string;
  storageEnabled: boolean;
};

export function ArticleForm({ initial, action, submitLabel, storageEnabled }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      excerpt: initial?.excerpt ?? "",
      body: initial?.body ?? "",
      coverUrl: initial?.coverUrl ?? "",
      published: initial?.published ?? false,
    },
  });

  const published = watch("published");
  const coverUrl = watch("coverUrl");
  const body = watch("body");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSaved(false);
    const result = await action({
      title: values.title,
      slug: values.slug || undefined,
      excerpt: values.excerpt,
      body: values.body,
      coverUrl: values.coverUrl || undefined,
      published: values.published,
    });
    if (result && result.ok === false) {
      setServerError(result.error);
    } else if (result && result.ok === true) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      <Field label="Título" error={errors.title?.message}>
        <Input {...register("title")} placeholder="Cómo elegir tu primer curso" />
      </Field>

      <Field
        label="Slug (URL)"
        hint="Si lo dejas vacío, se genera del título."
        error={errors.slug?.message}
      >
        <Input
          {...register("slug")}
          placeholder="como-elegir-tu-primer-curso"
        />
      </Field>

      <Field
        label="Resumen"
        hint="Breve descripción que aparece en la lista del blog y en metadatos SEO."
        error={errors.excerpt?.message}
      >
        <Textarea rows={3} {...register("excerpt")} />
      </Field>

      <Field
        label="Portada"
        hint={
          storageEnabled
            ? "Sube una imagen o pega una URL externa."
            : "Pega un enlace a una imagen. La subida directa requiere R2 configurado."
        }
        error={errors.coverUrl?.message}
      >
        <CoverUpload
          value={coverUrl ?? ""}
          onChange={(v) => setValue("coverUrl", v, { shouldDirty: true })}
          storageEnabled={storageEnabled}
        />
      </Field>

      <Field label="Contenido" error={errors.body?.message}>
        <RichEditor
          value={body ?? ""}
          onChange={(html) => setValue("body", html, { shouldDirty: true })}
          placeholder="Escribe el artículo. Usa la barra para formato."
        />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-neutral-200 p-4">
        <div>
          <Label htmlFor="published">Publicado</Label>
          <p className="text-sm text-neutral-600">
            Si está apagado, no aparece en el blog público.
          </p>
        </div>
        <Switch
          id="published"
          checked={published}
          onCheckedChange={(v) => setValue("published", v, { shouldDirty: true })}
        />
      </div>

      {serverError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {serverError}
        </p>
      )}

      {saved && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          Cambios guardados.
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-neutral-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
