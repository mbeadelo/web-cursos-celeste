# Fase 5 — Stripe (checkout + webhooks)

> **Objetivo**: cerrar el flujo de compra. Visitante anónimo paga → webhook crea User + Order + Enrollment → email "tu acceso está listo" → alumno entra con magic link.

> **Estado**: 🟡 Código listo y degradado correctamente sin claves. Pendiente que el usuario active la cuenta Stripe y meta las claves para activarlo. La integración funcionará automáticamente al rellenar `STRIPE_*` en `.env` y Vercel.

## Arquitectura

```
Visitante anónimo en /cursos/[slug]
        │
        ▼ click "Comprar curso" (form POST)
POST /api/checkout                  ┐
   ├─ valida curso publicado        │
   ├─ si logueado y enrolado:       │  → 303 a /dashboard/cursos/[slug]
   │  redirect al curso             │
   └─ stripe.checkout.sessions.create
        │ metadata: { courseId }    │
        │ automatic_tax: true       │
        │ allow_promotion_codes     │
        │ locale: "es"              │
        ▼ 303 redirect              ┘
Stripe Checkout (página hosteada)
        │
        ├─ alumno paga con tarjeta
        │
        ├─ Stripe → POST /api/webhooks/stripe (event: checkout.session.completed)
        │   ├─ verifica firma con STRIPE_WEBHOOK_SECRET
        │   ├─ INSERT StripeEvent {id} ON CONFLICT → 200 (idempotencia)
        │   ├─ upsert User by email (bypass del adapter Auth.js — vía sancionada)
        │   ├─ upsert Order by stripeSessionId (status: PAID)
        │   ├─ upsert Enrollment (source: PURCHASE; preserva MANUAL si ya existía)
        │   └─ Resend email "tu acceso está listo" (best-effort)
        │
        └─ Browser → 303 a /checkout/success
             └─ página informativa: "revisa tu email + entra en /login"
```

## Modelo "compra primero, cuenta después"

- Decisión clave: **el alumno NO se registra antes de comprar.** Stripe Checkout pide el email del comprador. Tras el pago, el webhook crea (o reutiliza) el `User` con ese email.
- Excepción: si el alumno ya está logueado (porque ya compró otro curso o porque el admin lo enroló manualmente), se le pre-rellena el email en Checkout.
- Ya enrolado en ese curso (sea por compra previa o admin): el endpoint `/api/checkout` redirige directamente a `/dashboard/cursos/[slug]` sin pasar por Stripe. Evita doble cobro.

## Idempotencia (obligatoria)

Stripe reentrega webhooks ante cualquier respuesta no-2xx, incluyendo timeouts transitorios. Sin idempotencia se duplican `Order` + `Enrollment` + emails.

Patrón implementado en `src/app/api/webhooks/stripe/route.ts`:

```ts
try {
  await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
} catch (err) {
  if (isUniqueConstraint(err)) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  throw err;
}
```

Tabla `StripeEvent { id, type, processedAt }`. PK = `event.id`. Si Stripe reenvía → `db.stripeEvent.create` falla con P2002 → respondemos 200 sin reprocesar.

Defense in depth adicional: `db.order.upsert` por `stripeSessionId` y `db.enrollment.upsert` por composite `[userId, courseId]` también son idempotentes. Aunque el StripeEvent fallara, no se dupica nada.

## Errores y reintentos

Si la lógica **después** del insert de `StripeEvent` lanza, el siguiente webhook de Stripe encuentra la fila y se sale (silent skip). Eso significa que **no debemos lanzar excepciones** desde los handlers — toda fallo se loggea y se devuelve 200. Si una fila de Order o Enrollment quedara sin crear, hay que recuperarla manualmente desde Stripe Dashboard ("Replay").

Excepción: el email de bienvenida es `try/catch` y nunca tira el handler. El alumno puede entrar igualmente vía `/login` aunque no le llegue el email.

## Rutas y archivos

