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

- **Login** de alumnos (magic link en Fase 1, posiblemente Google después).
- **Sesiones** persistentes en la DB (tabla `Session`).
- **Roles**: `STUDENT` (default) y `ADMIN`. El rol vive en `User.role`. El middleware revisa la sesión y bloquea `/admin/*` si el rol no es `ADMIN`.

Versión: **Auth.js v5** (el "next-auth@beta"). Cambia algunas cosas respecto a v4 — el Provider, la API, la configuración. Importante porque mucha documentación antigua sigue refiriéndose a v4.

## ¿Cómo funciona magic link en la práctica?

1. Alumno mete su email en `/login`.
2. Auth.js genera un token, lo guarda en `VerificationToken`, manda email vía Resend.
3. Alumno hace clic en el enlace del email. URL del estilo `/api/auth/callback/email?token=...`.
4. Auth.js verifica el token (que no haya expirado, que coincida).
5. Crea sesión, devuelve cookie. El alumno está logueado.

Ventajas: **sin contraseñas que gestionar, recordar, resetear o filtrar**.

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
