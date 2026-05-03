"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { togglePublishCourse, deleteCourse } from "./_actions";

export function PublishSwitch({
  id,
  initialPublished,
}: {
  id: string;
  initialPublished: boolean;
}) {
  const [optimistic, setOptimistic] = useState(initialPublished);
  const [isPending, startTransition] = useTransition();

  return (
    <Switch
      checked={optimistic}
      disabled={isPending}
      onCheckedChange={(v) => {
        setOptimistic(v);
        startTransition(async () => {
          try {
            await togglePublishCourse(id);
          } catch {
            setOptimistic(!v);
          }
        });
      }}
    />
  );
}

export function DeleteCourseButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" />
        }
      >
        Eliminar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar el curso?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <strong>{title}</strong>. Se borrarán también sus lecciones.
            Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await deleteCourse(id);
                setOpen(false);
              });
            }}
          >
            {isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
