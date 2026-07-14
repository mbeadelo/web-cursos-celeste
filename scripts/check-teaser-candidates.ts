import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const courses = await db.course.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: {
          order: true,
          title: true,
          type: true,
          muxPlaybackId: true,
          previewSeconds: true,
        },
      },
    },
  });

  for (const c of courses) {
    const videos = c.lessons.filter((l) => l.type === "VIDEO");
    const listos = videos.filter((l) => l.muxPlaybackId);
    const marcados = c.lessons.filter((l) => l.previewSeconds);
    const estado = c.published ? "PUBLICADO" : "borrador";

    console.log(`\n▸ ${c.title}  [${estado} · ${c.type}]  slug: ${c.slug}`);
    console.log(
      `  lecciones: ${c.lessons.length}  ·  vídeos: ${videos.length}  ·  vídeos LISTOS en Mux: ${listos.length}`
    );

    if (marcados.length > 0) {
      for (const m of marcados) {
        console.log(`  ✅ YA ES TEASER: "${m.title}" (${m.previewSeconds}s)`);
      }
    } else if (listos.length > 0) {
      console.log(`  ✳️  CANDIDATOS a teaser (vídeo listo):`);
      for (const l of listos.slice(0, 4)) {
        console.log(`      ${String(l.order).padStart(2)}. ${l.title}`);
      }
      if (listos.length > 4) console.log(`      … y ${listos.length - 4} más`);
    } else if (videos.length > 0) {
      console.log(
        `  ⏳ tiene ${videos.length} vídeo(s) pero NINGUNO listo en Mux (sin playbackId) → no puede ser teaser aún`
      );
    } else {
      console.log(`  ❌ SIN VÍDEOS (solo PDF/texto) → el teaser actual no aplica`);
    }
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
