# Fase 2c — CRUD de lecciones + drag-and-drop reorder

> **Objetivo**: el admin puede añadir, editar, ordenar y eliminar lecciones dentro de un curso. Tres tipos: VIDEO, PDF, TEXT.

> **Estado**: ✅ Completada. Las lecciones de tipo VIDEO requieren pegar el `muxPlaybackId` a mano (la subida real a Mux llega en Fase 4); las de tipo PDF requieren la `fileKey` de R2 a mano (el upload directo de PDFs es similar al de portadas y se añade cuando lo necesitemos).

## Cómo se ve

Dentro de `/admin/courses/[id]`, debajo del formulario del curso aparece la sección **"Lecciones"**. Cada lección es una fila con:

- **Drag handle** (asas arriba/abajo) para reordenar.
- **Número** (orden actual).
- **Etiqueta del tipo** (Vídeo / PDF / Texto).
- **Título**.
- **Botones** Editar y Eliminar.

Botón superior **"Añadir lección"** abre un dialog con campos según el tipo:

| Tipo | Campos |
|---|---|
| VIDEO | Título + Mux playback ID |
| PDF | Título + File key de R2 |
| TEXT | Título + Body markdown (textarea) |

## Archivos añadidos

```
src/lib/validations/lesson.ts                          Discriminated union por tipo
src/app/admin/courses/[id]/_lessons-actions.ts         create/update/delete/reorder
src/app/admin/courses/[id]/_lesson-dialog.tsx          Form dialog (cliente)
src/app/admin/courses/[id]/_lessons-list.tsx           Sortable list con dnd-kit
```

Modificados:

- `src/app/admin/courses/[id]/page.tsx` — embebe `<LessonsList />` debajo del CourseForm.
- `src/app/admin/courses/_actions.ts` — `createCourse` ahora redirige a `/admin/courses/[newId]` para que puedas añadir lecciones inmediato; `updateCourse` se queda en la misma página y muestra "Cambios guardados".

## Dependencias añadidas

| Paquete | Para qué |
|---|---|
| `@dnd-kit/core` | Drag-and-drop primitives |
| `@dnd-kit/sortable` | Sortable lists con animación |
| `@dnd-kit/utilities` | Helpers (CSS transform serializers) |

## Decisiones de Fase 2c

### Discriminated union para tipos de lección

`LessonInputSchema = z.discriminatedUnion("type", [VideoSchema, PdfSchema, TextSchema])`. Cada tipo tiene su set de campos requeridos. Esto:

- Permite usar **un solo schema** para validar.
- Genera tipos TS bien afinados (`LessonInput` se estrecha al hacer narrowing por `.type`).
- Hace imposible guardar una lección PDF sin `fileKey` o una lección VIDEO sin `muxPlaybackId`.

### Reorder con el "negate trick"

`Lesson` tiene `@@unique([courseId, order])` para evitar dos lecciones con el mismo orden. El trade-off: durante un reorder en lote, los pasos intermedios pueden colisionar.

Solución: una sola transacción con dos pasadas:

```
1. Para cada lección, asignar order = -(nuevo_index + 1)   (negativos, sin colisión)
2. Para cada lección, asignar order = nuevo_index + 1       (positivos finales)
```

Funciona porque no hay constraint de orden positivo. Implementado en `reorderLessons`.

### Optimistic UI con `useOptimistic` (React 19)

Cuando arrastras una lección, el orden visible cambia **inmediatamente** sin esperar al servidor. Si la action falla, React devuelve automáticamente al estado del prop (server truth) en el siguiente render.

Antes habíamos intentado con `useState + useEffect` (sincronizar prop a estado), pero **ESLint marca eso como anti-patrón**: setState dentro de effect causa cascading renders. `useOptimistic` resuelve esto correctamente.

### `createCourse` redirige a edit, `updateCourse` se queda

Antes, ambas acciones redirigían a la lista. Ahora:

- **createCourse** → redirige a `/admin/courses/[newId]` (la página de edición), porque lo siguiente que querrás hacer es añadir lecciones.
- **updateCourse** → se queda en `/admin/courses/[id]` y muestra un banner verde "Cambios guardados" durante 2.5s.

### Sin uploads reales en lecciones (todavía)

Para PDF la `fileKey` se pega a mano. Para VIDEO el `muxPlaybackId` también. La razón es de scope:

- **PDF**: el upload directo a R2 es idéntico al de portada; cuando lo necesitemos seriamente (alumnos descargando) lo añadimos. Hasta entonces, subes el PDF a R2 manualmente desde su dashboard y pegas la key.
- **VIDEO**: la subida a Mux es Fase 4. Por ahora, subes el vídeo desde el dashboard de Mux y pegas el playback ID.

## Verificación

En `/admin/courses/[id]`:

- [ ] "Añadir lección" abre dialog. Por defecto tipo VIDEO.
- [ ] Cambiar tipo cambia los campos visibles.
- [ ] Crear una de cada tipo → aparecen en la lista.
- [ ] Editar título → persiste.
- [ ] Arrastrar una lección a otra posición → orden cambia.
- [ ] Recargar la página → orden persiste.
- [ ] Eliminar con confirm → desaparece.

## Commit

```
de8b5f2  feat(admin): phase 2b + 2c - lessons CRUD with dnd reorder + R2 cover upload
```
