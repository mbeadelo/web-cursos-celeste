import "dotenv/config";
import Mux from "@mux/mux-node";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
  console.log(`\nToken local MUX_TOKEN_ID = ${required("MUX_TOKEN_ID").slice(0, 12)}…\n`);

  // 1. ¿Cuántos assets ve este token en SU entorno?
  const page = await mux.video.assets.list({ limit: 100 });
  console.log(`Assets visibles con este token: ${page.data.length}`);
  if (page.data.length > 0) {
    console.log(`  ejemplo: ${page.data[0]!.id}  status=${page.data[0]!.status}`);
  }

  // 2. Coger una lección que YA funciona (tiene playbackId) y pedirle su asset.
  const buena = await db.lesson.findFirst({
    where: { type: "VIDEO", muxPlaybackId: { not: null }, muxAssetId: { not: null } },
    select: { title: true, muxAssetId: true, muxPlaybackId: true },
  });

  if (!buena) {
    console.log("\nNo hay ninguna lección con playbackId + assetId para contrastar.");
    return;
  }

  console.log(`\nContraste con una lección QUE SÍ FUNCIONA: "${buena.title}"`);
  console.log(`  muxAssetId en DB   = ${buena.muxAssetId}`);
  console.log(`  muxPlaybackId en DB = ${buena.muxPlaybackId}`);
  try {
    const asset = await mux.video.assets.retrieve(buena.muxAssetId!);
    console.log(`  ✅ Mux la reconoce: status=${asset.status}`);
    console.log(`     → mi token SÍ es del entorno correcto.`);
    console.log(`     → los 14 pendientes están de verdad en OTRO entorno de Mux.`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ❌ Mux NO la reconoce: ${msg}`);
    console.log(`     → mi token local es del entorno EQUIVOCADO.`);
    console.log(`     → hacen falta las credenciales MUX de Vercel Production.`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
