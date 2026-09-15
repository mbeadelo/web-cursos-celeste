import "server-only";
import { db } from "@/lib/db";
import { isMuxConfigured, requireMux } from "@/lib/mux";

/**
 * Reconciliación de vídeos contra la API de Mux.
 *
 * El webhook (`/api/webhooks/mux`) es el camino rápido: cuando Mux termina de
 * procesar un vídeo nos avisa y guardamos el `muxPlaybackId`. Pero si el
 * evento se pierde (URL mal configurada, timeout, Mux caído...) la lección se
 * quedaba en "Vídeo en preparación" para siempre, aunque el asset estuviera
 * listo. Esto ya pasó dos veces en producción (jul-2026, sep-2026).
 *
 * Este módulo hace que la app NO dependa del webhook: cualquier lección con
 * upload pero sin playbackId se puede reconciliar preguntando a Mux, que es
 * la fuente de la verdad. Se llama desde:
 *
 *   - la página de lección del alumno (self-healing en el momento en que un
 *     alumno abre un vídeo pendiente),
 *   - la página de edición del curso en admin (al cargar, todas las pendientes
 *     del curso),
 *   - el diálogo de subida (polling hasta que Mux termina),
 *   - el cron `/api/cron/mux-reconcile` (barrido diario de red de seguridad).
 *
 * Las escrituras son idempotentes y coinciden con lo que haría el webhook, así
 * que da igual que lleguen las dos cosas.
 */

export type ReconcileOutcome =
  /** Asset listo: la DB ya tiene el playbackId (recién escrito o ya estaba). */
  | { status: "ready"; playbackId: string }
  /** Mux sigue procesando (o el fichero aún no ha terminado de subirse). */
  | { status: "processing" }
  /** Mux marcó el asset como errored: se limpian los ids para poder resubir. */
  | { status: "errored"; detail: string }
  /** La lección no tiene ningún id de Mux: no hay nada que reconciliar. */
  | { status: "none" }
  /** No se consultó Mux (no configurado, o consulta reciente aún en throttle). */
  | { status: "skipped"; reason: string };

export type ReconcilableLesson = {
  id: string;
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
};

/**
 * Throttle por lección (en memoria, por instancia). Evita que 50 alumnos
 * refrescando una lección pendiente disparen 50 llamadas a Mux por segundo.
 * Es best-effort: cada instancia serverless tiene su propio mapa.
 */
const lastChecked = new Map<string, number>();
const THROTTLE_MS = 15_000;

function throttled(lessonId: string): boolean {
  const now = Date.now();
  const last = lastChecked.get(lessonId) ?? 0;
  if (now - last < THROTTLE_MS) return true;
  lastChecked.set(lessonId, now);
  // Que el mapa no crezca sin límite en instancias longevas.
  if (lastChecked.size > 500) {
    for (const [k, t] of lastChecked) {
      if (now - t > THROTTLE_MS) lastChecked.delete(k);
    }
  }
  return false;
}

/**
 * Reconcilia UNA lección. Si ya tiene playbackId devuelve `ready` sin tocar
 * Mux. Si no, resuelve upload → asset → playback en la API de Mux y persiste
 * el resultado.
 *
 * Preferimos resolver desde `muxUploadId` y no desde `muxAssetId`: al
 * reemplazar un vídeo el uploadId es siempre el nuevo, mientras que un
 * assetId viejo podría quedar colgando y devolver el vídeo anterior.
 */