```
src/lib/stripe.ts                        Cliente Stripe + isStripeConfigured()
src/lib/email.ts                         Resend helper para emails transaccionales
src/app/api/checkout/route.ts            POST → crea Checkout Session
src/app/api/webhooks/stripe/route.ts     POST ← Stripe events
src/app/checkout/success/page.tsx        Confirmación post-pago
src/app/cursos/[slug]/page.tsx           Form "Comprar" activo si Stripe configurado
```

## Stripe Tax

`automatic_tax: { enabled: true }` en la sesión. Stripe calcula el IVA a partir de la dirección del comprador. Para que esto funcione hay que activar Stripe Tax en el dashboard y registrar las jurisdicciones donde vendes (España como mínimo). En modo test se puede activar sin coste.

Si vendes a UE (>€10k/año fuera de España) tendrás que registrarte en OSS — Stripe Tax lo gestiona automáticamente una vez registrado.

Coste: 0.5% del volumen pasado por Tax. Para <€10k/año de facturación es despreciable.

## Reembolsos y revocación de acceso

Webhook `charge.refunded` → busca `Order` por `stripePaymentIntentId` → marca status REFUNDED + borra `Enrollment` correspondiente. El `User` no se borra (puede volver a comprar).

Si el admin revoca acceso manualmente desde `/admin/enrollments`, **NO** se devuelve dinero — solo se borra el Enrollment. Reembolsar es responsabilidad del admin desde el dashboard de Stripe (que disparará el webhook automáticamente).

## Lo que tienes que hacer para activarlo

### 1. Crear cuenta Stripe

