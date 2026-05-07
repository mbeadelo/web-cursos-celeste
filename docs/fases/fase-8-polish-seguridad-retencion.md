# Fase 8 — Polish, seguridad y retención

> **Objetivo**: subir el listón de seguridad (Mux signed playback, rate limit, CSP), añadir herramientas comerciales (badges, landing renovada, reseñas) y mecánicas de retención (progreso del alumno).

> **Estado**: 🟢 Mergeado. Activación parcial — las funciones que requieren keys externas (Mux signing, Upstash) son no-op hasta que se configuren.

## 1. Mux signed playback

### Qué cambia

Antes los uploads se creaban con política `public`: cualquiera con el `playbackId` podía reproducir el vídeo. Ahora, **si las claves de firma están en el entorno**, los uploads nuevos van con política `signed` y el reproductor exige un JWT por sesión.

Vídeos antiguos `public` siguen funcionando: el cambio solo afecta a los uploads nuevos.

### Archivos

- `src/lib/mux.ts` — `isMuxSigningConfigured()`, `signPlaybackTokens(playbackId)` (firma JWTs para `playback`/`thumbnail`/`storyboard`, expiran en 6 h), `createDirectUpload()` selecciona `signed` o `public` según las keys.
- `src/components/video-player.tsx` — nueva prop `tokens` que se pasa al `<MuxPlayer>`. Sin tokens, juega como antes.
- `src/app/dashboard/cursos/[slug]/page.tsx` — firma tokens server-side **solo para la lección activa** (una operación de firma por render, no N).

### Configuración

1. Mux dashboard → Settings → **Signing Keys** → Generate.
2. Copiar `MUX_SIGNING_KEY_ID` (id) y `MUX_SIGNING_PRIVATE_KEY` (private key base64) a `.env` y a Vercel.
3. Sin estas vars: la app sigue funcionando con la política `public`. **No hay error**.

### Decisión: 6h de expiración

Token corto porque está atado a la sesión del alumno; si se filtra, expira en horas. Mux acepta `1h`, `6h`, `1d`, `7d`, etc.

## 2. Rate limiting con Upstash

### Qué cambia

Capamos abuso en dos endpoints sensibles:
- `/login` (server action de magic link): **5 / 15 min por email** + **10 / 15 min por IP**.
- `/api/checkout`: **10 / min por IP** (devuelve 429 con `Retry-After`).

Sin las vars de Upstash: **no-op silencioso** — todo pasa. Esto deja dev y previews sin Redis funcionales.

### Archivos

- `src/lib/rate-limit.ts` — wrappers `loginEmailLimiter`, `loginIpLimiter`, `checkoutIpLimiter` y helper `getClientIp(headers)`. Usa `@upstash/ratelimit` + `@upstash/redis`.
- `src/app/login/page.tsx` — chequea ambos limiters antes de mandar magic link, redirige a `?error=rate-limited` si falla.
- `src/app/api/checkout/route.ts` — early-return 429 con `Retry-After`.

### Configuración

