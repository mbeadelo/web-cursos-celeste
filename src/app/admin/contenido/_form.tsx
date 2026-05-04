"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/rich-editor";
import { SITE_CONTENT_KEYS, type SiteContentKey } from "@/lib/site-content-keys";
import { saveSiteContent, resetSiteContentKey } from "./_actions";

type Props = {
  values: Record<string, string>; // current value (or default) for each key
  hasOverride: Record<string, boolean>; // true if a row exists in SiteContent
};

export function SiteContentForm({ values, hasOverride }: Props) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "ok"; updated: number }
    | { kind: "err"; message: string }
    | null
  >(null);

  // Local state for rich keys (TipTap is uncontrolled by FormData natively).
  // Plain text keys read straight from the form on submit.
  const richKeys = (Object.keys(SITE_CONTENT_KEYS) as SiteContentKey[]).filter(
    (k) => SITE_CONTENT_KEYS[k].type === "rich"
  );
  const [richState, setRichState] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of richKeys) init[k] = values[k] ?? "";
    return init;
  });

  function onSubmit(formData: FormData) {
    // Inject rich values into the FormData (TipTap doesn't bind to native form).
    for (const k of richKeys) {
      formData.set(k, richState[k] ?? "");
    }
    start(async () => {
      const result = await saveSiteContent(formData);
      if (!result.ok) {
        setFeedback({ kind: "err", message: result.error });
      } else {
        setFeedback({ kind: "ok", updated: result.updated });
      }
    });
  }

  // Group keys by section
  const grouped = new Map<string, SiteContentKey[]>();
  for (const k of Object.keys(SITE_CONTENT_KEYS) as SiteContentKey[]) {
    const section = SITE_CONTENT_KEYS[k].section;
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(k);
  }

  return (
    <form action={onSubmit} className="space-y-10">
      {Array.from(grouped.entries()).map(([section, keys]) => (
        <section
          key={section}
          className="rounded-xl border border-neutral-200 bg-white p-6 space-y-6"
        >
          <h2 className="text-lg font-semibold">{section}</h2>
          {keys.map((key) => {
            const meta = SITE_CONTENT_KEYS[key];
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor={key}>{meta.label}</Label>
                  {hasOverride[key] && (
                    <ResetButton
                      keyName={key}
                      onReset={() => {
                        // Optimistic — rerender from server happens via revalidate
                        if (meta.type === "rich") {
                          setRichState((s) => ({ ...s, [key]: meta.default }));
                        }
                      }}
                    />
                  )}
                </div>
                {meta.type === "text" ? (
                  (values[key] ?? "").length > 80 ? (
                    <Textarea
                      id={key}
                      name={key}
                      rows={3}
                      defaultValue={values[key] ?? ""}
                    />
                  ) : (
                    <Input id={key} name={key} defaultValue={values[key] ?? ""} />
                  )
                ) : (
                  <RichEditor
                    value={richState[key] ?? ""}
                    onChange={(v) =>
                      setRichState((s) => ({ ...s, [key]: v }))
                    }
                    placeholder={meta.hint}
                  />
                )}
                {meta.hint && (
                  <p className="text-xs text-neutral-500">{meta.hint}</p>
                )}
                {!hasOverride[key] && (
                  <p className="text-xs text-neutral-400">
                    Mostrando el texto por defecto. Edita para sobrescribir.
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        {feedback?.kind === "ok" && (
          <p className="text-sm text-emerald-700">
            ✓ Guardados {feedback.updated} campo
            {feedback.updated === 1 ? "" : "s"}.
          </p>
        )}
        {feedback?.kind === "err" && (
          <p className="text-sm text-red-600">{feedback.message}</p>
        )}
      </div>
    </form>
  );
}

function ResetButton({
  keyName,
  onReset,
}: {
  keyName: string;
  onReset: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await resetSiteContentKey(keyName);
          onReset();
        })
      }
      className="text-xs text-neutral-500 hover:text-red-600 transition disabled:opacity-50"
      title="Volver al texto por defecto"
    >
      {pending ? "Reseteando…" : "Resetear"}
    </button>
  );
}
