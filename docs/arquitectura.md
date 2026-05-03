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
| `Course` | Cursos publicables, con precio |
| `Lesson` | Lecciones dentro de un curso (vídeo, PDF o texto) |
| `Enrollment` | Quién tiene acceso a qué curso |
| `Order` | Compras hechas con Stripe |
| `StripeEvent` | Idempotencia de webhooks (para no duplicar matrículas) |
| `Account`, `Session`, `VerificationToken` | Tablas de Auth.js |

### 3. Pagos (Stripe)

Dos flujos:

- **Compra**: el alumno pulsa "Comprar" → backend crea una Stripe **Checkout Session** → el alumno paga en una página alojada por Stripe → Stripe redirige a `/checkout/success`.
- **Webhook**: Stripe llama a `/api/webhooks/stripe` con el evento `checkout.session.completed`. Verificamos firma, guardamos el `eventId` (idempotencia), creamos `Order` y `Enrollment`.

El alumno **nunca** ve formularios de tarjeta en nuestro código. Eso es de Stripe. Reduce a casi cero las obligaciones de cumplimiento PCI.

### 4. Vídeo (Mux)

- El admin sube un vídeo desde el panel directamente a Mux (URL de subida firmada por nuestro backend).
- Mux notifica por webhook cuando el `asset` está listo (transcoding hecho).
- Cuando el alumno reproduce, generamos una **signed playback URL** server-side (válida unos minutos) **solo si tiene `Enrollment` para ese curso**.
- El reproductor (`@mux/mux-player-react`) carga la URL firmada vía HLS.

Resultado: los enlaces no se pueden compartir (caducan), y sin matrícula no hay URL.

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
- Sesiones guardadas en DB (tabla `Session`).
- Roles: `STUDENT` (default) y `ADMIN`. El rol vive en la DB, no en el token.
- Middleware de Next protege `/admin/*` y `/dashboard/*`.

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