1. [console.upstash.com](https://console.upstash.com) → New Database → Redis → región europea.
2. Copiar **REST URL** + **REST Token** a Vercel como `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
3. Plan free cubre 10k comandos/día — sobrado para cientos de usuarios.

### Decisión: dos ejes (email + IP) en login

- Por-email solo: protege un buzón concreto pero no impide a un atacante iterar emails desde una IP.
- Por-IP solo: protege contra una IP loca pero no contra un email enumerado desde varias IPs.

Combinarlos cubre los dos vectores con poco coste extra (2 commands por intento de login).

## 3. Course badges + landing renovada

### Schema

Nueva enum + 4 campos en `Course`:

```prisma
enum CourseBadge {
  BESTSELLER
  NEW
  COMING_SOON
}

model Course {
  // ...
  badge          CourseBadge?
  featuredOrder  Int?           // ASC NULLS LAST en el catálogo
  targetAudience String? @db.Text  // bullets separados por \n
  whatYouLearn   String? @db.Text  // idem
}
```

Migración: `add_course_badge` + `landing_progress_reviews`.

### Decisión: badge manual, no automático por ventas

Con catálogo pequeño, un "más vendido" automático puede quedar vacío o injusto las primeras semanas. El admin lo asigna desde `/admin/courses/[id]`.

A futuro se puede añadir un `salesCount` derivado para sugerir candidatos, pero la asignación final manual.

### Display

- **Catálogo `/cursos`**: badge sobre la portada + ordenado por `featuredOrder asc nulls last`, luego `createdAt desc`.
- **Carrusel home** (`featured-courses.tsx`): mismo orden, mismo badge.
- **Landing `/cursos/[slug]`**: hero con badge flotando, stats inline (lecciones / vídeos / PDFs / acceso ilimitado), bullets de "Qué vas a aprender" + "Para quién es", CTA sticky en mobile.

### Componentes

- `src/components/course-badge.tsx` — pill con la paleta de marca, variante `floating` para overlay sobre cover.
- `src/lib/validations/course.ts` — `CourseBadgeEnum` y validación de los nuevos campos.

## 4. Progreso del alumno

### Schema

```prisma
model LessonProgress {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(...)
  lessonId    String
  lesson      Lesson    @relation(...)
  lastSeconds Int       @default(0)
  completedAt DateTime?
  updatedAt   DateTime  @updatedAt

  @@unique([userId, lessonId])
}
```

Una fila por (alumno, lección). `lastSeconds` es la posición de reproducción para "continuar donde lo dejaste". `completedAt` se set una vez y no se desmarca automáticamente (re-ver desde el inicio no resetea).

### Server actions

`src/lib/progress.ts`:

| Action | Quién la llama | Qué hace |
|---|---|---|
| `recordVideoProgress({lessonId, lastSeconds, durationSeconds})` | Player onTimeUpdate (cada 10 s) + onEnded | upsert; auto-completa al 95 % |
| `markLessonComplete(lessonId)` | Botón en PDF/TEXT | upsert + completedAt = now() |
| `unmarkLessonComplete(lessonId)` | Botón cuando ya estaba completada | clear completedAt |

Todas validan `Enrollment` antes de escribir. Falla → returns `{ ok: false }` silencioso (no romper el reproductor).

### UI

- `src/components/video-player.tsx` — props `lessonId` + `startAt`. Throttle a 10 s entre upserts. Seek inicial `clamp(startAt, duration - 5)` para no pasarse del final.
- `src/components/mark-lesson-complete.tsx` — toggle optimista para PDF/TEXT.
- `src/app/dashboard/cursos/[slug]/page.tsx` — barra de progreso global en cabecera, ✓ por lección en sidebar, una sola query a `lessonProgress` para todo el curso.
- `src/app/dashboard/page.tsx` — barra de progreso por curso en las tarjetas (`X / Y lecciones · NN%`), badge "✓ Completado" cuando 100%.

### Decisión: 95 % como umbral de completado

Los créditos finales y leves pausas hacen que muchos vídeos no se vean al 100% aunque se hayan consumido. 95 % es el estándar de la industria (YouTube, Coursera, etc.).

## 5. Reseñas moderadas

### Schema

```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

model Review {
  id        String       @id @default(cuid())
  userId    String
  courseId  String
  rating    Int          // 1-5
  body      String       @db.Text
  status    ReviewStatus @default(PENDING)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([userId, courseId])
}
```

Constraint `(userId, courseId)` único: una reseña por alumno por curso. Reenviar **edita** la existente y vuelve a `PENDING`.

### Reglas

- **Solo alumnos del curso** pueden enviar (validado contra `Enrollment` en `submitReview`).
- Status inicial: `PENDING`.
- Solo reseñas `APPROVED` aparecen en la landing pública.
- Admin modera desde `/admin/reviews` (filtros + acciones aprobar/rechazar/borrar).

### Archivos

- `src/lib/reviews.ts` — server actions `submitReview`, `moderateReview`, `deleteReview`.
- `src/lib/validations/review.ts` — Zod (rating 1-5, body 20-2000 chars).
- `src/components/review-form.tsx` — formulario con estrellas interactivas, optimista, banners según status (`PENDING` / `REJECTED`).
- `src/components/rating-stars.tsx` — display read-only de medias decimales (estrella parcial vía clip-path con dos capas).
- `src/app/admin/reviews/page.tsx` — listado con filtros y contadores agrupados por status.
- `src/app/admin/reviews/_actions-ui.tsx` — botones cliente para aprobar/rechazar/borrar.

### Display público

`/cursos/[slug]` muestra (cuando hay reseñas aprobadas):
- Eyebrow con media + número junto al título.
- Sección dedicada con media grande + distribución por nº de estrellas (5★ — N, 4★ — N…).
- Tarjetas con autor anonimizado (nombre o `local-part-truncado***` del email).

### Decisión: moderadas, no auto-aprobadas

Cliente con clientela cualificada que escribirá cosas con sustancia. Aún así, moderar previene:
- Spam puntual.
- Reseñas fuera de tema (preguntas de soporte, errores de DB).
- PII accidental (un alumno mencionando su email/teléfono).

Coste para el cliente: bajo. Click "Aprobar" en `/admin/reviews`. Notificable a futuro (email cuando llegue una `PENDING`).

## 6. Cabeceras de seguridad + CSP

### Estáticas (`next.config.ts`)

Aplican a todas las respuestas:

| Header | Valor |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

### CSP por petición (`src/proxy.ts`)

Nonce de 16 bytes base64 generado en cada request. `script-src` con `'nonce-...'` + `'strict-dynamic'`. Next.js detecta el header `Content-Security-Policy` en el request y propaga el nonce automáticamente a los scripts que inyecta.

Allow-list dirigida:

| Directiva | Lista |
|---|---|
| `connect-src` | `'self'` + `*.mux.com` + `*.litix.io` + `*.ingest.sentry.io` + `vitals.vercel-insights.com` + `wss://*.mux.com` |
| `media-src` | `'self' blob: https://*.mux.com` |
| `frame-src` | `'self' https://js.stripe.com https://*.mux.com` |
| `img-src` | `'self' data: blob: https:` (laxo a propósito por covers desde URLs externas) |
| `style-src` | `'self' 'unsafe-inline'` (Tailwind inyecta `<style>` en runtime) |
| `frame-ancestors` | `'none'` |
| `form-action` | `'self'` |

### Detalle Next.js 16

> **OJO**: en Next 16 `middleware` se llama **proxy** y debe vivir en **`src/proxy.ts`** (no en raíz si hay carpeta `src/`). El archivo en otra ubicación se ignora **silenciosamente**.
>
> Doc local: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

Si renombras o mueves `proxy.ts`, **borra `.next/` antes de levantar dev** — la caché en `.next/dev/server/middleware.js` puede apuntar al path antiguo y devolver 500 con `MODULE_UNPARSABLE`.

### Decisión: nonce vs Subresource Integrity (SRI)

Next 16 ofrece SRI experimental como alternativa al nonce. Lo descartamos porque:
- SRI requiere generar hashes en build; las páginas pueden seguir siendo estáticas, pero **no** soporta scripts dinámicos (Stripe Elements, Mux Player Hooks).
- El nonce fuerza renderizado dinámico, sí, pero todas las páginas de este proyecto ya son dinámicas (sesión, cursos desde DB, etc.).

### Verificación

Tras desplegar:
- [securityheaders.com](https://securityheaders.com/?q=bienvenidoatuplaza.com) debería dar **A** o **A+**.
- DevTools → Network → ver header `Content-Security-Policy` con nonce distinto en cada navegación.

## 7. JSON-LD para SEO

### Archivos

- `src/lib/json-ld.ts` — `buildCourseJsonLd()` y `buildArticleJsonLd()`. `jsonLdString()` escapa `</script>` defensivamente.
- `src/app/cursos/[slug]/page.tsx` — inyecta JSON-LD `Course` con nonce CSP.
- `src/app/articulos/[slug]/page.tsx` — refactorizado para usar `buildArticleJsonLd()` (antes tenía objeto inline).

### Esquema Course

Cumple con el "Course rich result" de Google:
- `name`, `description`, `provider` (Organization), `url`.
- `image` si hay portada.
- `offers` con `price` (string con 2 decimales), `priceCurrency`, `availability: InStock`, `category: Paid`.
- `hasCourseInstance` con `courseMode: Online`, `courseWorkload: PT5H` (placeholder hasta que las lecciones lleven duración).
- `aggregateRating` cuando hay reseñas aprobadas (con `bestRating`/`worstRating`).

### Verificación

Tras desplegar:
- [search.google.com/test/rich-results](https://search.google.com/test/rich-results) sobre `https://bienvenidoatuplaza.com/cursos/<slug>`.

## Variables de entorno nuevas

| Var | Cuándo es obligatoria | Notas |
|---|---|---|
| `MUX_SIGNING_KEY_ID` | Producción real | Sin ella, los uploads nuevos siguen siendo `public` |
| `MUX_SIGNING_PRIVATE_KEY` | Producción real | Base64 PEM tal y como Mux lo entrega |
| `UPSTASH_REDIS_REST_URL` | Producción real | Sin ella, rate limit es no-op |
| `UPSTASH_REDIS_REST_TOKEN` | Producción real | Idem |

`.env.example` lleva todas con comentarios.

## Migraciones

```
prisma/migrations/
  20260506231843_add_course_badge/         # badge + featuredOrder
  20260506232451_landing_progress_reviews/ # targetAudience, whatYouLearn,
                                            # LessonProgress, Review
```

## Pendientes / TODOs

- **Configurar Mux Signing Keys** y **Upstash** en Vercel cuando vayamos a modo live.
- **Sentry**: ya cableado (`@sentry/nextjs` en `package.json`, `SENTRY_DSN` en env). Crear proyecto en sentry.io y pegar DSN para empezar a recibir errores.
- **Notificación al admin** cuando llega una reseña `PENDING` (Resend, asunto simple). Hoy hay que entrar a `/admin/reviews` periódicamente.
- **Revisar `lib/html.ts`** — sanitizer del editor TipTap. Verificar que la allowlist no permite eventos JS.
- **Cookie banner** si en algún momento se añaden analytics no esenciales.

## Commits

```
dfb3622 feat: seguridad — Mux signed playback + rate limit en login y checkout
12ad689 feat: catálogo — badges, landing renovada con bullets y reseñas
0a14702 feat: alumno — progreso por lección y reseñas con moderación
90fb33a feat: cabeceras de seguridad (CSP con nonce, HSTS, etc.)
8ed561a feat: SEO — JSON-LD schema.org/Course y Article
```
