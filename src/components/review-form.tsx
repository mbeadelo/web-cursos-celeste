"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/lib/reviews";

type Props = {
  courseId: string;
  /** Existing review (if any) so the form can edit instead of creating. */
  initial?: {
    rating: number;
    body: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
  };
};

export function ReviewForm({ courseId, initial }: Props) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState<number | null>(null);
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (rating < 1) {
      setError("Elige cuántas estrellas le pones.");
      return;
    }
    startTransition(async () => {
      const result = await submitReview({ courseId, rating, body });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  const display = hover ?? rating;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium block">Tu valoración</label>
        <div
          className="inline-flex gap-1"
          onMouseLeave={() => setHover(null)}
          role="radiogroup"
          aria-label="Estrellas"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={
                "text-3xl leading-none transition cursor-pointer " +
                (n <= display ? "text-amber-400" : "text-neutral-300 hover:text-amber-300")
              }
              aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
              role="radio"
              aria-checked={rating === n}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="review-body" className="text-sm font-medium block">
          Tu opinión
        </label>
        <textarea
          id="review-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Cuéntanos qué te ha parecido el curso, qué te ha aportado y a quién se lo recomendarías…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-celeste"
          maxLength={2000}
        />
        <p className="text-xs text-neutral-500">
          {body.length} / 2000 · Mínimo 20 caracteres.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </p>
      )}

      {done && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          ¡Gracias! Revisaremos tu reseña antes de publicarla.
        </p>
      )}

      {initial?.status === "PENDING" && !done && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
          Tu reseña anterior está pendiente de moderación. Si la editas y
          envías, vuelve a la cola.
        </p>
      )}
      {initial?.status === "REJECTED" && !done && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
          Tu reseña anterior no se aprobó. Edítala y vuelve a enviarla.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-5 py-2.5 font-medium hover:bg-brand-celeste-deep transition disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Enviando…" : initial ? "Actualizar reseña" : "Publicar reseña"}
      </button>
    </form>
  );
}
