"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enrollUserManual } from "./_actions";

type Course = { id: string; title: string };

type Feedback =
  | { kind: "ok"; created: boolean; alreadyEnrolled: boolean; userExisted: boolean; email: string }
  | { kind: "err"; message: string }
  | null;

export function EnrollForm({ courses }: { courses: Course[] }) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    start(async () => {
      const email = String(formData.get("email") ?? "");
      const result = await enrollUserManual(formData);
      if (!result.ok) {
        setFeedback({ kind: "err", message: result.error });
        return;
      }
      setFeedback({
        kind: "ok",
        created: result.created,
        alreadyEnrolled: result.alreadyEnrolled,
        userExisted: result.userExisted,
        email,
      });
      if (result.created) formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="rounded-xl border border-neutral-200 bg-white p-6 space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email del alumno</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="alumno@email.com"
        />
        <p className="text-xs text-neutral-500">
          Si el alumno no existe en el sistema, se crea ahora. La cuenta queda
          lista — el alumno entra desde <code>/login</code> con este email.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="courseId">Curso</Label>
        <select
          id="courseId"
          name="courseId"
          required
          defaultValue=""
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="" disabled>
            — Selecciona un curso —
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Enrolando…" : "Enrolar alumno"}
        </Button>
        {feedback?.kind === "ok" && feedback.alreadyEnrolled && (
          <p className="text-sm text-amber-700">
            <strong>{feedback.email}</strong> ya estaba enrolado en ese curso.
          </p>
        )}
        {feedback?.kind === "ok" && feedback.created && (
          <p className="text-sm text-emerald-700">
            ✓ Enrolado{" "}
            {feedback.userExisted
              ? "(usuario existente)"
              : "(usuario nuevo creado)"}
            .
          </p>
        )}
        {feedback?.kind === "err" && (
          <p className="text-sm text-red-600">{feedback.message}</p>
        )}
      </div>
    </form>
  );
}
