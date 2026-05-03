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

- Gating por rol en `middleware.ts` (`/admin/*` requiere `ADMIN`).
- Acceso a contenido por `Enrollment`. Helper `canAccessLesson(userId, lessonId)` en `src/lib/access.ts` (Fase 4).
- Tras refund (webhook `charge.refunded`): borrar `Enrollment` correspondiente.

## Archivos críticos

| Path | Rol |
|---|---|
| `prisma/schema.prisma` | Modelo de datos |
| `src/lib/db.ts` | Cliente Prisma singleton |
| `src/lib/env.ts` | Variables de entorno validadas |
| `src/lib/auth.ts` | Configuración Auth.js (Fase 1) |
| `src/lib/stripe.ts` | Cliente Stripe + helpers (Fase 3) |
| `src/lib/access.ts` | Helpers de autorización (Fase 4) |
| `src/app/api/webhooks/stripe/route.ts` | Receptor de eventos Stripe (Fase 3) |
| `src/app/api/checkout/route.ts` | Crear Checkout Session (Fase 3) |
| `middleware.ts` | Gating de rutas (Fase 1) |

## Despliegue

- **Vercel**: deploy automático desde `main`. PR → preview deploy con DB branch separada en Neon.
- **Migraciones en build**: añadir `prisma migrate deploy && next build` como build command en Vercel.
- **Variables**: gestionadas en el dashboard de Vercel; sincronizadas con `vercel env pull` en local si hace falta.

## Riesgos conocidos

Detallados en el plan. Resumen rápido:
1. Webhooks Stripe: probarlos con `stripe listen` desde el día 1.
2. Idempotencia obligatoria en webhooks (modelo `StripeEvent`).
3. Coste de vídeo: Mux/CF Stream cobran por minuto visto.
4. IVA EU: activar Stripe Tax desde el principio.
5. Refund → borrar `Enrollment`.