- Sign-up en [stripe.com](https://stripe.com) (puedes usar Google login).
- **Modo test** activado por defecto. No requiere KYC para empezar.
- KYC + activar modo live se hace cuando estés listo para cobrar de verdad. Stripe pide datos fiscales españoles, IBAN, etc.

### 2. Obtener claves de API (modo test)

- Dashboard → **Developers → API keys**.
- Copia:
  - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (empieza por `pk_test_...`). Por ahora no lo usamos en cliente, pero déjalo guardado.
  - `Secret key` → `STRIPE_SECRET_KEY` (empieza por `sk_test_...`). **Sensitive** — guarda en Bitwarden y mete con flag Sensitive en Vercel.

### 3. Configurar Stripe CLI para webhooks locales

```powershell
# Instalar (Windows con scoop)
scoop install stripe

# O descargar de github.com/stripe/stripe-cli/releases
```

Después en una terminal **separada** del dev server:

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

El comando imprime un `whsec_...` la primera vez. **Cópialo a `.env` como `STRIPE_WEBHOOK_SECRET`**. Este secreto es solo para tu máquina local.

### 4. Webhook en producción (Vercel)

- Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
- URL: `https://web-cursos-celeste.vercel.app/api/webhooks/stripe` (o `https://bienvenidoatuplaza.com/...` cuando apuntes el dominio).
- Eventos a escuchar (o "Listen to all events"):
  - `checkout.session.completed`
  - `charge.refunded`
- Tras crear, dale a "Reveal signing secret" → copia el `whsec_...`.
- Vercel Dashboard → **Settings → Environment Variables** → añade `STRIPE_WEBHOOK_SECRET` (Production + Preview, Sensitive). Este es **diferente** del whsec local.

### 5. Activar Stripe Tax

- Dashboard → **Tax** (sidebar izquierdo).
- "Get started" → registrar España como jurisdicción.
- Cobra 0.5% del volumen sometido a Tax. En modo test no cuesta nada.

### 6. Variables de entorno

`.env` local **y** Vercel (Production + Preview, sin comillas):

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...    # local: del CLI; prod: del dashboard
```

`isStripeConfigured()` chequea `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Hasta que ambas estén, el botón "Comprar" sigue como "Comprar (próximamente)".

### 7. Probar el flujo en local

```powershell
# Terminal 1: dev server
pnpm dev

# Terminal 2: stripe webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Luego:

1. Ir a `/cursos/[slug]` de un curso publicado en local.
2. Click "Comprar curso" → te lleva a Stripe Checkout.
3. Pagar con tarjeta de prueba `4242 4242 4242 4242`, expiración cualquiera futura, CVC cualquiera, código postal cualquiera.
4. Stripe redirect a `/checkout/success`.
5. La terminal de `stripe listen` debe imprimir `checkout.session.completed → 200 OK`.
6. Verifica en DB:
   - `User` con el email que metiste.
   - `Order` con status PAID y stripeSessionId.
   - `Enrollment` con source PURCHASE.
7. Mira tu inbox: te llega el email "Tu acceso a [curso] está listo".
8. Entra en `/login` con ese email → magic link → `/dashboard` → ves el curso.

### 8. Probar reembolso

- Stripe Dashboard → Payments → encuentra el último → "Refund payment".
- En `stripe listen` debe llegar `charge.refunded → 200 OK`.
- En DB: `Order.status = REFUNDED`, `Enrollment` borrado para ese curso.
- En `/dashboard` el alumno ya no ve el curso.

## Decisiones técnicas

### `mode: "payment"` (one-shot) vs `subscription`

Por ahora todos los cursos son compra única. Si en el futuro se añaden suscripciones (acceso a varios cursos por mes), el flujo cambia: hay que crear `Product` + `Price` recurrente en Stripe, y el modelo de datos pasa a `Subscription` en vez de `Order`. Out of scope hoy.

### `price_data` inline vs catálogo de Stripe

Pasamos el precio inline en cada sesión (`unit_amount` en céntimos). Más simple — no hay que sincronizar productos a Stripe cuando admin crea un curso. Trade-off: dificulta usar el catálogo de Stripe para reporting o para crear precios con variantes. Para <100 cursos no compensa la complejidad de sincronizar.

### `customer_email` opcional

Si el visitante está logueado pre-rellenamos el email para que no lo tenga que escribir. Si no, Stripe lo pide en su formulario y nosotros lo recibimos en `customer_details.email` en el webhook.

### Email post-pago: best-effort

`sendPurchaseWelcomeEmail` está en try/catch. Si Resend falla (rate limit, dominio mal configurado, etc.) el webhook responde 200 igualmente. El alumno puede entrar via `/login` con su email — el `User` ya existe. Esto evita reintentos infinitos del webhook por un fallo de email transitorio.

### Locale en español

`locale: "es"` en la sesión de Checkout — Stripe muestra todo el flujo en español.

## Riesgos a vigilar

1. **Stripe Tax mal configurado** → cobras sin IVA y luego Hacienda te factura. Probar en test antes de pasar a live.
2. **Webhook secret distinto entre local y prod** → si copias el whsec local a Vercel, los eventos de Stripe Dashboard no verifican firma → 400. Son secretos diferentes.
3. **Mode test vs live**: las claves test (`sk_test_...`) generan eventos test. Cambiar a live (`sk_live_...`) requiere webhook nuevo en el dashboard porque el secret cambia.
4. **Email verificado en Resend**: hasta que el dominio `bienvenidoatuplaza.com` esté verificado, los emails se envían desde `onboarding@resend.dev`. Documentado en fase-1.
5. **`charge.refunded` reentregado**: si Stripe reentrega un refund event, el `try/catch` alrededor del `enrollment.delete` evita el error. Sigue siendo idempotente.

## Pendientes

- **Captura de email en checkout cuando el comprador pega un email distinto al de su cuenta**: si el alumno está logueado pero compra con otro email, hoy creamos un User nuevo con ese segundo email — quizás queramos forzarlo a usar el email de la sesión.
- **Página `/checkout/cancel`** redundante con `/cursos/[slug]` (ya redirige ahí). No la creamos.
- **Webhook de `payment_intent.payment_failed`**: hoy no hace nada. Podría útil para retargeting o métricas.
- **Receipt en Stripe**: opcionalmente activar `invoice_creation` para emitir factura formal con IVA (requerido por Hacienda en España para B2B).
- **Stripe customer portal**: permitir al alumno gestionar suscripciones / facturas. Útil cuando se añadan suscripciones.

## Commits

```
(pendiente)
```
