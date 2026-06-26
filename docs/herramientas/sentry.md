# Sentry

> **Estado:** ✅ activo en producción desde junio de 2026 (región **DE**).

## ¿Qué es?

Sentry es un **monitor de errores en tiempo real**. Cuando la app lanza una excepción no controlada (cliente o servidor), Sentry la captura, avisa y muestra:

- **Stack trace** completo con código fuente.
- **Contexto**: qué usuario, qué request, qué browser, qué versión del código.
- **Frecuencia**: cuántas veces ha pasado, a cuántos usuarios afecta.
- **Replay**: grabación de los últimos segundos antes del crash (configurado solo *on-error*).

Sin Sentry, los bugs de producción se descubren cuando un usuario se queja. Con Sentry, antes y con info para arreglarlos.

## Para qué lo usamos

1. **Webhooks de Stripe/Mux**: si fallan al procesar un evento, no perder la traza.
2. **Errores en server actions / Server Components**: cualquier mutation que falle.
3. **Errores en cliente**: errores de UI que el usuario no nos cuenta.
4. **Alertas de abuso del chatbot**: avisos explícitos (`captureMessage`) cuando una IP supera el límite horario o se alcanza el tope global diario de `/api/chat`.

## Cableado en Next 16 + Sentry v10 (importante)

::: warning Este NO es el Sentry de tutoriales antiguos
La convención cambió con `@sentry/nextjs` v10 + Next 15/16. El setup "wizard" clásico (`sentry.client.config.ts` suelto) **no carga el SDK de cliente** en esta versión. Hicieron falta **3 piezas**, y faltaban dos:
:::

1. **`next.config.ts` envuelto con `withSentryConfig`.** Esto es lo que **inyecta el SDK de cliente en el build del navegador** y wirea la instrumentación de servidor. **Sin este wrapper, la DSN nunca entra en el bundle, da igual la env var.**

   ```ts
   import { withSentryConfig } from "@sentry/nextjs";

   export default withSentryConfig(nextConfig, {
     org: "bienvenido-a-tu-plaza",
     project: "javascript-nextjs",
     silent: !process.env.CI,
   });
   ```

2. **`instrumentation-client.ts`** (raíz) — init del navegador. El antiguo `sentry.client.config.ts` **ya no se recoge** en v10. Exporta también `onRouterTransitionStart` para instrumentar las navegaciones del App Router. Es no-op si falta `NEXT_PUBLIC_SENTRY_DSN`.

3. **`instrumentation.ts`** — `register()` carga `sentry.server.config` / `sentry.edge.config` según runtime, y exporta:

   ```ts
   export const onRequestError = Sentry.captureRequestError;
   ```

   …para capturar errores de Server Components, route handlers y el proxy.

## Variables de entorno

| Variable | Scope | Para qué |
|---|---|---|
| `SENTRY_DSN` | Production | Errores de servidor y edge |
| `NEXT_PUBLIC_SENTRY_DSN` | Production | Errores del navegador (mismo valor que la anterior) |
| `SENTRY_AUTH_TOKEN` | *(opcional)* | Subir source maps en el build (sin él, solo un warning) |

::: danger Gotcha: `NEXT_PUBLIC_*` se incrusta en BUILD
`NEXT_PUBLIC_SENTRY_DSN` se hornea en el bundle **al compilar**. Cambiarla exige un **build nuevo**, no un "Redeploy" que reutilice la caché. Si redespliegas sin reconstruir, la DSN no entra. (Este fue justo el síntoma al activarlo: la variable estaba puesta pero el cableado no la metía en el build.)
:::

La CSP (`src/proxy.ts`) ya permite los hosts de ingest de Sentry en `connect-src`: `*.ingest.sentry.io`, `*.ingest.us.sentry.io`, `*.ingest.de.sentry.io`.

## Cómo verificar que recibe datos

- **Issues vacío es normal** si no hay errores: ahí solo aparecen excepciones.
- **Prueba rápida (error de verdad)**: en la consola del navegador, en el sitio en producción:
  ```js
  setTimeout(() => { throw new Error("Test Sentry " + Date.now()); }, 0)
  ```
  El `setTimeout` hace que el error sea **no controlado** (llega a `window.onerror`), que es lo que el SDK captura. Aparece en **Issues** en segundos.
- **Confirmar que la DSN está en el build desplegado**: descargar los chunks de `/_next/static` y buscar `@o<id>.ingest…sentry.io`. Si no aparece, el build no la incrustó (ver gotcha de arriba).

## Configuración del SDK

- `tracesSampleRate: 0.1` — 10 % de las navegaciones generan un trace de rendimiento.
- `replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 1.0` — replay **solo** cuando hay un error (barato).

## Plan y coste

- **Developer (free)**: 5k errores/mes, 1 user, 30 días de retención, 50 replays/mes. **Más que suficiente** para esta escala (0 €).
- Al crear el proyecto, Sentry pone un **trial de 14 días** del plan de pago; al acabar **revierte automáticamente al plan free** si no se contrata nada. Para descartar sustos, poner el *on-demand budget* a `$0` y no meter tarjeta.

## Privacidad

- Excluir campos sensibles (passwords, tokens) de los breadcrumbs.
- Añadir Sentry a la política de privacidad como subprocesador y archivar su DPA.

## Enlaces

- [Sitio oficial](https://sentry.io)
- [Integración con Next.js](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
