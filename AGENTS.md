<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# web-cursos-celeste

Plataforma de cursos online (vídeo + PDFs) con autenticación de alumnos, pagos con Stripe y panel de administración. MVP. Desplegado en Vercel.

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

## Reseñas

- Modelo `Review` con estados PENDING/APPROVED/REJECTED y `(userId, courseId)` único.
- `submitReview` exige `Enrollment`. Reenviar **edita** la reseña existente y la vuelve a `PENDING`.
- Solo `APPROVED` aparece en la landing pública. Moderación en `/admin/reviews`.

## Contenido editable de la web (SiteContent)

Casi todo el texto público de la home es editable desde `/admin/contenido` sin tocar código, vía el modelo `SiteContent` (clave → valor).

- **Catálogo de claves**: `src/lib/site-content-keys.ts` (`SITE_CONTENT_KEYS`). Cada clave declara `type`, `section`, `label`, `hint` y `default`. Para añadir un campo editable, basta con declarar la clave aquí y leerla donde toque.
- **Tipos de campo**: `text` (input/textarea), `rich` (editor TipTap → HTML sanitizado con `src/lib/html.ts`), `image` (sube a R2 con URL firmada o pega URL; widget `src/app/admin/contenido/_image-field.tsx`).
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
