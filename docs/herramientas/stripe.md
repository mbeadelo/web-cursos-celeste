# Stripe

## ¿Qué es?

Stripe es una **plataforma de pagos online**. Hablas con su API, y ellos se encargan de:

- Cobrar tarjetas (Visa, MasterCard, AmEx, Apple Pay, Google Pay).
- Cumplir normativa PCI (manejo seguro de números de tarjeta).
- 3D Secure / SCA (la verificación con SMS o app del banco que exige Europa).
- Reembolsos, disputas, conciliación contable.
- Facturas e impuestos automáticos (Stripe Tax).

Cobran ~1.4% + €0.25 por transacción europea (varía según país y método).

## ¿Para qué lo usamos?

**Cobro de cursos**. Cada curso es un producto en Stripe con un precio. Cuando un alumno compra:

1. Nuestro backend crea una **Checkout Session** (Stripe te da una URL).
2. Le redirigimos a esa URL — Stripe enseña su propia página de pago.
3. Cuando paga, Stripe redirige al alumno a `/checkout/success`.
4. **Stripe llama a nuestro webhook** `/api/webhooks/stripe` con el evento `checkout.session.completed`.
5. Verificamos firma, registramos `Order` y `Enrollment` (matriculamos al alumno).

## Por qué Checkout y no Elements

**Checkout** = página de pago alojada por Stripe.
**Elements** = componente que muestra el formulario de tarjeta dentro de tu app.

Elegimos **Checkout** porque:

- PCI scope mínimo (no manejamos datos de tarjeta).
- 3D Secure / SCA / wallets (Apple/Google Pay) automáticos.
- Genera factura automática (importante para España).
- Mucho menos código.

## Webhooks: lo crítico

Stripe **reenvía eventos** si tu servidor no responde 200 rápido. Eso significa que el mismo evento puede llegar dos veces.

Para no duplicar matriculaciones, **siempre** insertamos `event.id` en una tabla `StripeEvent` con PK única **antes** de procesar. Si ya estaba → ya procesado, devolvemos 200 y nos vamos.

Esto se llama **idempotencia**. Está documentado en [Arquitectura](/arquitectura) y en `AGENTS.md`. **No lo olvides nunca.**

## Modos test y live

Stripe tiene dos modos completamente separados:

- **Test mode**: tarjetas de prueba (`4242 4242 4242 4242`). Sin dinero real. Las claves empiezan por `sk_test_`.
- **Live mode**: dinero real. Claves `sk_live_`. Para activarlo Stripe te pide KYC (datos fiscales, cuenta bancaria).

En desarrollo trabajamos en test. Pasamos a live justo antes de lanzar.

## Stripe Tax

Vender cursos digitales en Europa exige IVA. Stripe Tax (~0.5% del volumen extra) calcula, cobra y reporta automáticamente. Se activa con un toggle. Lo activaremos desde el día 1.

## CLI

```powershell
# Reenvía webhooks de la cuenta test a tu localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Lanza un evento de prueba
stripe trigger checkout.session.completed
```

## Alternativas que valoramos

- **PayPal**: imprescindible añadir como método secundario más adelante (mucha gente no usa tarjeta).
- **Lemon Squeezy / Paddle**: actúan como "Merchant of Record" — se encargan también del IVA. Cobran más comisión. Útiles si vendes mucho fuera de UE.
- **Redsys / TPV bancario**: el clásico español. Dolor.

## Enlaces

- [Dashboard](https://dashboard.stripe.com)
- [Documentación](https://docs.stripe.com)
- [Checkout](https://docs.stripe.com/payments/checkout)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Stripe CLI](https://docs.stripe.com/stripe-cli)
