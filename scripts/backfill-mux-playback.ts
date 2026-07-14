/**
 * Backfill de muxPlaybackId para lecciones cuyo webhook de Mux nunca llegó.
 *
 * Contexto: el endpoint de webhook de Mux apuntaba al apex
 * (bienvenidoatuplaza.com), que hace 308 → www. Mux no sigue redirects, así
 * que los eventos `video.asset.ready` nunca se entregaron y el playbackId
 * jamás se escribió en la lección, aunque el vídeo esté perfectamente
 * procesado en Mux.
 *
 * Este script va a la fuente de la verdad (la API de Mux) y reconcilia la DB.
 *
 *   pnpm exec tsx scripts/backfill-mux-playback.ts           → DRY RUN (no escribe)
 *   pnpm exec tsx scripts/backfill-mux-playback.ts --apply   → escribe en la DB
 */
import { config } from "dotenv";
import Mux from "@mux/mux-node";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Base: `.env` (de ahí sale DATABASE_URL, que apunta al único branch de Neon).
config({ path: ".env", quiet: true });

// Overlay: las credenciales de Mux del `.env` local son de OTRO entorno de Mux
// (ve 0 assets y no reconoce ni los vídeos que funcionan en prod). Hay que
// pasarle un token del entorno de Mux real, en un fichero aparte con solo:
//   MUX_TOKEN_ID=...
//   MUX_TOKEN_SECRET=...
// `vercel env pull` NO sirve: las vars están marcadas Sensitive en Vercel y
// bajan vacías. Hay que generar un token (Read-only basta) en el dashboard.
//
//   pnpm exec tsx scripts/backfill-mux-playback.ts --env-file .env.mux
const envFileIdx = process.argv.indexOf("--env-file");
if (envFileIdx !== -1) {
  const envFile = process.argv[envFileIdx + 1]!;
  config({ path: envFile, override: true, quiet: true });
  console.log(`credenciales de Mux desde: ${envFile}`);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const APPLY = process.argv.includes("--apply");

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
});

const mux = new Mux({
  tokenId: required("MUX_TOKEN_ID"),
  tokenSecret: required("MUX_TOKEN_SECRET"),
});

type Outcome =
  | { kind: "ready"; assetId: string; playbackId: string; policy: string }
  | { kind: "preparing"; assetId: string }
  | { kind: "errored"; detail: string }
  | { kind: "no-asset"; uploadStatus: string };

async function resolve(uploadId: string, assetId: string | null): Promise<Outcome> {
  // Si ya tenemos assetId nos saltamos el upload y vamos directos al asset.
  let resolvedAssetId = assetId;

  if (!resolvedAssetId) {
    const upload = await mux.video.uploads.retrieve(uploadId);
    if (!upload.asset_id) {
      return { kind: "no-asset", uploadStatus: upload.status ?? "desconocido" };
    }
    resolvedAssetId = upload.asset_id;
  }

  const asset = await mux.video.assets.retrieve(resolvedAssetId);
  if (asset.status === "errored") {
    return {
      kind: "errored",
      detail: JSON.stringify(asset.errors ?? {}),
    };
  }
  const playback = asset.playback_ids?.[0];
  if (asset.status === "ready" && playback?.id) {
    return {
      kind: "ready",
      assetId: resolvedAssetId,
      playbackId: playback.id,
      policy: playback.policy ?? "?",
    };
  }
  return { kind: "preparing", assetId: resolvedAssetId };
}

async function main() {
  const pendientes = await db.lesson.findMany({
    where: { type: "VIDEO", muxPlaybackId: null, muxUploadId: { not: null } },
    select: {
      id: true,
      title: true,
      muxUploadId: true,
      muxAssetId: true,
      course: { select: { title: true } },
    },
    orderBy: [{ course: { title: "asc" } }, { order: "asc" }],
  });

  console.log(
    `\n${APPLY ? "🔧 APLICANDO" : "🔍 DRY RUN (no se escribe nada)"} · ${pendientes.length} lección(es) con upload pero sin playbackId\n`
  );

  let listos = 0;
  let procesando = 0;
  let fallidos = 0;
  let sinAsset = 0;

  for (const l of pendientes) {
    const etiqueta = `${l.course.title} → ${l.title}`;
    try {
      const r = await resolve(l.muxUploadId!, l.muxAssetId);

      if (r.kind === "ready") {
        listos++;
        console.log(`✅ ${etiqueta}`);
        console.log(`   playbackId=${r.playbackId}  policy=${r.policy}`);
        if (APPLY) {
          await db.lesson.update({
            where: { id: l.id },
            data: { muxAssetId: r.assetId, muxPlaybackId: r.playbackId },
          });
          console.log(`   → escrito en la DB`);
        }
      } else if (r.kind === "preparing") {
        procesando++;
        console.log(`⏳ ${etiqueta}\n   Mux aún procesando (asset ${r.assetId})`);
      } else if (r.kind === "errored") {
        fallidos++;
        console.log(`❌ ${etiqueta}\n   Mux dice ERRORED: ${r.detail}`);
      } else {
        sinAsset++;
        console.log(
          `⬜ ${etiqueta}\n   Upload sin asset (status=${r.uploadStatus}) → el fichero nunca llegó a Mux`
        );
      }
    } catch (e) {
      fallidos++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ ${etiqueta}\n   Error consultando Mux: ${msg}`);
    }
  }

  console.log(
    `\n── Resumen: ✅ ${listos} recuperables · ⏳ ${procesando} procesando · ⬜ ${sinAsset} sin asset · ❌ ${fallidos} error`
  );
  if (!APPLY && listos > 0) {
    console.log(`\nPara escribirlos: pnpm exec tsx scripts/backfill-mux-playback.ts --apply\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
