# Auth.js (NextAuth)

## ¿Qué es?

Auth.js (antes "NextAuth") es la **librería de autenticación** estándar para Next.js. Resuelve los problemas aburridos de auth para que no los tengas que escribir tú: registrar usuarios, mantener sesiones, validar emails, login con Google/GitHub/etc., manejo de cookies seguras, CSRF, etc.

Funciona con un patrón llamado **adapters**: tú le dices "guarda los usuarios y sesiones en Prisma + Postgres" (con el adapter `@auth/prisma-adapter`) y Auth.js se encarga del resto.

Soporta varios métodos:

- **Email magic link**: el alumno mete su email, recibe un enlace, hace clic y entra.
- **OAuth**: login con Google, GitHub, Discord, etc.
- **Credentials**: contraseña tradicional (Auth.js lo soporta pero no lo recomienda y nosotros tampoco lo usaremos).

## ¿Para qué lo usamos?

Auth de toda la app:

- **Login** de alumnos: magic link por email (Resend). Posiblemente Google después.
- **Sesiones** vía **JWT** (la cookie firmada lleva la info, sin DB hit por request).
- **Roles**: `STUDENT` (default) y `ADMIN`. El rol vive en `User.role` y se persiste en el JWT en el primer login. El middleware lo lee del token sin tocar DB y bloquea `/admin/*` si el rol no es `ADMIN`.

Versión: **Auth.js v5** (el "next-auth@beta"). Cambia algunas cosas respecto a v4 — el Provider, la API, la configuración. Importante porque mucha documentación antigua sigue refiriéndose a v4.

## Cómo está organizado en el repo

Auth.js v5 con adapter no-edge (Prisma) requiere splitting:

| Archivo | Propósito | Edge-safe |
|---|---|---|
| `src/lib/auth.config.ts` | `pages`, `session.strategy: "jwt"`, `callbacks.authorized` (gating). Sin imports de Prisma. | ✅ |
| `src/lib/auth.ts` | Importa `auth.config.ts`, le añade `PrismaAdapter`, providers (Resend), callbacks `jwt` y `session`. Exporta `auth`, `signIn`, `signOut`, `handlers`. | ❌ |
| `src/types/next-auth.d.ts` | Augmenta `Session.user` con `id` y `role`. | — |
| `src/app/api/auth/[...nextauth]/route.ts` | Re-exporta `handlers.GET` y `handlers.POST`. | — |
| `middleware.ts` | `NextAuth(authConfig).auth` exportado como middleware. Solo importa `auth.config.ts`. | ✅ |

## ¿Cómo funciona magic link en la práctica?

1. Alumno mete su email en `/login`. El form llama una server action que invoca `signIn("resend", { email, redirectTo: "/dashboard" })`.
2. Auth.js genera un token, lo guarda en `VerificationToken`, manda email vía Resend.
3. Alumno hace clic en el enlace del email. URL del estilo `/api/auth/callback/email?token=...`.
4. Auth.js verifica el token (que no haya expirado, que coincida).
5. Persiste user/account si es nuevo, emite **JWT** y lo guarda como cookie HttpOnly. El alumno aterriza en `/dashboard`.

Ventajas: **sin contraseñas que gestionar, recordar, resetear o filtrar**.

## JWT vs Database session

Elegimos JWT (no `session: { strategy: "database" }`) porque:

- El middleware corre en edge runtime; Prisma con adapter Postgres ahí es complicado.
- Latencia mínima: edge middleware tarda <5 ms.

**Trade-off documentado**: si cambias el rol de un usuario en DB, su JWT no refleja el cambio hasta que rote (24 h por defecto). Para revocación inmediata habría que reemitir tokens manualmente. Aceptable para MVP.

## Alternativas que valoramos

- **Clerk**: gratis hasta 10k MAU, UI lista. Si Auth.js bloquea, plan B.
- **Supabase Auth**: integrado con Supabase, gratis. No tenemos Supabase.
- **WorkOS / Stytch**: empresariales, caros.
- **Lucia**: librería minimalista. Excelente, pero Auth.js tiene más comunidad.
- **Rodarlo a mano**: nunca. Auth es un campo minado.

## Enlaces

- [Sitio oficial](https://authjs.dev)
- [Documentación v5](https://authjs.dev/getting-started/installation)
- [Adapter de Prisma](https://authjs.dev/getting-started/adapters/prisma)
