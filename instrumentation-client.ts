// Sentry init for the BROWSER.
//
// In Next.js 15+/Sentry SDK v10 the client config MUST live here, in
// `instrumentation-client.ts` — the old `sentry.client.config.ts` convention is
// no longer picked up. It only gets bundled into the client when
// `next.config.ts` is wrapped with `withSentryConfig` (see there).
//
// No-op when NEXT_PUBLIC_SENTRY_DSN is unset (dev, preview without Sentry). The
// var must be NEXT_PUBLIC_* to be readable in the browser bundle, and is inlined
// at build time — changing it requires a fresh build, not a cached redeploy.

import * as Sentry from "@sentry/nextjs";

// Ruido de TERCEROS, no bugs nuestros. Errores lanzados por scripts que NO son
// de nuestra web: navegadores in-app (Instagram, WhatsApp, Bing…), extensiones
// del navegador y avisos benignos del propio navegador. Filtrarlos evita
// ensuciar Sentry y gastar cuota/replays. Lista conservadora: NO incluimos
// "Failed to fetch"/errores de red ni "Script error." genéricos, que pueden
// esconder problemas reales. Ampliar si aparecen nuevas variantes.
const THIRD_PARTY_NOISE = [
  // WebView de iOS: in-app browsers de Instagram/WhatsApp inyectan esto.
  "webkit.messageHandlers",
  // In-app browser de la app de Bing (Android).
  "instantSearchSDKJSBridgeClearHighlight",
  // Aviso benigno de layout, no rompe nada; muy común.
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Firmas clásicas de extensiones del navegador.
  "top.GLOBALS",
  "originalCreateNotification",
  "canvas.contentDocument",
  "MyApp_RemoveAllHighlights",
  "atomicFindClose",
  "conduitPage",
];

// Scripts servidos desde extensiones del navegador: nada nuestro vive ahí.
const EXTENSION_URLS = [
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-extension:\/\//i,
  /^safari-web-extension:\/\//i,
];

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    ignoreErrors: THIRD_PARTY_NOISE,
    denyUrls: EXTENSION_URLS,
    // Replay only on errors (cheap) — full session replay is opt-in later.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  });
}

// Instrument App Router client-side navigations (Sentry v8+/Next 15+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
