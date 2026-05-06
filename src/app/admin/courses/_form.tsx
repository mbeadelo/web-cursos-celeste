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
import { CoverUpload } from "./_cover-upload";

// Schema for the form input (before transform). priceCents is a string in the
// form (input type=number returns string in HTML), we coerce.
const BadgeFormEnum = z.enum(["", "BESTSELLER", "NEW", "COMING_SOON"]);

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
  badge: BadgeFormEnum,
  featuredOrder: z
    .string()
    .refine(
      (v) => v === "" || (!Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0),
      "Entero >= 0 o vacío"
    ),
  targetAudience: z.string().max(2000).optional(),
  whatYouLearn: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type CourseBadge = "BESTSELLER" | "NEW" | "COMING_SOON";

type Props = {
  initial?: {
    title: string;
    slug: string;
    description: string;
    priceCents: number;
    coverUrl: string | null;
    published: boolean;
    badge: CourseBadge | null;
    featuredOrder: number | null;
    targetAudience: string | null;
    whatYouLearn: string | null;
  };
  action: (input: {
    title: string;
    slug?: string;
    description: string;
    priceCents: number;
    currency?: string;
    coverUrl?: string;
    published: boolean;
    badge?: CourseBadge | null;
    featuredOrder?: number | null;
    targetAudience?: string | null;
    whatYouLearn?: string | null;
  }) => Promise<ActionResult | void>;
  submitLabel: string;
  storageEnabled: boolean;
};

export function CourseForm({ initial, action, submitLabel, storageEnabled }: Props) {
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
      description: initial?.description ?? "",
      priceEuros: initial ? (initial.priceCents / 100).toFixed(2) : "",
      coverUrl: initial?.coverUrl ?? "",
      published: initial?.published ?? false,
      badge: (initial?.badge ?? "") as FormValues["badge"],
      featuredOrder:
        initial?.featuredOrder != null ? String(initial.featuredOrder) : "",
      targetAudience: initial?.targetAudience ?? "",
      whatYouLearn: initial?.whatYouLearn ?? "",
    },
  });

  const published = watch("published");
  const coverUrl = watch("coverUrl");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSaved(false);
    const priceCents = Math.round(Number(values.priceEuros) * 100);
    const result = await action({
      title: values.title,
      slug: values.slug || undefined,
      description: values.description,
      priceCents,
      coverUrl: values.coverUrl || undefined,
      published: values.published,
      badge: values.badge === "" ? null : (values.badge as CourseBadge),
      featuredOrder: values.featuredOrder === "" ? null : Number(values.featuredOrder),
      targetAudience: values.targetAudience?.trim() || null,
      whatYouLearn: values.whatYouLearn?.trim() || null,
    });
    if (result && result.ok === false) {
      setServerError(result.error);
    } else if (result && result.ok === true) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    // If the action redirected, this code never runs (the throw bubbles up).
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Etiqueta destacada"
          hint="Aparece como pegatina en las tarjetas y el detalle del curso."
          error={errors.badge?.message}
        >
          <select
            {...register("badge")}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-celeste"
          >
            <option value="">Sin etiqueta</option>
            <option value="BESTSELLER">Más vendido</option>
            <option value="NEW">Nuevo</option>
            <option value="COMING_SOON">Próximamente</option>
          </select>
        </Field>

        <Field
          label="Orden destacado"
          hint="Menor = más arriba. Vacío = ordenar por fecha."
          error={errors.featuredOrder?.message}
        >
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            {...register("featuredOrder")}
            placeholder="(vacío)"
          />
        </Field>
      </div>

      <Field
        label="Para quién es este curso"
        hint="Una línea por bullet. Aparece como sección en la landing si lo rellenas."
        error={errors.targetAudience?.message}
      >
        <Textarea
          rows={5}
          {...register("targetAudience")}
          placeholder={"Personas que…\nQuienes ya…\nSi nunca has…"}
        />
      </Field>

      <Field
        label="Qué vas a aprender"
        hint="Una línea por bullet. Lista de resultados concretos del curso."
        error={errors.whatYouLearn?.message}
      >
        <Textarea
          rows={5}
          {...register("whatYouLearn")}
          placeholder={"A montar X paso a paso\nA decidir cuándo usar Y\nA evitar los errores típicos de Z"}
        />
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
