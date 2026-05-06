"use client";

import { useTransition } from "react";
import { moderateReview, deleteReview } from "@/lib/reviews";

type Status = "PENDING" | "APPROVED" | "REJECTED";

export function ReviewModerationActions({
  reviewId,
  status,
}: {
  reviewId: string;
  status: Status;
}) {
  const [pending, startTransition] = useTransition();

  function setStatus(next: Status) {
    startTransition(async () => {
      await moderateReview({ reviewId, status: next });
    });
  }

  function remove() {
    if (!confirm("¿Borrar reseña permanentemente?")) return;
    startTransition(async () => {
      await deleteReview(reviewId);
    });
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-100">
      {status !== "APPROVED" && (
        <button
          type="button"
          onClick={() => setStatus("APPROVED")}
          disabled={pending}
          className="rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
        >
          Aprobar
        </button>
      )}
      {status !== "REJECTED" && (
        <button
          type="button"
          onClick={() => setStatus("REJECTED")}
          disabled={pending}
          className="rounded-full bg-red-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
        >
          Rechazar
        </button>
      )}
      {status !== "PENDING" && (
        <button
          type="button"
          onClick={() => setStatus("PENDING")}
          disabled={pending}
          className="rounded-full bg-neutral-200 text-neutral-800 px-4 py-1.5 text-xs font-semibold hover:bg-neutral-300 transition disabled:opacity-50 cursor-pointer"
        >
          A pendiente
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-full text-neutral-500 hover:text-red-700 px-4 py-1.5 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
      >
        Borrar
      </button>
    </div>
  );
}
