# Fase 1 — Auth y modelo base

> **Objetivo**: alumnos pueden registrarse y entrar con magic link; el admin marcado en DB puede acceder a `/admin`.

> **Estado**: ✅ Completada.

## Resumen del flujo

```
Visitante                                                 Sistema
─────────                                                 ──────
1. /login → mete email → "Enviar enlace"
                                       ──→  POST /api/auth/signin/resend
                                            │
                                            ├─ Auth.js genera token
                                            ├─ Lo guarda en VerificationToken
                                            └─ Llama a Resend → email saliente
                                       ←──  302 redirect

2. Recibe email                              ─ Resend ─→  Inbox del usuario
   con enlace mágico

3. Click en enlace → /api/auth/callback/email?token=...
                                       ──→  Auth.js valida token
                                            │
                                            ├─ Si OK: borra token, crea/actualiza
                                            │  User en DB, emite JWT cookie
                                            └─ Redirect a callbackUrl (/dashboard)

4. /dashboard                                ──→  middleware lee JWT, deja pasar
                                                  layout server hace auth() y muestra
                                                  cursos (vacío en Fase 1)
```

## Lo que se añadió al código

### Dependencias

| Paquete | Propósito |
|---|---|
| `next-auth@beta` (5.0.0-beta.31) | Auth.js v5 |
| `@auth/prisma-adapter` | Persiste `User`, `Account`, `VerificationToken` en Postgres |
| `resend` | SDK oficial (no usado directo por nosotros — Auth.js lo llama vía REST) |

### Archivos nuevos

```
src/lib/auth.config.ts                  Config edge-safe (sin DB), usado por middleware
src/lib/auth.ts                         Config completa: adapter Prisma + Resend provider
src/types/next-auth.d.ts                session.user.role tipado
src/app/api/auth/[...nextauth]/route.ts Handler de Auth.js
middleware.ts                           Edge gating de /admin y /dashboard

src/app/login/page.tsx                  Form con server action que llama signIn("resend")
src/app/login/verify/page.tsx           "Revisa tu email"
src/app/dashboard/page.tsx              Dashboard alumno con logout
src/app/admin/layout.tsx                Doble verificación de rol ADMIN
src/app/admin/page.tsx                  Admin home (placeholder para Fase 2)

prisma/seed.ts                          Upsertea ADMIN_EMAIL con role=ADMIN
prisma/migrations/20260503181142_init/  Migración inicial: todas las tablas

scripts/check-tokens.ts                 CLI helper para listar VerificationToken
```

### Archivos modificados

- `src/lib/env.ts`: ahora exige `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`.
- `src/app/page.tsx`: home rebrandeada, lee sesión y muestra "Acceder" o "Ir a mis cursos".
- `src/app/layout.tsx`: metadata con marca y `metadataBase: bienvenidoatuplaza.com`.
- `package.json`: nuevo script `db:seed`.

## Variables de entorno añadidas

| Variable | Ejemplo | Notas |
|---|---|---|
| `AUTH_SECRET` | 32+ chars random | Genera con `pnpm dlx auth secret` (escribe `BETTER_AUTH_SECRET` por error — renómbralo) o con PowerShell: `$bytes = New-Object byte[] 32; (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes); [Convert]::ToBase64String($bytes)`. Cifra/firma cookies y JWTs. |
| `RESEND_API_KEY` | `re_xxx...` | Crear en Resend dashboard. Solo `Sending access`, no `Full access`. |
| `EMAIL_FROM` | `Bienvenido a tu plaza <onboarding@resend.dev>` | Sin dominio verificado, usar `onboarding@resend.dev`. Tras verificación, cambiar a `noreply@bienvenidoatuplaza.com`. |
| `ADMIN_EMAIL` | `mabedepro@gmail.com` | Email del primer admin. El seed lo upsertea con `role=ADMIN`. |

## Decisiones de Fase 1

### Sesión por JWT, no por DB

Auth.js soporta dos estrategias de sesión:

- **Database**: cada request consulta la tabla `Session` por DB lookup.
- **JWT**: la info de sesión va firmada en una cookie. Sin DB hit por request.

