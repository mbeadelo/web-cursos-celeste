<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# web-cursos-celeste

Plataforma de cursos online (vídeo + PDFs) con autenticación de alumnos, pagos con Stripe y panel de administración. MVP. Desplegado en Vercel.

## Base de conocimiento (cerebro)

El conocimiento de contenido/negocio (temario, dudas de alumnos, decisiones de
producto, copys) vive en `D:\workspace-claude\cerebros\web-cursos\` — consulta
primero su `wiki/index.md` cuando necesites ese contexto. Este repo documenta
solo el código; el cerebro, solo el negocio. No dupliques información entre ambos.

Plan inicial completo: `C:\Users\Lolo\.claude\plans\composed-snuggling-scroll.md`.

## Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** estricto
- **Prisma 7** + **PostgreSQL** (Neon en producción)
- **Auth.js v5** con Email magic-link via Resend
- **Stripe Checkout** + webhooks
- **Mux** para vídeo, **Cloudflare R2** para PDFs
- **Tailwind 4** + **shadcn/ui**
- Validación con **Zod**

Toolchain pinned con Volta en `package.json` (Node 22).

## Comandos

```powershell
pnpm install                 # tras cambios en package.json
pnpm dev                     # dev server (Turbopack) en http://localhost:3000
pnpm build                   # build de producción
pnpm start                   # arrancar build local
pnpm lint                    # ESLint

# Prisma
pnpm exec prisma migrate dev --name <nombre>   # crear migración + aplicarla en dev
pnpm exec prisma migrate deploy                # aplicar migraciones en prod (CI)
pnpm exec prisma studio                        # GUI de la base de datos
pnpm exec prisma generate                      # regenerar cliente tras editar schema
pnpm exec prisma format                        # formatear schema.prisma
pnpm exec prisma dev                           # Postgres local efímero (alternativa a Neon)
pnpm db:seed                                   # ejecutar prisma/seed.ts (upsertea ADMIN_EMAIL + ADMIN_EMAILS como ADMIN)

