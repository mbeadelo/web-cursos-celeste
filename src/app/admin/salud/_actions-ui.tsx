"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveOpsEvent,
  resolveAllOpsEvents,
  sendTestAlert,
} from "./_actions";

const btn =
  "rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50 cursor-pointer";

export function ResolveButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => resolveOpsEvent(id))}
      className={`${btn} bg-neutral-200 text-neutral-800 hover:bg-neutral-300`}
    >
      {pending ? "…" : "Cerrar"}
    </button>
  );
}

export function ResolveAllButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  if (count === 0) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`¿Cerrar las ${count} incidencias abiertas?`)) return;
        startTransition(() => resolveAllOpsEvents());
      }}
      className={`${btn} bg-neutral-200 text-neutral-800 hover:bg-neutral-300`}
    >
      Cerrar todas
    </button>
  );
}

export function TestAlertButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              const r = await sendTestAlert();
              setResult(`Alerta enviada a ${r.to.join(", ")}`);
            } catch (err) {
              setResult(
                `Falló: ${err instanceof Error ? err.message : String(err)}`
              );
            }
          })
        }
        className={`${btn} border border-neutral-300 bg-white text-neutral-800 hover:border-brand-celeste`}
      >
        {pending ? "Enviando…" : "Probar email de alerta"}
      </button>
      {result && <span className="text-xs text-neutral-600">{result}</span>}
    </span>
  );
}

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={`${btn} bg-brand-celeste text-brand-celeste-foreground hover:bg-brand-celeste-deep`}
    >
      {pending ? "Comprobando…" : "Volver a comprobar"}
    </button>
  );
}
