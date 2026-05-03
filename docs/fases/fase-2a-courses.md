# Fase 2a — CRUD de cursos (sin uploads)

> **Objetivo**: el admin puede crear, editar, publicar/despublicar y eliminar cursos. La portada se introduce como URL externa; los uploads reales llegan en 2b.

> **Estado**: ✅ Completada.

## Lo que hace ahora el panel

| Ruta | Para qué |
|---|---|
| `/admin` | Resumen (tarjeta con cursos totales/publicados) |
| `/admin/courses` | Lista de todos los cursos con publish toggle y eliminar |
| `/admin/courses/new` | Formulario de creación |
| `/admin/courses/[id]` | Formulario de edición |

## Archivos nuevos

```
src/app/admin/courses/
  page.tsx                    Lista (server component)
  new/page.tsx                Formulario "Nuevo"
  [id]/page.tsx               Formulario "Editar" (carga curso de DB)
  _form.tsx                   Form compartido (client, react-hook-form + zod)
  _actions.ts                 Server actions (create, update, togglePublish, delete)
  _row-actions.tsx            PublishSwitch + DeleteCourseButton (client)

src/lib/validations/course.ts CourseInputSchema (zod) con slug auto-derivado
src/lib/utils.ts              Helper cn() de shadcn
src/components/ui/*           Componentes shadcn (button, input, label, etc.)
components.json               Config de shadcn
```

Modificados:

- `src/app/admin/layout.tsx` — añade enlace "Cursos" en el nav.
- `src/app/admin/page.tsx` — sustituye el placeholder por las tarjetas.
- `src/app/globals.css` — variables del tema añadidas por shadcn.

## Dependencias añadidas

| Paquete | Para qué |
|---|---|
| `react-hook-form` | Manejo del estado de formulario y validación |
| `@hookform/resolvers` | Adaptador entre Zod y react-hook-form |
| `slugify` | Generar slugs ASCII a partir de títulos en español |
| `@base-ui-components/react` (vía shadcn) | Primitivas UI accesibles |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Utilities de shadcn |

## Decisiones de Fase 2a

### Server Actions, no API routes

Las mutations (crear, editar, borrar, publicar) son **server actions** — funciones marcadas con `"use server"` que se llaman directamente desde componentes cliente, sin ruta API explícita.

Ventajas:
- Tipado end-to-end: el cliente conoce la firma de la función.
- Sin código de plumbing (fetch, parseo, response).
- Revalidación de cache automática con `revalidatePath`.

### Defense in depth en cada action

Cada server action empieza por `await ensureAdmin()`, que llama a `auth()` y verifica `session.user.role === "ADMIN"`. Aunque el middleware ya bloquea `/admin/*`, las actions en sí mismas **no** confían en el middleware: si alguien encontrara cómo invocar el endpoint de la action directamente, se rechaza.

### Slug auto-derivado

Si el admin no escribe un slug, se genera de `title` con `slugify`:
- `"Marketing digital para principiantes"` → `"marketing-digital-para-principiantes"`
- ASCII-fold (acentos a vocales sin tilde), strict mode (sin caracteres especiales).

Si ya existe un slug igual en DB, Prisma devuelve `P2002` y la action devuelve un error legible (`"Ese slug ya existe. Usa otro."`) en lugar de un crash.

### Precios en céntimos en DB, euros en el form

`Course.priceCents: Int` (céntimos) en DB para evitar problemas de redondeo con floats. El formulario pide euros (decimal con paso 0.01) y multiplica por 100 al enviar. Al editar, divide por 100 para mostrar.

### Optimistic UI en el switch de publicar

El switch usa `useTransition` + estado optimista local. Al pulsar, cambia visualmente al instante; si la action falla, revierte. Esto evita el "flash" de carga típico.

### Delete con dialog de confirmación

shadcn `Dialog` (basado en Base UI) con dos botones: Cancelar / Eliminar. La eliminación es **hard delete** y dispara `onDelete: Cascade` en `Lesson` (definido en el schema). Para MVP, suficiente. Soft delete + papelera podría añadirse después.

### shadcn + Base UI (no Radix)

La nueva versión de shadcn que se instala con Tailwind 4 usa **Base UI** en lugar de Radix. Pequeñas diferencias de API:

- `asChild` (Radix) → `render` prop (Base UI):
  ```tsx
  // antes (Radix)
  <Button asChild><Link href="/x">Texto</Link></Button>
  // ahora (Base UI)
  <Button render={<Link href="/x" />}>Texto</Button>
  ```
- Los componentes se importan de `@base-ui-components/react/<componente>`.

## Bloqueos resueltos durante Fase 2a

1. **`asChild` no existe en la nueva shadcn** — toda referencia se cambió a `render`. Se aprende leyendo `src/components/ui/button.tsx` después de la instalación.
2. **Compilador de React advierte sobre `watch()` de react-hook-form** — es solo warning. Pendiente migrar a `useWatch` (compatible con React Compiler) si se vuelve molesto.

## Verificación

Manual, vía panel `/admin/courses`:

- [ ] Crear un curso con todos los campos rellenos → aparece en la lista.
- [ ] Crear sin slug → se autogenera del título.
- [ ] Crear con título de menos de 3 chars → error de validación inline.
- [ ] Crear con precio negativo → error inline.
- [ ] Crear con `coverUrl` no-URL → error inline.
- [ ] Crear dos cursos con mismo slug → "Ese slug ya existe".
- [ ] Editar un curso → cambios persisten.
- [ ] Toggle del switch → publica/despublica (refresh confirma).
- [ ] Eliminar con dialog → curso desaparece.

## Commit

```
1f6a023  feat(admin): phase 2a — courses CRUD without uploads
```

## Próxima fase

**Fase 2b — Cloudflare R2 + subida real de portada**.

Plan:

- Crear cuenta Cloudflare + bucket R2.
- `src/lib/storage.ts` con helpers para signed upload/download URLs.
- Sustituir el campo "URL de portada" por un selector de archivo que sube directo a R2.
- Mismo patrón se reutilizará en 2c para PDFs de lecciones.
