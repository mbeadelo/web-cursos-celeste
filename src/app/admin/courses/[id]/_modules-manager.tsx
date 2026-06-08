"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createModule, renameModule, deleteModule } from "./_modules-actions";

type Module = { id: string; title: string };

export function ModulesManager({
  courseId,
  modules,
}: {
  courseId: string;
  modules: Module[];
}) {
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setError(null);
    startTransition(async () => {
      const res = await createModule(courseId, title);
      if (res.ok) setNewTitle("");
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fases</h2>
        <p className="text-sm text-neutral-600">
          Agrupa las lecciones en fases. Cada lección se asigna a una fase desde
          su propio formulario. Las lecciones sin fase aparecen sueltas.
        </p>
      </div>

      {modules.length > 0 && (
        <ul className="space-y-2">
          {modules.map((m) => (
            <ModuleRow key={m.id} module={m} />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder="Nueva fase (p. ej. «Fase 1 — Fundamentos»)"
          maxLength={200}
        />
        <Button onClick={onAdd} disabled={isPending || !newTitle.trim()}>
          <Plus className="size-4" />
          Añadir fase
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ModuleRow({ module: m }: { module: Module }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(m.title);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    const t = title.trim();
    if (!t) return;
    setError(null);
    startTransition(async () => {
      const res = await renameModule(m.id, t);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  function onDelete() {
    startTransition(async () => {
      await deleteModule(m.id);
    });
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3">
      {editing ? (
        <>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
            maxLength={200}
            autoFocus
          />
          <Button variant="ghost" size="sm" onClick={onSave} disabled={isPending}>
            <Check className="size-4 text-green-600" />
            <span className="sr-only">Guardar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTitle(m.title);
              setEditing(false);
            }}
          >
            <X className="size-4" />
            <span className="sr-only">Cancelar</span>
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium">{m.title}</span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            <span className="sr-only">Renombrar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isPending}
            className="text-red-600"
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Eliminar</span>
          </Button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
