"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/rich-editor";
import { saveLegalDocument, resetLegalDocument } from "./_actions";

type Props = {
  slug: string;
  initialTitle: string;
  initialBody: string;
  isDefault: boolean;
};

export function LegalDocumentForm({
  slug,
  initialTitle,
  initialBody,
  isDefault,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "ok" } | { kind: "err"; message: string } | null
  >(null);

  function onSave() {
    start(async () => {
      const result = await saveLegalDocument({ slug, title, body });
      if (result.ok) setFeedback({ kind: "ok" });
      else setFeedback({ kind: "err", message: result.error });
    });
  }

  function onReset() {
    if (
      !window.confirm(
        "¿Restaurar la plantilla por defecto? Esto borra los cambios guardados."
      )
    )
      return;
    start(async () => {
      const result = await resetLegalDocument(slug);
      if (result.ok) {
        // After reset, public route serves the default. The admin form local
        // state stays as-is until reload.
        setFeedback({ kind: "ok" });
      } else {
        setFeedback({ kind: "err", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor={`title-${slug}`}>Título</Label>
        <Input
          id={`title-${slug}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Cuerpo</Label>
        <RichEditor
          value={body}
          onChange={setBody}
          placeholder="Escribe el contenido legal…"
          className="min-h-[400px]"
        />
        <p className="text-xs text-neutral-500">
          Recuerda revisar este texto con un abogado antes de publicar la web a
          producción real.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={onSave} disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {!isDefault && (
          <Button
            variant="ghost"
            onClick={onReset}
            disabled={pending}
            className="text-red-600"
          >
            Restaurar plantilla por defecto
          </Button>
        )}
        {feedback?.kind === "ok" && (
          <p className="text-sm text-emerald-700">✓ Guardado.</p>
        )}
        {feedback?.kind === "err" && (
          <p className="text-sm text-red-600">{feedback.message}</p>
        )}
      </div>
    </div>
  );
}