Elegimos **JWT** porque:

- El middleware corre en el edge runtime de Vercel — donde Prisma con adapter Postgres no es trivial.
- Latencia mínima: edge middleware tarda <5 ms.
- Auth.js sigue usando el adapter Prisma para crear users y verification tokens. La tabla `Session` queda sin uso.

**Trade-off**: si cambias el rol de un usuario en DB, su JWT no refleja el cambio hasta que el token rote (24 h por defecto). Para revocación inmediata habría que reemitir tokens manualmente. En MVP es aceptable.

### Config partida en `auth.config.ts` + `auth.ts`

Auth.js v5 requiere splitting cuando usas un adapter no-edge:

- **`auth.config.ts`**: edge-safe (no importa Prisma). Define `pages`, `session`, `callbacks.authorized`. Usado por `middleware.ts`.
- **`auth.ts`**: importa `auth.config.ts`, le añade el adapter Prisma, los providers y los callbacks `jwt` / `session`. Usado por route handlers, server components y server actions.

### Middleware + revalidación en layouts (defense in depth)

`middleware.ts` bloquea con `authorized` callback. Pero **además** `/admin/layout.tsx` re-comprueba con `auth()` server-side. Si alguien encuentra una manera de saltar el middleware (bug, mal config), los layouts cazan.

### Magic link sin contraseñas

Único método de auth en Fase 1: email magic link. Sin formulario de contraseña, sin lógica de reset, sin filtraciones de credenciales. Con MVP de cursos donde el alumno no entra todos los días, friction cero.

## Bloqueos resueltos durante Fase 1

1. **`pnpm dlx auth secret` resolvió a `better-auth`** — generó `BETTER_AUTH_SECRET` en lugar de `AUTH_SECRET`. Solución: renombrar la variable (el valor sirve igual).
2. **PowerShell 5.1 no tiene `RandomNumberGenerator.GetBytes` estático** — el comando original solo funciona en PS 7. Alternativa documentada con la API instance-based.
3. **Vercel no permite vars Sensitive en entorno Development** — Development está pensado para `vercel env pull`, los secretos sensibles no se pueden recuperar. Solución: configurar solo Production + Preview, usar `.env` local.
4. **`pages.verifyRequest` en Auth.js v5 beta.31** — el redirect tras enviar el email va a la URL por defecto `/api/auth/verify-request` en lugar de a nuestra `/login/verify`. Cosmético; el flujo funciona. Pendiente revisar en una iteración futura.
5. **Top-level `await` en scripts CJS** — `tsx` carga `.ts` como CJS si `package.json` no es ESM. Solución: envolver en función `main()`.

## Verificación

### Local

```powershell
# 1. Aplica la migración
pnpm exec prisma migrate dev --name init

# 2. Marca tu email como ADMIN
pnpm db:seed

# 3. Arranca dev
pnpm dev

# 4. Smoke test
# http://localhost:3000           → 200, botón "Acceder"
# http://localhost:3000/login     → 200, form con email
# http://localhost:3000/dashboard → 307 → /login (sin sesión)
# http://localhost:3000/admin     → 307 → /login (sin sesión)

# 5. Inspeccionar tokens en DB
pnpm exec tsx scripts/check-tokens.ts
```

### Producción (Vercel)

Mismo flujo en `https://web-cursos-celeste.vercel.app/`. Variables de entorno configuradas en Production + Preview con flag Sensitive.

```bash
curl -I https://web-cursos-celeste.vercel.app/dashboard
# 307 redirect to /login?callbackUrl=...
```

## Commits

```
3cedfaa  feat(db): commit init migration + check-tokens helper
f8de75f  feat(auth): phase 1 — Auth.js v5 with Resend magic link, role-based gating
```

## Próxima fase

**Fase 2 — Admin CRUD de cursos**.

Objetivos:

- `/admin/courses`: listar, crear, editar, publicar/despublicar cursos.
- Subir cover image a R2 (signed upload URL).
- CRUD de `Lesson` con drag-and-drop reorder.

Servicios a crear: **Cloudflare R2** para imágenes y PDFs.
