import "dotenv/config";
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

async function main() {
  const lessons = await db.lesson.findMany({
    where: { type: "VIDEO" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      muxUploadId: true,
      muxAssetId: true,
      muxPlaybackId: true,
      course: { select: { title: true } },
    },
    orderBy: [{ course: { title: "asc" } }, { order: "asc" }],
  });

  type Row = (typeof lessons)[number];
  const byCourse = new Map<string, Row[]>();
  for (const l of lessons) {
    const arr = byCourse.get(l.course.title) ?? [];
    arr.push(l);
    byCourse.set(l.course.title, arr);
  }

  const state = (l: Row) =>
    l.muxPlaybackId ? "ready" : l.muxAssetId || l.muxUploadId ? "processing" : "empty";

  for (const [course, rows] of byCourse) {
    const ready = rows.filter((r) => state(r) === "ready").length;
    const proc = rows.filter((r) => state(r) === "processing").length;
    const empty = rows.filter((r) => state(r) === "empty").length;
    console.log(`\n■ ${course}`);
    console.log(`  ✅ ${ready} listos · ⏳ ${proc} procesando · ⬜ ${empty} sin vídeo`);
    for (const r of rows) {
      const icon = state(r) === "ready" ? "✅" : state(r) === "processing" ? "⏳" : "⬜";
      const day = r.createdAt.toISOString().slice(0, 10);
      console.log(`    ${icon} ${day}  ${r.title}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
