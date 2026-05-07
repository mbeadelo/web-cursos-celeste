# Arquitectura

Visión a vista de pájaro de cómo encajan las piezas.

## Diagrama de bloques

```
┌────────────────────────────────────────────────────────────────────┐
│                  Next.js (App Router) en Vercel                    │
│                                                                    │
│  ┌──────────┐   ┌────────────┐   ┌──────────────────────┐          │
│  │  Public  │   │  Alumnos   │   │  /admin (panel)      │          │
│  │  home,   │   │  /dashboard│   │  - cursos CRUD       │          │
│  │  catálogo│   │  player,   │   │  - alumnos / ventas  │          │
│  │  checkout│   │  descargas │   │  - upload de assets  │          │
│  └──────────┘   └────────────┘   └──────────────────────┘          │
└──────────┬─────────────────┬───────────────────────────────────────┘
           │                 │
   ┌───────▼─────────┐  ┌────▼─────────────┐  ┌──────────────┐
   │  PostgreSQL     │  │  Stripe          │  │  Mux Video   │
   │  (Neon)         │  │  Checkout +      │  │  signed      │
   │  via Prisma     │  │  Webhooks        │  │  playback    │
   └─────────────────┘  └──────────────────┘  └──────────────┘
                                               ┌──────────────┐
                                               │ Cloudflare R2│
                                               │ PDFs / cover │
                                               └──────────────┘
                        ┌──────────────────┐
                        │  Resend (emails) │
                        │  magic link +    │
                        │  recibos         │
                        └──────────────────┘
```

## Capas

### 1. Frontend + Backend (Next.js)

Una sola app Next.js sirve **todo**:

- **Páginas públicas** (catálogo, checkout, login).
- **Dashboard del alumno** (sus cursos, reproducción).
- **Panel de admin** (`/admin`).
- **API routes** para webhooks y endpoints concretos (`/api/webhooks/stripe`, `/api/checkout`).

No hay backend separado. Lo que en otros stacks sería "frontend + API REST", aquí son **Server Components** + **Server Actions** + **Route Handlers**, todo en el mismo proyecto.

### 2. Base de datos (PostgreSQL via Neon, accedida con Prisma)

- Una sola DB Postgres en [Neon](/herramientas/neon).
- [Prisma](/herramientas/prisma) genera un cliente type-safe a partir de `prisma/schema.prisma`.
- Branches de DB en Neon para entornos preview de Vercel (cada PR tiene su propia DB).

**Modelo de datos principal** (resumido — el schema completo está en [Fase 0](/fases/fase-0-setup)):

| Tabla | Para qué |
|---|---|
| `User` | Usuarios (alumnos y admins) |
| `Course` | Cursos publicables, con precio, `badge` (BESTSELLER/NEW/COMING_SOON), `featuredOrder` y copy de landing (`targetAudience`, `whatYouLearn`) |
| `Lesson` | Lecciones dentro de un curso (vídeo, PDF o texto) |
| `Enrollment` | Quién tiene acceso a qué curso |
| `LessonProgress` | Progreso por (alumno, lección): `lastSeconds` para "continuar donde lo dejaste" + `completedAt` cuando supera el 95 % o el alumno marca a mano |
| `Review` | Reseñas con estados PENDING/APPROVED/REJECTED. Solo APROVED se muestran en público |
| `Order` | Compras hechas con Stripe |
| `StripeEvent` | Idempotencia de webhooks (para no duplicar matrículas) |
| `Article` | Posts de blog (TipTap, sanitizados) |
| `SiteContent` | Copy editable del sitio (claves dot-notation) |
| `LegalDocument` | Privacidad, términos, cookies |
| `Account`, `Session`, `VerificationToken` | Tablas de Auth.js |

### 3. Pagos (Stripe)

Dos flujos:

- **Compra**: el alumno pulsa "Comprar" → backend crea una Stripe **Checkout Session** → el alumno paga en una página alojada por Stripe → Stripe redirige a `/checkout/success`.
- **Webhook**: Stripe llama a `/api/webhooks/stripe` con el evento `checkout.session.completed`. Verificamos firma, guardamos el `eventId` (idempotencia), creamos `Order` y `Enrollment`.

