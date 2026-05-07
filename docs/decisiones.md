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

## Rate limiting: Upstash Redis

**Elegimos Upstash** para limitar magic-link y checkout.

**Por qué Upstash**:
- API REST sobre HTTP → funciona desde edge sin TCP. Encaja con Next 16.
- Plan free de 10k comandos/día sobra para un MVP.
- Sin ataduras a Vercel, portable.
- `@upstash/ratelimit` ofrece sliding-window con poco código.

**Por qué no `@vercel/kv`**: Es Upstash internamente, pero ata el proyecto a Vercel sin ganancia real.

**Por qué no in-memory**: lambdas efímeras → un atacante distribuye su tráfico entre instancias y rompe el límite.

**Decisión "no-op sin keys"**: si las vars de Upstash no están definidas, los limiters dejan pasar todo. Esto facilita dev/test/previews sin Redis. En producción **deben** estar configuradas.

## CSP: nonce vs SRI

**Elegimos CSP por petición con nonce** (en `src/proxy.ts`) en lugar de Subresource Integrity.

**Por qué nonce**:
- Funciona con scripts dinámicos (Stripe Elements, Mux Player, Sentry browser SDK).
- Next.js 16 propaga el nonce automáticamente cuando ve el header `Content-Security-Policy` en el request.
- Compatible con `'strict-dynamic'`, lo que evita listar manualmente cada hash de script.

**Por qué no SRI**: experimental, requiere generar hashes en build, y no soporta scripts añadidos en runtime. Stripe y Mux quedarían bloqueados.

**Coste**: el uso de nonces fuerza renderizado dinámico. No nos afecta porque todas las páginas relevantes ya son dinámicas (sesión, datos de DB).

## Mux: signed playback con keys opcionales

**Decidimos** que los uploads nuevos vayan con política `signed` cuando hay claves de firma en el entorno, y que los antiguos `public` sigan funcionando.

**Por qué no migrar todo a `signed`**:
- Migrar assets existentes en Mux a otra política implica reprocessing.
- Los pocos vídeos `public` actuales son de pruebas o aún no críticos.
- Cuando se publique una nueva tanda de vídeos, ya irán firmados.

**Tokens de 6 h**: corto pero suficiente para una sesión típica. Si se filtra, expira en horas. Mux acepta strings tipo `1h`, `6h`, `1d`, `7d`.

## Reseñas: moderadas, no auto-aprobadas

**Decidimos** que las reseñas pasen por moderación antes de aparecer en la landing pública (`PENDING` → admin aprueba → `APPROVED`).

**Por qué moderar**:
- Spam puntual (el endpoint público no requiere captcha).
- Reseñas fuera de tema (preguntas de soporte).
- PII accidental (alumnos mencionando email/teléfono).

**Por qué no auto-aprobar a alumnos verificados**:
- Aunque el `Enrollment` reduce el riesgo, el coste de moderar 1-5 reseñas/semana es trivial (un click).
- Permite filtrar texto problemático que no es necesariamente spam.

**Re-envío**: editar una reseña ya aprobada la vuelve a `PENDING`. El alumno puede mejorar la redacción, pero el admin re-aprueba el texto nuevo.

## Course badges: manuales, no automáticos por ventas

**Decidimos** que `BESTSELLER` / `NEW` / `COMING_SOON` los asigne el admin a mano.

**Por qué manual**:
- Catálogo pequeño (\<10 cursos): un "más vendido" automático puede quedar vacío o destacar el curso equivocado las primeras semanas.
- Da control narrativo: el admin decide qué empujar comercialmente.
- Reversible: cuando crezca el catálogo se puede añadir un `salesCount` derivado y proponer candidatos.

## Progreso del alumno: 95% como umbral de completado

**Decidimos** que un vídeo se marca completo al alcanzar el **95 % de duración**, no el 100 %.

**Por qué 95 %**:
- Créditos finales y pausas hacen que muchos vídeos no se reproduzcan al 100 % aunque se hayan consumido.
- Es el estándar de la industria (YouTube, Coursera, etc.).

**No se desmarca al re-ver**: una vez `completedAt` está set, re-ver desde el inicio no lo borra. El alumno puede repasar tranquilamente sin "perder" su progreso.

## Tipos de tests (a futuro)

Plan: **Vitest** para unit + integration. **Playwright** si necesitamos E2E.

Aún no instalado. Empezaremos a escribir tests cuando tengamos lógica suficientemente compleja (probablemente en Fase 3 con los webhooks de Stripe).
