"use client";

import { useState, useTransition, useOptimistic } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LessonDialog } from "./_lesson-dialog";
import { deleteLesson, reorderLessons } from "./_lessons-actions";

type LessonType = "VIDEO" | "PDF" | "TEXT";

type Lesson = {
  id: string;
  order: number;
  title: string;
  type: LessonType;
  moduleId: string | null;
  muxPlaybackId: string | null;
  fileKey: string | null;
  body: string | null;
};

const typeLabels: Record<LessonType, string> = {
  VIDEO: "Vídeo",
  PDF: "PDF",
  TEXT: "Texto",
};

export function LessonsList({
  courseId,
  initialLessons,
  modules,
  storageEnabled,
  muxConfigured,
  pdfOnly,
}: {
  courseId: string;
  initialLessons: Lesson[];
  modules: { id: string; title: string }[];
  storageEnabled: boolean;
  muxConfigured: boolean;
  pdfOnly?: boolean;
}) {
  const moduleTitle = (id: string | null) =>
    id ? (modules.find((m) => m.id === id)?.title ?? null) : null;
  // useOptimistic: shows the dragged-to order immediately, then resets to
  // the server-truth (initialLessons) once the server action revalidates.
  const [lessons, setOptimisticLessons] = useOptimistic<Lesson[], Lesson[]>(
    initialLessons,
    (_current, next) => next
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [deleting, setDeleting] = useState<Lesson | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(lessons, oldIndex, newIndex);
    startTransition(async () => {
      setOptimisticLessons(next);
      await reorderLessons(
        courseId,
        next.map((l) => l.id)
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">{pdfOnly ? "Materiales (PDF)" : "Lecciones"}</h2>
          <p className="text-sm text-neutral-600">
            {lessons.length}{" "}
            {pdfOnly
              ? lessons.length === 1
                ? "material"
                : "materiales"
              : lessons.length === 1
                ? "lección"
                : "lecciones"}
            . Arrastra para reordenar.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          {pdfOnly ? "Añadir PDF" : "Añadir lección"}
        </Button>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-neutral-600">Este curso aún no tiene lecciones.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {lessons.map((l, i) => (
                <LessonRow
                  key={l.id}
                  lesson={l}
                  index={i + 1}
                  moduleLabel={moduleTitle(l.moduleId)}
                  onEdit={() => setEditing(l)}
                  onDelete={() => setDeleting(l)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <LessonDialog
        courseId={courseId}
        open={addOpen}
        onOpenChange={setAddOpen}
        modules={modules}
        storageEnabled={storageEnabled}
        muxConfigured={muxConfigured}
        pdfOnly={pdfOnly}
      />

      <LessonDialog
        courseId={courseId}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        lesson={editing ?? undefined}
        modules={modules}
        storageEnabled={storageEnabled}
        muxConfigured={muxConfigured}
        pdfOnly={pdfOnly}
      />

      <DeleteLessonDialog
        lesson={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  moduleLabel,
  onEdit,
  onDelete,
}: {
  lesson: Lesson;
  index: number;
  moduleLabel: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3"
    >
      <button
        type="button"
        className="cursor-grab text-neutral-400 hover:text-neutral-600 touch-none"
        aria-label="Reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="text-xs font-mono text-neutral-500 w-6">{index}.</span>
      <span className="text-xs uppercase tracking-wide text-neutral-500 w-12">
        {typeLabels[lesson.type]}
      </span>
      <span className="flex-1 font-medium">{lesson.title}</span>
      {moduleLabel && (
        <span className="text-[11px] rounded-full bg-brand-celeste/10 text-brand-celeste-deep px-2 py-0.5 max-w-[160px] truncate">
          {moduleLabel}
        </span>
      )}
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="size-3.5" />
        <span className="sr-only">Editar</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600">
        <Trash2 className="size-3.5" />
        <span className="sr-only">Eliminar</span>
      </Button>
    </li>
  );
}

function DeleteLessonDialog({
  lesson,
  onClose,
}: {
  lesson: Lesson | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={!!lesson} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar la lección?</DialogTitle>
          <DialogDescription>
            Vas a eliminar <strong>{lesson?.title}</strong>. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (!lesson) return;
              startTransition(async () => {
                await deleteLesson(lesson.id);
                onClose();
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
