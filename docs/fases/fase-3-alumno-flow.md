# Fase 3 — Flujo del alumno

> **Objetivo**: cerrar el bucle "admin enrola → alumno entra → consume contenido". Sin Stripe ni Mux todavía. Permite migrar la cartera real de alumnos a la web inmediatamente.

> **Estado**: ✅ Completada (2026-05-04 sesión 3). Pendiente activar Stripe (Fase 4) y Mux (Fase 5).

## Por qué este orden

La cliente real ya tiene alumnos pagando off-line. La urgencia no es cobrar, es darle un sitio para consumir. Con esta fase ya puede:

1. Crear un curso en `/admin/courses` (pre-existente).
2. Subir lecciones (PDF link directo + texto inmediato; vídeo cuando llegue Mux).
3. Enrolar alumnos manualmente desde `/admin/enrollments`.
4. Los alumnos entran en `/login`, ven sus cursos en `/dashboard` y consumen contenido en `/dashboard/cursos/[slug]`.

## Rutas nuevas

| Ruta | Función |
|---|---|
| `/admin/enrollments` | Form de enrollment manual + tabla de últimos 100 enrollments con revocar |
| `/dashboard` | Listado de cursos enrolados del alumno (cards con cover) |
| `/dashboard/cursos/[slug]` | Visionado: sidebar de lecciones + main con contenido |

## Componentes nuevos

```
src/lib/access.ts                          canAccessCourse / canAccessLesson
src/lib/validations/enrollment.ts          ManualEnrollmentSchema (zod)
src/app/admin/enrollments/_actions.ts      enrollUserManual + deleteEnrollment
src/app/admin/enrollments/_form.tsx        Form cliente con feedback messages
src/app/admin/enrollments/_row-actions.tsx Botón "Revocar" con confirm inline
src/app/admin/enrollments/page.tsx         Página completa
src/app/dashboard/page.tsx                 Reescrita: cards de cursos enrolados
src/app/dashboard/cursos/[slug]/page.tsx   Visionado con sidebar + main
```

## Decisiones

### Enrollment manual: input libre que crea-si-no-existe

El admin escribe el email del alumno como texto libre. Si la `User` no existe, se crea ahí mismo con `db.user.create({ email })`. Si ya existe, se usa la existente. La operación es **idempotente** sobre `Enrollment` (si ya estaba enrolado en ese curso, se devuelve `alreadyEnrolled: true` sin error).

**Por qué libre vs. autocompletar**: la cartera actual está en off-line, no hay nadie a quien autocompletar. Antes de Stripe, todos los enrollments serán manuales y de alumnos nuevos para la web. Cuando Stripe llegue, los `User` se crearán via webhook y el autocompletar tendría sentido. Lo añadimos entonces si hace falta.

### Bypass del adapter Auth.js para crear User

El [registro cerrado](./fase-1-auth#registro-cerrado-decisión-2026-05-04-sesión-3) bloquea `lockedAdapter.createUser`. Pero el admin **debe** poder provisionar usuarios. Solución: en `_actions.ts` usamos `db.user.create` directo, **saltándonos el adapter**. El adapter solo aplica al flujo Auth.js (magic link). Esta es una vía "sanctioned" de provisión.

Mismo patrón aplicará al webhook de Stripe en Fase 4: `db.user.upsert` directo.

### Visionado: query param para lección activa

`/dashboard/cursos/[slug]?l=<lessonId>`. Si no hay query, se selecciona la primera lección. Esto:

- Es shareable (un alumno puede compartir el link a una lección concreta — siempre que esté enrolado).
- Permite navegación prev/next sin estado de cliente.
- El servidor revalida `canAccessCourse` en cada request — defense in depth.

### Render por tipo de lección

| Tipo | Render actual | Render objetivo (futuro) |
|---|---|---|
| `VIDEO` | Placeholder con gradient negro y mensaje "Vídeo en preparación" | `<mux-player>` con signed playback URL |
| `PDF` | Si hay `fileKey` y `R2_PUBLIC_URL`, botón "Abrir PDF" → URL pública. Si no, placeholder | Signed download URL con TTL corto (5-15 min) |
| `TEXT` | `whitespace-pre-line` con tipografía de lectura | Markdown renderizado (TipTap output o react-markdown) |

PDFs hoy van por URL pública porque el bucket R2 está en modo público (la decisión sobre bucket privado para PDFs está pendiente — ver fase-2b). Cuando se separe, los PDFs pasarán por signed URLs sin cambiar la firma del componente.

### Acceso desde admin: bypass del gating

Si tu sesión es ADMIN pero no estás enrolado en un curso, ¿deberías ver el contenido? **Hoy no** — `canAccessCourse` chequea solo `Enrollment`. Para admin, lo más limpio es añadir explícitamente "auto-enrollment" para admin en el seed o que el admin se enrole a sí mismo via `/admin/enrollments`. Lo segundo es más correcto y ya funciona.

## Acceso (defense in depth)

```
src/lib/access.ts
   ├─ canAccessCourse(userId, courseId): boolean
   └─ canAccessLesson(userId, lessonId): boolean (resuelve courseId)

/dashboard/cursos/[slug]/page.tsx
   ├─ middleware → redirige a /login si no hay sesión (capa 1)
   ├─ auth() → redirige si no hay sesión (capa 2, redundante con middleware)
   └─ canAccessCourse() → redirige a /dashboard si no enrolado (capa 3)
```

Cuando llegue la Fase 4 (Stripe + descargas signed), el endpoint que firme las URLs **también** debe llamar a `canAccessLesson` antes de firmar — nunca confiar solo en que llegaste a la página.

## Verificación manual

```powershell
pnpm dev
```

1. Login como admin (`mabedepro@gmail.com`).
2. `/admin/enrollments` → escribe `prueba@example.com`, selecciona un curso, "Enrolar alumno". Esperado: badge verde "Enrolado (usuario nuevo creado)".
3. Repite con el mismo email y curso. Esperado: aviso amber "ya estaba enrolado".
4. Cierra sesión, ve a `/login`, mete `prueba@example.com`. Esperado: te llega magic link (email no rebotado porque ahora SÍ está en User).
5. Click en magic link → `/dashboard`. Verifica que aparece la card del curso con cover y "Continuar".
6. Click en card → `/dashboard/cursos/[slug]`. Verifica:
   - Sidebar con lista de lecciones, primera highlighteada.
   - Main muestra placeholder o contenido según tipo.
   - Botones prev/next al pie funcionan.
7. Vuelve a admin, en la tabla de enrollments dale a "Revocar" → confirma. Verifica que la card desaparece de `/dashboard` para ese alumno.

## Pendientes inmediatos

- **Subida de PDF a R2 desde admin**: hoy `Lesson.fileKey` se mete a mano en la DB. Replicar `_cover-upload.tsx` pero para lecciones PDF.
- **Markdown en TEXT**: hoy es `whitespace-pre-line`. Bajar TipTap o react-markdown.
- **Markdown / TipTap es además el editor para CMS-light + blog** (siguiente tanda según hoja de ruta).
- **Auto-enrollment del admin** o "vista admin del curso" sin enrollment, para que ella pueda revisar el material desde la perspectiva del alumno sin enrolarse.
- **Indicador de progreso por lección** (vista, completada). Modelo `LessonProgress { userId, lessonId, completedAt }`.

## Commits

```
(pendiente de commit junto con superficie pública + R2 setup)
```
