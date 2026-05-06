"use client";

import { useState, useTransition } from "react";
import { markLessonComplete, unmarkLessonComplete } from "@/lib/progress";

type Props = {
  lessonId: string;
  initialCompleted: boolean;
};

/**
 * Toggle button shown on PDF and TEXT lessons (video lessons auto-complete
 * via the player at 95%). Optimistic UI: flips the local state immediately,
 * reverts on error.
 */
export function MarkLessonComplete({ lessonId, initialCompleted }: Props) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      const result = next
        ? await markLessonComplete(lessonId)
        : await unmarkLessonComplete(lessonId);
      if (!result.ok) setCompleted(!next); // revert
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer " +
        (completed
          ? "bg-brand-celeste/15 text-brand-celeste-deep hover:bg-brand-celeste/25"
          : "bg-brand-celeste text-brand-celeste-foreground hover:bg-brand-celeste-deep")
      }
    >
      <span>{completed ? "✓" : "○"}</span>
      <span>{completed ? "Completada" : "Marcar como completada"}</span>
    </button>
  );
}
