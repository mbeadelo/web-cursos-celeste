import "dotenv/config";
import Mux from "@mux/mux-node";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Reconciliación Mux ↔ DB. Para cada lección de vídeo que tiene muxUploadId
 * pero le falta muxPlaybackId (p.ej. porque el webhook no llegó), pregunta a
 * Mux por el asset y rellena muxAssetId/muxPlaybackId. Idempotente y seguro de
 * re-ejecutar. Red de seguridad ante un webhook que falle.
 *
 * Necesita MUX_TOKEN_ID/SECRET y DATABASE_URL (apunta a Prod).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
});
const mux = new Mux({
  tokenId: required("MUX_TOKEN_ID"),
  tokenSecret: required("MUX_TOKEN_SECRET"),
});

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:]+)/)?.[1] ?? "?";
  console.log("DB host:", host);

  const lessons = await db.lesson.findMany({
    where: { type: "VIDEO", muxUploadId: { not: null }, muxPlaybackId: null },
    select: { id: true, title: true, muxUploadId: true, muxAssetId: true },
  });
  console.log(`${lessons.length} lecciones por reconciliar\n`);

  let fixed = 0;
  for (const l of lessons) {
    try {
      let assetId = l.muxAssetId;
      if (!assetId) {
        const upload = await mux.video.uploads.retrieve(l.muxUploadId!);
        assetId = upload.asset_id ?? null;
      }
      if (!assetId) {
        console.log(`⏳ ${l.title}: upload sin asset todavía (subiendo/procesando)`);
        continue;
      }
      const asset = await mux.video.assets.retrieve(assetId);
      if (asset.status !== "ready") {
        console.log(`⏳ ${l.title}: asset "${asset.status}"`);
        continue;
      }
      const playbackId = asset.playback_ids?.[0]?.id ?? null;
      if (!playbackId) {
        console.log(`⚠ ${l.title}: asset ready pero sin playback id`);
        continue;
      }
      await db.lesson.update({
        where: { id: l.id },
        data: { muxAssetId: assetId, muxPlaybackId: playbackId },
      });
      fixed++;
      console.log(`✔ ${l.title}: playback ${playbackId.slice(0, 12)}…`);
    } catch (e) {
      console.log(`✗ ${l.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\nReconciliadas ${fixed}/${lessons.length}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
