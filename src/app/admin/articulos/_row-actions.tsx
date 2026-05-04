"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { togglePublishArticle, deleteArticle } from "./_actions";

export function PublishArticleSwitch({
  id,
  initialPublished,
}: {
  id: string;
  initialPublished: boolean;
}) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(initialPublished);

  return (
    <Switch
      checked={optimistic}
      disabled={pending}
      onCheckedChange={(v) => {
        setOptimistic(v);
        start(async () => {
          await togglePublishArticle(id);
        });
      }}
    />
  );
}

export function DeleteArticleButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-neutral-600">¿Borrar?</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(() => deleteArticle(id).then(() => setConfirming(false)))
          }
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
      </span>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-red-600"
      onClick={() => setConfirming(true)}
      title={`Borrar artículo ${title}`}
    >
      Borrar
    </Button>
  );
}