El alumno **nunca** ve formularios de tarjeta en nuestro código. Eso es de Stripe. Reduce a casi cero las obligaciones de cumplimiento PCI.

### 4. Vídeo (Mux)

- El admin sube un vídeo desde el panel directamente a Mux (URL de subida firmada por nuestro backend).
- Mux notifica por webhook cuando el `asset` está listo (transcoding hecho).
- Cuando el alumno reproduce, generamos **JWT firmados de Mux** (`playback`, `thumbnail`, `storyboard`) server-side, **solo si tiene `Enrollment`**. Los tokens caducan a las 6 h.
- Los nuevos uploads se crean con `playback_policies: ["signed"]` cuando hay `MUX_SIGNING_KEY_ID` + `MUX_SIGNING_PRIVATE_KEY` en el entorno; en otro caso siguen siendo `public` (dev). Vídeos antiguos `public` siguen funcionando.
- El reproductor (`@mux/mux-player-react`) recibe los tokens via prop `tokens={...}`.
- Watermark client-side adicional con email + IP del alumno (disuasión, no protección — ver Fase 8).

Resultado: sin matrícula no hay token; los tokens caducan; los vídeos no son enlazables.

### 5. Archivos estáticos (Cloudflare R2)

- PDFs y portadas de curso.
- Subida desde el admin con URL firmada (igual que Mux).
- Descarga del alumno también con URL firmada **solo si tiene matrícula**.
- R2 sin egress fees → coste predecible aunque haya muchas descargas.

### 6. Email (Resend)

- **Magic link de login**: Auth.js le pide a Resend que envíe el correo con el enlace.
- **Recibos** (Fase 5): tras una compra, email con la factura adjunta.
- Dominio remitente verificado: `bienvenidoatuplaza.com`.

### 7. Auth (Auth.js v5)

- Único método inicial: **magic link** por email. Sin contraseñas.
- Sesiones por **JWT** (cookie HttpOnly firmada con `AUTH_SECRET`). La tabla `Session` queda sin uso, pero el adapter Prisma sigue persistiendo `User`, `Account` y `VerificationToken`.
- Roles: `STUDENT` (default) y `ADMIN`. El rol se lee de `User.role` en el primer sign-in y se persiste en el JWT.
- Defense in depth: edge proxy (sin DB) + revalidación con `auth()` en cada layout protegido (`/admin/layout.tsx`).
- **Rate limit** sobre magic-link y checkout via Upstash Redis (ver [Fase 8](/fases/fase-8-polish-seguridad-retencion)).

### 8. Edge proxy (`src/proxy.ts`)

> En Next 16, el antiguo `middleware` se llama **proxy**. El archivo debe vivir en `src/proxy.ts` cuando hay carpeta `src/`.

Dos responsabilidades:

1. **Auth gating** delegado en `authConfig.callbacks.authorized` — redirige a `/login` lo que vaya a `/admin` o `/dashboard` sin sesión válida.
2. **Content-Security-Policy con nonce por petición** — Next.js detecta el header `Content-Security-Policy` en el request y aplica el nonce automáticamente a sus scripts inyectados.

Cabeceras estáticas (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP) en `next.config.ts`.

## Flujo de una compra completa (end-to-end)

1. Visitante entra en `/cursos/marketing-digital`.
2. Pulsa "Comprar". Si no está logueado → redirección a `/login`.
3. Recibe magic link por email (Resend), entra al hacer clic.
4. De vuelta a `/cursos/marketing-digital`, pulsa "Comprar" de nuevo.
5. Backend crea Checkout Session con `client_reference_id = userId, courseId`.
6. Stripe muestra su página de pago.
7. Pago OK → Stripe redirige a `/checkout/success` y dispara webhook.
8. Webhook verifica firma → registra `StripeEvent` → crea `Order` + `Enrollment`.
9. El alumno entra a `/dashboard`, ve el curso, reproduce vídeo (URL firmada de Mux), descarga PDF (URL firmada de R2).

## Despliegue

- **Vercel** despliega automáticamente desde la rama `main`.
- Cada Pull Request crea un **preview deploy** con su propia rama de DB en Neon.
- Las migraciones de Prisma se aplican en el build (`prisma migrate deploy`) — en Fase 1 cuando tengamos DB real.
