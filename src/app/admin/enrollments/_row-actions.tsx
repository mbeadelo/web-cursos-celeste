"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteEnrollment } from "./_actions";

export function DeleteEnrollmentButton({
  id,
  email,
  courseTitle,
}: {
  id: string;
  email: string;
  courseTitle: string;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-600">¿Confirmas?</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => start(() => deleteEnrollment(id).then(() => setConfirming(false)))}
        >
          {pending ? "Borrando…" : "Sí"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-red-600"
      onClick={() => setConfirming(true)}
      title={`Quitar acceso de ${email} a ${courseTitle}`}
    >
      Revocar
    </Button>
  );
}