export async function reconcileLessonVideo(
  lesson: ReconcilableLesson,
  opts: { force?: boolean } = {}
): Promise<ReconcileOutcome> {
  if (lesson.muxPlaybackId) {
    return { status: "ready", playbackId: lesson.muxPlaybackId };
  }
  if (!lesson.muxUploadId && !lesson.muxAssetId) {
    return { status: "none" };
  }
  if (!isMuxConfigured()) {
    return { status: "skipped", reason: "mux-not-configured" };
  }
  if (!opts.force && throttled(lesson.id)) {
    return { status: "skipped", reason: "throttled" };
  }

  const mux = requireMux();

  let assetId = lesson.muxAssetId;
  if (lesson.muxUploadId) {
    const upload = await mux.video.uploads.retrieve(lesson.muxUploadId);
    if (!upload.asset_id) {
      // waiting = el navegador aún no ha terminado el PUT; asset_created llega
      // después. Cualquier otro estado sin asset (cancelled, timed_out,
      // errored) significa que el fichero nunca llegó a Mux.
      if (upload.status === "waiting" || upload.status === "asset_created") {
        return { status: "processing" };
      }
      return {
        status: "errored",
        detail: `upload sin asset (status=${upload.status ?? "desconocido"})`,
      };
    }
    assetId = upload.asset_id;
  }
  if (!assetId) return { status: "none" };

  const asset = await mux.video.assets.retrieve(assetId);

  if (asset.status === "errored") {
    const detail = JSON.stringify(asset.errors ?? {});
    console.error(
      `[mux reconcile] asset errored lesson=${lesson.id} asset=${assetId} ${detail}`
    );
    // Mismo tratamiento que el webhook video.asset.errored: limpiar ids para
    // que el admin vea "sin vídeo" y pueda resubir.
    await db.lesson.update({
      where: { id: lesson.id },
      data: { muxAssetId: null, muxUploadId: null },
    });
    return { status: "errored", detail };
  }

  const playbackId = asset.playback_ids?.[0]?.id ?? null;
  if (asset.status !== "ready" || !playbackId) {
    // Guardamos el assetId aunque no esté listo: ahorra la llamada al upload
    // en la siguiente comprobación y deja rastro para depurar.
    if (assetId !== lesson.muxAssetId) {
      await db.lesson
        .update({ where: { id: lesson.id }, data: { muxAssetId: assetId } })
        .catch(() => undefined);
    }
    return { status: "processing" };
  }

  await db.lesson.update({
    where: { id: lesson.id },
    data: { muxAssetId: assetId, muxPlaybackId: playbackId },
  });
  console.log(
    `[mux reconcile] lesson=${lesson.id} asset=${assetId} playback=${playbackId} → ready`
  );
  return { status: "ready", playbackId };
}

/** Reconcilia una lección por id (carga la fila y delega). */
export async function reconcileLessonVideoById(
  lessonId: string,
  opts: { force?: boolean } = {}
): Promise<ReconcileOutcome> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      muxUploadId: true,
      muxAssetId: true,
      muxPlaybackId: true,
    },
  });
  if (!lesson) return { status: "none" };
  return reconcileLessonVideo(lesson, opts);
}

export type ReconcileSummary = {
  checked: number;
  ready: number;
  processing: number;
  errored: number;
  skipped: number;
  failed: number;
  details: { lessonId: string; title: string; outcome: string }[];
};

/**
 * Barrido: todas las lecciones VIDEO con upload/asset pero sin playbackId
 * (opcionalmente acotado a un curso). Cada lección se reconcilia de forma
 * independiente: un error de Mux en una no aborta las demás.
 */
export async function reconcilePendingVideos(
  opts: { courseId?: string; limit?: number; force?: boolean } = {}
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    ready: 0,
    processing: 0,
    errored: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };
  if (!isMuxConfigured()) return summary;

  const pending = await db.lesson.findMany({
    where: {
      type: "VIDEO",
      muxPlaybackId: null,
      OR: [{ muxUploadId: { not: null } }, { muxAssetId: { not: null } }],
      ...(opts.courseId ? { courseId: opts.courseId } : {}),
    },
    select: {
      id: true,
      title: true,
      muxUploadId: true,
      muxAssetId: true,
      muxPlaybackId: true,
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 100,
  });

  for (const lesson of pending) {
    summary.checked++;
    try {
      const r = await reconcileLessonVideo(lesson, { force: opts.force });
      if (r.status === "ready") summary.ready++;
      else if (r.status === "processing") summary.processing++;
      else if (r.status === "errored") summary.errored++;
      else summary.skipped++;
      summary.details.push({
        lessonId: lesson.id,
        title: lesson.title,
        outcome: r.status === "errored" ? `errored: ${r.detail}` : r.status,
      });
    } catch (err) {
      summary.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[mux reconcile] lesson=${lesson.id} falló: ${msg}`);
      summary.details.push({
        lessonId: lesson.id,
        title: lesson.title,
        outcome: `failed: ${msg}`,
      });
    }
  }
  return summary;
}
