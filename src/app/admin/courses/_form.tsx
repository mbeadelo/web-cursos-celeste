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

// Schema for the form input (before transform). priceCents is a string in the
// form (input type=number returns string in HTML), we coerce.
const FormSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
  slug: z.string().trim().max(100).optional().or(z.literal("")),
  description: z.string().trim().min(1, "Descripción requerida").max(5000),
  priceEuros: z
    .string()
    .min(1, "Requerido")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, "Debe ser un número >= 0"),
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
    description: string;
    priceCents: number;
    coverUrl: string | null;
    published: boolean;
  };
  action: (input: {
    title: string;
    slug?: string;
    description: string;
    priceCents: number;
    currency?: string;
    coverUrl?: string;
    published: boolean;
  }) => Promise<ActionResult | void>;
  submitLabel: string;
};

export function CourseForm({ initial, action, submitLabel }: Props) {
  const [serverError, setServerError] = useState<string | null>(null);

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
      description: initial?.description ?? "",
      priceEuros: initial ? (initial.priceCents / 100).toFixed(2) : "",
      coverUrl: initial?.coverUrl ?? "",
      published: initial?.published ?? false,
    },
  });

  const published = watch("published");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const priceCents = Math.round(Number(values.priceEuros) * 100);
    const result = await action({
      title: values.title,
      slug: values.slug || undefined,
      description: values.description,
      priceCents,
      coverUrl: values.coverUrl || undefined,
      published: values.published,
    });
    if (result && result.ok === false) {
      setServerError(result.error);
    }
    // On success the action redirects; nothing to do here.
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <Field label="Título" error={errors.title?.message}>
        <Input {...register("title")} placeholder="Marketing digital para principiantes" />
      </Field>

      <Field
        label="Slug (URL)"
        hint="Si lo dejas vacío, se genera del título."
        error={errors.slug?.message}
      >
        <Input {...register("slug")} placeholder="marketing-digital-principiantes" />
      </Field>

      <Field label="Descripción" error={errors.description?.message}>
        <Textarea rows={6} {...register("description")} />
      </Field>

      <Field
        label="Precio (€)"
        hint="Se guarda internamente en céntimos."
        error={errors.priceEuros?.message}
      >
        <Input
          type="number"
          step="0.01"
          min="0"
          {...register("priceEuros")}
          placeholder="49.00"
        />
      </Field>

      <Field
        label="URL de portada"
        hint="Pega un enlace a una imagen. En Fase 2b se sustituirá por subida directa."
        error={errors.coverUrl?.message}
      >
        <Input {...register("coverUrl")} placeholder="https://..." />
      </Field>

      <div className="flex items-center justify-between rounded-md border border-neutral-200 p-4">
        <div>
          <Label htmlFor="published">Publicado</Label>
          <p className="text-sm text-neutral-600">
            Si está apagado, no aparece en el catálogo público.
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