# Auth.js — generar AUTH_SECRET (cualquiera de las dos)
pnpm dlx auth secret                           # método oficial Auth.js v5
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Stripe webhooks en local (necesario para Fase 3+)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copiar el `whsec_...` que imprime y pegarlo en .env como STRIPE_WEBHOOK_SECRET
```

## Convenciones

- Imports con alias `@/*` (mapeado a `src/*` en `tsconfig.json`).
- Cliente Prisma generado en `src/generated/prisma/` (gitignored). Importar desde `@/lib/db`, nunca el cliente directo.
- Variables de entorno se acceden vía `@/lib/env` (validadas con Zod al boot). Nunca `process.env.X` en código de producto.
- Server Actions y Route Handlers son la vía por defecto para mutations; reservar API routes para webhooks externos.
- Precios siempre en céntimos (`Int`). Nunca floats.
- IDs en formato `cuid` (default de Prisma).

## Webhooks: idempotencia

Stripe re-entrega eventos. Antes de procesar `event.id`, intentar `INSERT` en `StripeEvent` (PK = event id). Si conflict → ya procesado, salir 200. Sin esto se duplican matriculaciones.

## ⚠️ Webhooks: SIEMPRE apuntar a `www`, nunca al apex

El apex `bienvenidoatuplaza.com` hace **308 → `www.bienvenidoatuplaza.com`** (www es canónico). **Ni Stripe ni Mux siguen redirects**: cualquier webhook configurado contra el apex falla en el 308 y no se entrega nunca.

Esto ya rompió los dos webhooks en producción (jul-2026): Stripe (71 entregas fallidas, reportadas como "other errors", no como 308) y Mux (14 vídeos procesados que nunca recibieron su `muxPlaybackId`, quedando invisibles para los alumnos de pago).

- Toda URL de webhook debe llevar `www.`.
- Al corregir uno, **editar el endpoint existente, no crear otro** → el signing secret no cambia y no hay que tocar Vercel.
- Comprobación rápida: `curl -o /dev/null -w "%{http_code}\n" -X POST https://<host>/api/webhooks/<x> -d '{}'` → **308 = roto**; **400 = bien** (la app contesta, solo falta la firma).
- Si un webhook de Mux se pierde y deja vídeos sin `muxPlaybackId`, reconciliar con `scripts/backfill-mux-playback.ts` (dry-run por defecto; ver cabecera del script). Desde sep-2026 la app se reconcilia sola (ver siguiente sección); el script queda como herramienta manual.

## Mux: la app NO depende del webhook (reconciliación)

Un webhook perdido dejaba la lección en "Vídeo en preparación" para siempre aunque el asset estuviera listo en Mux (pasó en jul-2026 y otra vez en sep-2026, con la URL ya en `www`). Desde sep-2026 el webhook es solo el camino rápido; `src/lib/mux-reconcile.ts` va a la API de Mux (fuente de la verdad) y persiste `muxAssetId`/`muxPlaybackId` desde cuatro puntos:

| Punto | Cuándo | Qué hace |
|---|---|---|
| Página de lección del alumno | VIDEO con upload pero sin playbackId | `reconcileLessonVideo()` antes de firmar tokens: si Mux dice `ready`, el alumno ve el vídeo en esa misma carga. Throttle 15 s por lección. |
| Admin `/admin/courses/[id]` | al cargar | `reconcilePendingVideos({ courseId })` sobre todas las pendientes del curso. |
| Diálogo de subida (admin) | lección existente con upload sin playbackId | Polling cada 8 s vía server action `checkLessonVideo()`; rellena el playback ID en el formulario solo. |
| Cron `/api/cron/mux-reconcile` | diario 05:30 UTC (`vercel.json`) | Barrido global. Requiere `CRON_SECRET` en Vercel (Production); sin ella responde 503. Plan Hobby solo permite crons diarios; en Pro puede subirse a horario. |

Reglas que mantienen esto coherente:

- **Resolver siempre desde `muxUploadId`**, no desde `muxAssetId`: al reemplazar un vídeo el uploadId es el nuevo; un assetId viejo devolvería el vídeo anterior.
- **Upload nuevo resetea `muxAssetId` y `muxPlaybackId`** (`/api/mux/upload-url` y `updateLesson`).
- **`updateLesson` no pisa `muxPlaybackId` con null** si el form llega vacío y el upload no ha cambiado (carrera "diálogo abierto mientras Mux termina").
- Asset `errored` en Mux → se limpian los ids (igual que el webhook) para poder resubir.

## Autorización

- **Sesión JWT** (no DB sessions). El rol se persiste en el token tras el primer login y en cada `update`. Si cambias el rol de un usuario en DB, su JWT no refleja el cambio hasta que el token rote (24 h por defecto).
- **Edge proxy** (`src/proxy.ts` — en Next 16, antes `middleware.ts`) usa `auth.config.ts` (sin adapter Prisma) para gating sin tocar DB. **Debe vivir en `src/proxy.ts`** (cuando hay carpeta `src/`); en raíz se ignora silenciosamente.
- ⚠️ **El gating del proxy es MANUAL** (lee `req.auth` e inspecciona `pathname` dentro de la función). NextAuth v5 **NO ejecuta `callbacks.authorized`** cuando el middleware se envuelve con una función propia (lo hacemos, para el CSP) — sería código muerto. Por eso `auth.config.ts` no tiene `authorized`. Ver [issue #12976](https://github.com/nextauthjs/next-auth/issues/12976). Si añades rutas protegidas nuevas, **actualiza el gating en `proxy.ts`**, no un `authorized` callback.
- **Defense in depth**: además del proxy, cada zona protegida revalida server-side con `auth()` — `/admin` en su layout (`src/app/admin/layout.tsx`), `/dashboard` en cada `page.tsx`. Ninguna de las dos capas debe ser la única: el proxy es la red de seguridad ante un olvido server-side, y viceversa.
- Acceso a contenido por `Enrollment`. Helper `canAccessLesson(userId, lessonId)` en `src/lib/access.ts` (Fase 4).
- Tras refund (webhook `charge.refunded`): borrar `Enrollment` correspondiente.

## Seguridad de transporte y CSP

- Cabeceras estáticas (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP) en `next.config.ts`.
- **Content-Security-Policy con nonce por petición** en `src/proxy.ts`. Next.js 16 propaga el nonce automáticamente cuando ve el header `Content-Security-Policy` en el request.
- Allow-list incluye Mux (`*.mux.com`, `*.litix.io`), Mux Direct Upload (`storage.googleapis.com` en `connect-src` — el navegador sube el vídeo al bucket GCS de Mux), R2 uploads (`*.r2.cloudflarestorage.com` en `connect-src` — covers/PDFs por PUT directo), Stripe (`js.stripe.com`), Sentry (`*.ingest.sentry.io`), Vercel vitals.
- Si un nuevo proveedor inyecta scripts, **añadir su origen** a `script-src`/`connect-src`/`frame-src` en `src/proxy.ts`. No usar `'unsafe-inline'` para scripts.
- Si renombras o mueves `proxy.ts` y dev devuelve 500 con `MODULE_UNPARSABLE`, borra `.next/` antes de relevantar.

## Rate limiting

- Magic link (`/login`) y `/api/checkout` van rate-limited contra Upstash Redis (`src/lib/rate-limit.ts`).
- **Sin `UPSTASH_REDIS_REST_URL`/`_TOKEN` definidos**, los limiters son **no-op** silenciosos. Esto permite dev/test sin Redis. En producción **deben** estar definidos.

## Mux signed playback

- `createDirectUpload()` selecciona política `signed` o `public` automáticamente según `isMuxSigningConfigured()`.
- Para reproducir, llamar `signPlaybackTokens(playbackId)` server-side (devuelve `null` si signing no está configurado) y pasar el resultado al `<VideoPlayer tokens={...} />`.
- Tokens por defecto caducan a las 6 h.

## Progreso del alumno

- Modelo `LessonProgress` con `(userId, lessonId)` único, `lastSeconds` (resume) y `completedAt`.
- Server actions en `src/lib/progress.ts`. Validan `Enrollment` antes de escribir y devuelven `{ ok: false }` silencioso si fallan (no romper el reproductor).
- Auto-complete a 95 % de duración en vídeo. PDF/TEXT requieren botón explícito.

## URLs de lección (pretty URLs)

- Forma: `/dashboard/cursos/<courseSlug>/<title-slug>-<lessonId>`. El **id `cuid` final es la clave real** de búsqueda; el slug del título es cosmético. No hay campo `slug` en `Lesson` (cero migraciones); estable al reordenar; renombrar solo cambia la parte cosmética.
- Helpers en `src/lib/lesson-url.ts` (`lessonHref`, `lessonSegment`, `lessonIdFromParam`). El parseo se apoya en que los `cuid` **no llevan guiones** → el id es el segmento tras el último `-`.
- `src/app/dashboard/cursos/[slug]/page.tsx` es solo un **redirector**: resuelve la primera lección (u honra `?l=<id>` legacy) y redirige a su URL canónica; solo renderiza si el curso no tiene lecciones (estado vacío).
- La vista real vive en `src/app/dashboard/cursos/[slug]/[lesson]/page.tsx`. Si el slug cosmético está obsoleto, hace 308 a la forma canónica.

## Teaser / vista previa gratuita

- Campo `Lesson.previewSeconds` (`Int?`). Si está puesto en una lección **VIDEO con `muxPlaybackId`**, esa lección se ofrece como teaser público en la landing `/cursos/[slug]`: se reproduce **sin matrícula**, cortada a esos segundos, y al llegar al corte tapa el vídeo con un CTA de compra. Se marca en el temario con un badge.
- Se activa desde el admin (campo "Vista previa gratis (segundos)" en el diálogo de lección). Vacío = lección normal. Cualquier vídeo ya subido sirve: **no hay que resubir ni reprocesar nada**.
- Solo se muestra **una** preview por curso: la primera por `order`. Marcar varias no muestra varias.
- Componente `src/components/course-preview-player.tsx` (aparte del `VideoPlayer` de alumno: sin progreso ni watermark de contenido de pago).
- ⚠️ **El corte es client-side**: el asset firmado se sirve entero al navegador, así que un usuario técnico puede extraer la lección completa. Es un **gancho de marketing, no contenido protegido** → marcar la lección de intro, nunca contenido premium. El contenido de pago sigue tras `Enrollment` en `/dashboard`.
- Coste: reutiliza un asset ya almacenado (0 € de storage extra) y Mux solo cobra los minutos realmente servidos. A tráfico realista son céntimos/mes.
- Los PACK (solo PDF) no pueden tener teaser con este mecanismo.

## Suscripciones (preparación mensual)

- `Course.billing` = `ONE_TIME` (default) o `SUBSCRIPTION`. En SUBSCRIPTION, `priceCents` es la **cuota mensual** y `enrollmentFeeCents` la **matrícula/material** que se cobra una sola vez en la primera factura (item one-time en el Checkout de modo `subscription`; Stripe no lo repite en renovaciones). `billing` es **inmutable tras crear** el curso (como `type`): el form lo bloquea y `updateCourse` lo descarta. Los PACK no pueden ser suscripción (refine en `validations/course.ts`).
- **El acceso sigue viviendo en `Enrollment`**: se crea al completarse el checkout y se **borra** cuando la suscripción muere (modelo acordado: al cancelar se pierde todo, matrícula incluida). Así `canAccessLesson`, dashboard y demás gating funcionan sin cambios. El modelo `Subscription` (unique `stripeSubscriptionId` y `[userId, courseId]`) solo refleja el estado de Stripe.
- **Webhooks**: `checkout.session.completed` (modo subscription → upsert `Subscription` + `Enrollment`), `customer.subscription.updated` (renovaciones, past_due, cancel_at_period_end) y `customer.subscription.deleted` (cancelación efectiva → borrar `Enrollment`). ⚠️ El endpoint de Stripe en producción filtra por evento: **añadir los dos `customer.subscription.*` al endpoint existente** (editar, no recrear; y siempre `www`).
- Impago: `past_due` mantiene el acceso mientras Stripe reintenta; configurar en Stripe (Settings → Subscriptions/Billing) que tras agotar reintentos la suscripción se **cancele** (eso dispara el `deleted` que retira el acceso).
- **Portal de cliente**: `POST /api/billing-portal` (botón en `/dashboard`) redirige al Customer Portal (tarjeta, facturas, cancelar). Requiere **guardar una vez** la configuración del portal en el dashboard de Stripe (test y live por separado). El 303 va a `billing.stripe.com`, que está en `form-action` del CSP (mismo gotcha que `checkout.stripe.com`).
- Stripe SDK v22 (API "Basil"): `current_period_end` vive en `subscription.items.data[0]`, no en la suscripción; y `Checkout.SessionCreateParams` no se reexporta (en `checkout/route.ts` se deriva de la firma del método).
- Un `charge.refunded` de una factura de suscripción no encuentra `Order` por payment intent (las suscripciones no lo guardan) → se loguea y no retira acceso; para reembolsar+expulsar, cancelar la suscripción además del refund.

## Reseñas

- Modelo `Review` con estados PENDING/APPROVED/REJECTED y `(userId, courseId)` único.
- `submitReview` exige `Enrollment`. Reenviar **edita** la reseña existente y la vuelve a `PENDING`.
- Solo `APPROVED` aparece en la landing pública. Moderación en `/admin/reviews`.

## Contenido editable de la web (SiteContent)

Casi todo el texto público de la home es editable desde `/admin/contenido` sin tocar código, vía el modelo `SiteContent` (clave → valor).

- **Catálogo de claves**: `src/lib/site-content-keys.ts` (`SITE_CONTENT_KEYS`). Cada clave declara `type`, `section`, `label`, `hint` y `default`. Para añadir un campo editable, basta con declarar la clave aquí y leerla donde toque.
- **Tipos de campo**: `text` (input/textarea), `rich` (editor TipTap → HTML sanitizado con `src/lib/html.ts`), `image` (sube a R2 con URL firmada o pega URL; widget `src/app/admin/contenido/_image-field.tsx`). El sanitizado (`sanitizeRichHtml`) se aplica **al guardar**, no al renderizar, en los 3 puntos de escritura de HTML rich: artículos (`articulos/_actions.ts`), SiteContent rich (`contenido/_actions.ts`) y lecciones TEXT (`courses/[id]/_lessons-actions.ts`). Solo se sanitizan claves `rich`; los `text`/`image` se guardan literales.
- **Lectura** (server-only, cacheado por petición): `getAllContent()` / `pickContent(map, key)` / `getContent(key)` en `src/lib/site-content.ts`. Si no hay fila en DB se usa el `default` de la clave.
- **Guardado / reset**: server actions en `src/app/admin/contenido/_actions.ts` (`saveSiteContent`, `resetSiteContentKey`, `requestSiteImageUploadUrl`); `revalidatePath("/")` tras guardar. ⚠️ Vaciar un campo NO lo resetea (se ignora en el guardado); para volver al `default` hay que pulsar "Resetear" (borra la fila).
- **Cobertura actual de la home**: Hero (badge, subtítulo, 3 botones), Cursos destacados (título, subtítulo), Sobre mí (etiqueta, título, cuerpo `rich`, imagen), Por qué esta plaza (etiqueta, título, 3 bloques), CTA final (título, texto, botón), Cifras. El `<h1>` "Bienvenido a tu plaza" del hero queda fijo (es la marca).

## Marca y diseño

- **Paleta** en `src/app/globals.css` (tokens oklch bajo `:root`), derivada del logo. Cambiar un token cascadea por toda la web vía Tailwind (`bg-brand-*`, `text-brand-*`, degradados…). El mapeo de tokens está en el bloque `@theme inline` del mismo fichero:
  - `--brand-celeste` = teal `#2FB8C8` (+ `-deep`, `-foreground`)
  - `--brand-magenta` = morado `#8A5FC0` (+ `-deep`, `-foreground`)
  - `--brand-amber` = naranja `#F0A828` (+ `-deep`, `-foreground`) — acento; se cablea a mano (wordmark "plaza" en header/footer, tarjetas de "Por qué esta plaza").
- **Logo**: `public/brand/logo-icon.png` (icono cohete+libro, fondo transparente). Lo usan `src/components/public-header.tsx`, `src/components/public-footer.tsx` y el hero (`src/app/page.tsx`). Único asset de marca commiteado.
- **Subidas a R2 desde el navegador** (covers, imágenes de sitio, PDFs de lección) necesitan el host de R2 en `connect-src` de la CSP (`src/proxy.ts`): `https://*.r2.cloudflarestorage.com`. Sin él, el PUT firmado falla con "Failed to fetch". Recordatorio operativo: las `R2_*` deben estar en el scope **Production** de Vercel y el nombre exacto que valida `env.ts` es `R2_ACCESS_KEY_ID` (no `R2_ACCESS_KEY`).

## ⚠️ Bloqueos LaLiga → imágenes públicas vía `/img/<key>`, no `r2.dev`

Los ISPs españoles bloquean rangos de IP compartidos de Cloudflare durante las ventanas de partido (orden judicial de LaLiga, activa desde feb-2025). Eso tumba `pub-*.r2.dev` y `*.r2.cloudflarestorage.com` para usuarios afectados: un "Failed to fetch" al subir un PDF/cover desde `/admin` en fin de semana por la tarde **no es un bug** — es el bloqueo (workaround: datos móviles/VPN o esperar).

- Las imágenes públicas (covers, `site/`) **se sirven por `/img/<key>`** (`src/app/img/[...key]/route.ts`): Vercel lee de R2 server-side (fuera de los bloqueos) y el CDN cachea la respuesta (`immutable` — las keys llevan timestamp+random). Solo permite prefijos `covers/` y `site/`; los ficheros de lección siguen por su ruta autorizada.
- En DB se guarda la URL canónica de R2; la reescritura a `/img/` es **en render** vía `proxiedImageSrc()` (`src/lib/public-image.ts`). Al añadir un nuevo punto de renderizado público de imágenes de R2, envolver el `src` con ese helper.
- `/img/` está excluido del matcher del proxy (no necesita CSP ni gating).

## Archivos críticos

| Path | Rol |
|---|---|
| `prisma/schema.prisma` | Modelo de datos |
| `src/lib/db.ts` | Cliente Prisma singleton |
| `src/lib/env.ts` | Variables de entorno validadas |
| `src/lib/auth.config.ts` | Auth.js config edge-safe (sin adapter, usado por proxy) |
| `src/lib/auth.ts` | Auth.js completo: handlers, signIn/signOut, adapter Prisma |
| `src/types/next-auth.d.ts` | Augmentación de tipos: `session.user.role` |
| `src/app/api/auth/[...nextauth]/route.ts` | Route handler de Auth.js |
| `prisma/seed.ts` | Seed de admin (lee `ADMIN_EMAIL` del env) |
| `src/lib/stripe.ts` | Cliente Stripe + helpers |
| `src/lib/mux.ts` | Cliente Mux + `signPlaybackTokens()` para signed playback |
| `src/lib/storage.ts` | URLs firmadas de R2 (PDFs / covers) |
| `src/lib/access.ts` | Helpers de autorización (`canAccessLesson`, `canAccessCourse`) |
| `src/lib/rate-limit.ts` | Rate limiters Upstash (no-op sin keys) |
| `src/lib/progress.ts` | Server actions de `LessonProgress` |
| `src/lib/reviews.ts` | Server actions de `Review` (alumno + admin) |
| `src/lib/json-ld.ts` | Builders schema.org/Course y Article |
| `src/lib/legal.ts` | Defaults + lookup de `LegalDocument` |
| `src/lib/site-content.ts` | Lookup + defaults de `SiteContent` |
| `src/lib/html.ts` | Sanitizer del editor TipTap |
| `src/app/api/webhooks/stripe/route.ts` | Receptor de eventos Stripe |
| `src/app/api/webhooks/mux/route.ts` | Receptor de eventos Mux |
| `src/lib/mux-reconcile.ts` | Reconciliación upload→asset→playback contra la API de Mux (no depender del webhook) |
| `src/app/api/cron/mux-reconcile/route.ts` | Cron diario (Vercel) que barre vídeos pendientes; auth por `CRON_SECRET` |
| `vercel.json` | Definición de crons |
| `src/app/api/checkout/route.ts` | Crear Checkout Session |
| `src/proxy.ts` | Edge proxy: gating + CSP (Next 16; vivía como `middleware.ts`) |
| `next.config.ts` | Cabeceras estáticas de seguridad (HSTS, etc.) |

## Despliegue

- **Vercel**: deploy automático desde `main`. PR → preview deploy con DB branch separada en Neon.
- **Migraciones en build**: añadir `prisma migrate deploy && next build` como build command en Vercel.
- **Variables**: gestionadas en el dashboard de Vercel; sincronizadas con `vercel env pull` en local si hace falta.
- **Scope de las env vars**: las credenciales de servicios externos con estado o cuota (Upstash, Mux, R2, Stripe) van **solo en Production**, no en Preview. Compartirlas haría que los preview deploys escriban en el recurso real (contadores de rate limit, assets de Mux, ficheros de R2) y consuman cuota. El código degrada limpio sin ellas (`is*Configured()` → `false`). Si algún día hace falta probar uno de estos servicios en un preview, usar un entorno/credencial aparte (p. ej. el entorno *Development* de Mux), nunca las claves de prod.
- **Las env vars no se aplican retroactivamente**: tras añadir o cambiar una variable hay que **redeploy** para que entre en vigor.

## Riesgos conocidos

Detallados en el plan. Resumen rápido:
1. Webhooks Stripe: probarlos con `stripe listen` desde el día 1.
2. Idempotencia obligatoria en webhooks (modelo `StripeEvent`).
3. Coste de vídeo: Mux/CF Stream cobran por minuto visto.
4. IVA EU: activar Stripe Tax desde el principio.
5. Refund → borrar `Enrollment`.
