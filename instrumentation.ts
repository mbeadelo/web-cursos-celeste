// Next.js instrumentation hook. Called once at runtime startup, before any
// page or API route runs. We use it to bootstrap Sentry on the server and
// edge runtimes. Client runtime is handled by instrumentation-client.ts.
//
// If SENTRY_DSN is unset (dev, preview without Sentry), the imports silently
// no-op — see sentry.server.config / sentry.edge.config.

import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors thrown in Server Components, route handlers, the proxy and
// other server code (Next 15+). Van a Sentry (si está configurado) Y al
// sistema propio de incidencias (/admin/salud + email al admin), que es el
// que no depende de nadie. El import es dinámico y solo en Node: el bundle
// edge (proxy) no puede cargar Prisma. Next sustituye NEXT_RUNTIME en build,
// así que la rama de edge se elimina.
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  Sentry.captureRequestError(err, request, context);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { reportOps } = await import("./src/lib/ops");
      await reportOps({
        level: "ERROR",
        area: "server",
        message: `Error no controlado en ${request.method} ${context.routePath}`,
        error: err,
        detail: {
          path: request.path,
          routerKind: context.routerKind,
          routeType: context.routeType,
          renderSource: context.renderSource,
        },
      });
    } catch (e) {
      console.error("[instrumentation] no se pudo registrar el error:", e);
    }
  }
};
