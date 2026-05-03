# Sentry

## ¿Qué es?

Sentry es un **monitor de errores en tiempo real**. Cuando tu app lanza una excepción no controlada (en cliente o servidor), Sentry la captura, te envía una notificación y te muestra:

- **Stack trace** completo con código fuente.
- **Contexto**: qué usuario, qué request, qué browser, qué versión del código.
- **Frecuencia**: cuántas veces ha pasado, a cuántos usuarios afecta.
- **Replay**: hasta una grabación de los últimos segundos del usuario antes del crash (con `sessionReplay`).

Sin Sentry, descubres los bugs de producción cuando un usuario te escribe quejándose. Con Sentry, los descubres antes y con info para arreglarlos.

## ¿Para qué lo usamos?

Cubrir tres flancos críticos:

1. **Webhooks de Stripe**: si fallan en procesar un evento, no podemos perder esa traza.
2. **Errores en server actions**: cualquier mutation que falle.
3. **Errores en cliente**: errores de UI que el usuario no nos cuenta.

Lo añadiremos en **Fase 5** (pulido y lanzamiento), antes de pasar a producción.

## Plan y coste

- **Free tier**: 5k errores/mes, 1 user, 30 días de retención. Más que suficiente para MVP.
- **Team ($26/mes)**: cuando necesitemos más volumen, replay, performance monitoring.

## Cómo se integra con Next.js

```powershell
pnpm dlx @sentry/wizard@latest -i nextjs
```

El wizard configura todo: middleware, source maps, instrumentación. Pides nombre de proyecto y listo.

## Privacidad

Sentry capta datos de sesiones reales. Hay que:

- Excluir campos sensibles (passwords, tokens) de los breadcrumbs.
- Añadirlo a la política de privacidad como subprocesador.
- Firmar / aceptar el DPA (Data Processing Agreement).

## Alternativas que valoramos

- **Datadog APM**: más completo, mucho más caro. Overkill para MVP.
- **Highlight.io**: open source, replay nativo. Joven.
- **LogRocket**: foco en replay del cliente. Más caro.
- **Console.log + Vercel logs**: lo que tienes por defecto. Útil, pero no es comparable con Sentry para detectar y diagnosticar.

## Enlaces

- [Sitio oficial](https://sentry.io)
- [Integración con Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
