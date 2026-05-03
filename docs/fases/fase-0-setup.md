# Fase 0 — Setup

> **Objetivo**: dejar el proyecto Next.js inicializado, con Prisma, TypeScript estricto, validación de env, repo en GitHub, despliegue funcional en Vercel y documentación operativa.

> **Estado**: ✅ Completada.

## Resumen de cambios

### Estructura creada

```
D:\web-cursos-celeste\
├── .claude/                        # config local de Claude Code (gitignored)
├── docs/                           # esta documentación
│   ├── .vitepress/config.ts
│   ├── arquitectura.md
│   ├── decisiones.md
│   ├── herramientas/
│   ├── fases/
│   ├── index.md
│   └── operativa.md
├── prisma/
│   └── schema.prisma               # modelo de datos
├── src/
│   ├── app/                        # template inicial de Next.js
│   ├── lib/
│   │   ├── db.ts                   # cliente Prisma singleton
│   │   └── env.ts                  # validación de env vars con Zod
│   └── generated/prisma/           # cliente Prisma generado (gitignored)
├── .env.example                    # plantilla de variables de entorno
├── .gitignore
├── AGENTS.md                       # contexto para asistentes AI (Claude, Cursor, Copilot)
├── CLAUDE.md                       # alias que importa AGENTS.md
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

### Toolchain instalado

| Herramienta | Versión | Cómo se gestiona |
|---|---|---|
| Node.js | 22.22.2 | [Volta](/herramientas/volta) (`volta pin node@22`) |
| pnpm | 10.33.2 | Volta (`volta install pnpm@10`) |
| Git | 2.31+ | Sistema |

### Dependencias instaladas

| Paquete | Para qué |
|---|---|
| `next`, `react`, `react-dom` | Framework |
| `@prisma/client`, `prisma` | ORM |
| `@prisma/adapter-pg`, `pg` | Driver PostgreSQL para Prisma 7 |
| `zod` | Validación |
| `tailwindcss`, `@tailwindcss/postcss` | CSS |
| `dotenv` | Carga `.env` para `prisma.config.ts` |
| `tsx` | Ejecutar archivos TS directamente (scripts) |
| `vitepress` | Esta documentación |
| `typescript`, `@types/*` | TS y tipos |
| `eslint`, `eslint-config-next` | Lint |

### Configuración aplicada

- **TypeScript estricto reforzado** en `tsconfig.json`:
  - `strict: true` (heredado del template).
  - `noUncheckedIndexedAccess: true` — acceder a un array por índice devuelve `T | undefined`.
  - `noImplicitOverride: true` — métodos sobrescritos requieren marca `override`.
  - `noFallthroughCasesInSwitch: true` — prohibido olvidar `break` en `switch`.
- **Path alias `@/*` → `src/*`** (heredado).
- **`pnpm.onlyBuiltDependencies`** declarado en `package.json` para permitir `postinstall` de Prisma y esbuild.
- **`postinstall` script**: ejecuta `prisma generate` automáticamente. Necesario para que Vercel tenga los tipos de Prisma en cada build.
- **Volta pin** de Node 22.22.2 en `package.json` — cualquier dev que entre al repo usa esa versión automáticamente.

### Modelo de datos (Prisma schema)

Definido en `prisma/schema.prisma`. Modelos:

| Modelo | Propósito |
|---|---|
| `User` | Usuarios. Campo `role: STUDENT \| ADMIN`. |
| `Course` | Cursos publicables, con `priceCents` y `currency`. |
| `Lesson` | Lecciones de un curso. `type: VIDEO \| PDF \| TEXT`. Campos opcionales para Mux (`muxAssetId`, `muxPlaybackId`), R2 (`fileKey`) o markdown (`body`). |
| `Enrollment` | Quién tiene acceso a qué curso. `source: PURCHASE \| MANUAL`. |
| `Order` | Pedidos hechos vía Stripe. Vincula `User` ↔ `Course` ↔ `stripeSessionId`. |
| `StripeEvent` | Idempotencia de webhooks. PK = `event.id` de Stripe. |
| `Account`, `Session`, `VerificationToken` | Tablas requeridas por Auth.js (con adapter Prisma). |

### Variables de entorno declaradas

Documentadas en `.env.example` y validadas en `src/lib/env.ts`. Por bloques:

- **DB**: `DATABASE_URL` (obligatoria).
- **Auth.js**: `AUTH_SECRET` (obligatoria), `AUTH_URL` (opcional).
- **Resend**: `RESEND_API_KEY`, `EMAIL_FROM`.
- **Stripe**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Mux**: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_WEBHOOK_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`.
- **R2**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

Solo `DATABASE_URL` y `AUTH_SECRET` son obligatorias en el schema actual; el resto son opcionales hasta que se usen.

### Repo y despliegue

- **GitHub**: `mbeadelo/web-cursos-celeste`, rama `main`.
- **Vercel**: conectado al repo, deploy automático desde `main`.
- **Estado**: build verde con la app inicial de Next.js. Sin DB todavía.

## Bloqueos resueltos durante la fase

1. **`pnpm` no estaba instalado** → resuelto con `corepack` (admin).
2. **`pnpm` ejecutaba con Node 20.9** (corepack apuntaba a Node global antiguo) → resuelto instalando Node 22 con Volta y `volta install pnpm`.
3. **Prisma 7 requiere Node 20.19+ / 22.12+** → resuelto al actualizar a Node 22 con Volta.
4. **Prisma 7 requiere adapter explícito** (nuevo generador `prisma-client`) → instalado `@prisma/adapter-pg` y `pg`.
5. **Build de Vercel falló por tipos faltantes** (cliente Prisma generado en `src/generated/prisma`, gitignored) → resuelto añadiendo `postinstall: prisma generate`.
6. **`.env.example` era ignorado por la regla `.env*`** → añadida excepción `!.env.example`.
7. **`.claude/settings.local.json`** estaba siendo trackeado → añadido al `.gitignore`.

## Commits

```
3ec9f8b  fix: run prisma generate on install so Vercel build sees client types
15a2574  chore: phase 0 setup — Prisma schema, env validation, agent docs
51194c1  Initial commit from Create Next App
```

## Próxima fase

**Fase 1 — Auth y modelo base** (todavía no escrita).

Objetivo: alumnos pueden registrarse y entrar con magic link; admin marcado en DB puede acceder a `/admin`.

Servicios a crear: **Neon** (DB) y **Resend** (email).
