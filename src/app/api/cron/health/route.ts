import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { runHealthChecks } from "@/lib/health";
import { reportOps } from "@/lib/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/health
 *
 * Barrido programado (ver `crons` en vercel.json) del sistema propio de
 * monitorización: ejecuta los chequeos de src/lib/health.ts y convierte cada
 * `fail` en una incidencia ERROR (email al admin, agrupada por chequeo) y
 * cada `warn` en una WARN visible en /admin/salud. Así una clave caducada,
 * un webhook mal apuntado o un dominio de email sin verificar se detectan sin
 * esperar a que un alumno no pueda pagar.
 *
 * También limpia incidencias resueltas e intentos de pago antiguos.
 *
 * Auth: Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin la
 * variable el endpoint responde 503 para que no se pueda disparar desde
 * fuera.
 */
export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return new Response("CRON_SECRET no configurado", { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const report = await runHealthChecks();

  for (const check of report.checks) {
    if (check.status === "fail") {
      await reportOps({
        level: "ERROR",
        area: "health",
        message: `Chequeo fallido: ${check.name}`,
        detail: { summary: check.summary, detail: check.detail, ms: check.ms },
      });
    } else if (check.status === "warn") {
      await reportOps({
        level: "WARN",
        area: "health",
        message: `Aviso: ${check.name}`,
        detail: { summary: check.summary, detail: check.detail, ms: check.ms },
      });
    }
  }

  // Limpieza: incidencias resueltas de más de 90 días e intentos de pago de
  // más de 180 días. Las incidencias abiertas se conservan siempre.
  const now = Date.now();
  const [prunedEvents, prunedAttempts, prunedBuckets] = await Promise.all([
    db.opsEvent.deleteMany({
      where: { resolvedAt: { lt: new Date(now - 90 * 24 * 60 * 60 * 1000) } },
    }),
    db.checkoutAttempt.deleteMany({
      where: { createdAt: { lt: new Date(now - 180 * 24 * 60 * 60 * 1000) } },
    }),
    // Ventanas de rate limiting ya cerradas (src/lib/rate-limit.ts).
    db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
  ]);

  console.log(
    `[health cron] checks=${report.checks.length} fail=${report.failing} warn=${report.warning} prunedEvents=${prunedEvents.count} prunedAttempts=${prunedAttempts.count} prunedBuckets=${prunedBuckets.count}`
  );
  return NextResponse.json({
    ranAt: report.ranAt,
    failing: report.failing,
    warning: report.warning,
    checks: report.checks,
    pruned: { events: prunedEvents.count, attempts: prunedAttempts.count },
  });
}
