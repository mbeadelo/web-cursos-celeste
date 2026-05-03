# Decisiones

Registro de las elecciones técnicas importantes y por qué se tomaron. Si algún día alguien pregunta "¿y por qué no X?", aquí está la respuesta.

## Stack: Next.js sobre Laravel

**Elegimos Next.js 16** (App Router + TypeScript) en lugar de Laravel/PHP.

**Por qué**:
- TypeScript en front y back, un solo lenguaje.
- Stripe, Mux y Auth.js tienen DX de primera clase en TS.
- Server Components + Server Actions reducen mucho código de plumbing.
- Free tier de Vercel cubre holgadamente un MVP <100 alumnos.

**Por qué no Laravel**:
- Aunque Webempresa (hosting actual) está optimizado para PHP, montar Node ahí no es trivial.
- Filament/Cashier dan ventaja en admin panel y Stripe respectivamente, pero no compensan el cambio de lenguaje.

**Por qué no Astro**:
- Astro brilla en sitios mayoritariamente estáticos. Aquí hay mucha lógica autenticada (admin, dashboard) que tira más de un framework full-stack.

## Hosting: Vercel + Neon

**Vercel** para la app, **Neon** para Postgres.

**Por qué**:
- Deploy automático desde GitHub, sin tocar servidores.
- Branches de DB en Neon que se enchufan a previews de Vercel → PR previews con DB aislada.
- Coste €0 inicial, €20–25/mes cuando crezcamos.

**Por qué no Webempresa**:
- LAMP/cPanel no corre Node de forma decente.
- Lo conservamos para el correo y el dominio.

## Auth: Auth.js v5 con magic link

**Elegimos Auth.js v5** (NextAuth) con Email provider.

**Por qué**:
- Gratis, control total, integrado con Prisma.
- Magic link evita gestión de contraseñas (un dolor de cabeza menos: bcrypt, reset, brute force).
- Sin contraseñas → sin filtraciones de contraseñas.

**Por qué no Clerk / Supabase Auth / WorkOS**:
- Excelentes pero todos cobran por encima de cierto MAU.
- Para un MVP de cursos donde el alumno entra pocas veces al mes, magic link es suficiente y más barato.
- Si Auth.js bloquea, plan B es Clerk (gratis hasta 10k MAU).

## Pagos: Stripe Checkout (no Stripe Elements)

Usamos **Checkout** (página alojada por Stripe), no Elements (formulario de tarjeta dentro de nuestra web).

**Por qué Checkout**:
- PCI scope mínimo: nunca tocamos datos de tarjeta.
- 3D Secure / SCA / Apple Pay / Google Pay todos automáticos.
- Generación de factura automática (importante para España).
- Menos código que mantener.

**Por qué no Elements**:
- Da más control de UI pero a cambio asumes más responsabilidad.
- Para un MVP, Checkout es claramente la opción correcta.

## Vídeo: Mux

**Elegimos Mux** (con Cloudflare Stream como backup mental).

**Por qué Mux**:
- Signed playback URLs nativas → no se pueden compartir enlaces.
- HLS adaptativo → funciona en cualquier ancho de banda.
- API y SDK muy limpios (`@mux/mux-player-react`).

**Por qué no YouTube unlisted**:
- Los enlaces se filtran. No puedes revocar acceso.
- Sin control de calidad / sin marca propia.

**Por qué no self-hosted (Bunny Stream, etc.)**:
- Más barato pero más cosas que mantener.
- Para un MVP, Mux/CF Stream son lo más eficiente.

**Coste estimado**: €0–20/mes con catálogo pequeño y <100 alumnos.

## Storage: Cloudflare R2

**Elegimos R2** para PDFs y portadas.

**Por qué**:
- API compatible con S3 (cualquier SDK funciona).
- **Sin egress fees** — clave si los alumnos descargan mucho.
- Plan gratis: 10 GB de storage + 1M operaciones de clase A/mes.

**Por qué no Supabase Storage**:
- Buena alternativa pero egress no es gratis a partir de cierto volumen.

**Por qué no S3**:
- Más conocido, sí, pero AWS factura egress y complica la cuenta.

## Validación: Zod

**Zod** para todos los schemas (env, formularios, parsing de webhooks).

**Por qué**:
- Schema-first: defines una vez, obtienes tipos TS y runtime check.
- API intuitiva.
- Estándar de facto en el ecosistema TS hoy.

## Toolchain: Volta + pnpm

**Volta** fija la versión de Node al proyecto.
**pnpm** para gestionar dependencias.

**Por qué Volta**:
- Cambia automáticamente la versión de Node al `cd` al proyecto.
- No requiere admin en Windows.
- Multiplataforma.

**Por qué pnpm**:
- 2-3× más rápido que npm.
- Mucho menos espacio en disco (hard links).
- Mejor manejo de monorepos por si en el futuro escalamos.

## Tipos de tests (a futuro)

Plan: **Vitest** para unit + integration. **Playwright** si necesitamos E2E.

Aún no instalado. Empezaremos a escribir tests cuando tengamos lógica suficientemente compleja (probablemente en Fase 3 con los webhooks de Stripe).
