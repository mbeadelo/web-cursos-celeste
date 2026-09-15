import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { reconcilePendingVideos } from "@/lib/mux-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/mux-reconcile
 *
 * Red de seguridad programada (ver `crons` en vercel.json): reconcilia contra
 * la API de Mux todas las lecciones VIDEO que tienen upload pero no
 * playbackId. Si un webhook de Mux se perdió, aquí se recupera sin que nadie
 * tenga que darse cuenta.
 *
 * Auth: Vercel Cron manda `Authorization: Bearer <CRON_SECRET>` cuando la
 * variable existe en el proyecto. Sin CRON_SECRET el endpoint no hace nada
 * (503) para que no se pueda disparar desde fuera.
 */
export async function GET(req: Request) {
  if (!env.CRON_SECRET) {
    return new Response("CRON_SECRET no configurado", { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const summary = await reconcilePendingVideos({ force: true });
  console.log(
    `[mux cron] checked=${summary.checked} ready=${summary.ready} processing=${summary.processing} errored=${summary.errored} failed=${summary.failed}`
  );
  return NextResponse.json(summary);
}
