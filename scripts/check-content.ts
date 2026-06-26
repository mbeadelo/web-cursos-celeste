import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const euro = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );

async function main() {
  const courses = await db.course.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lessons: { orderBy: { order: "asc" }, select: { order: true, title: true, type: true } },
      _count: { select: { enrollments: true, reviews: true } },
    },
  });

  console.log(`\n══ ${courses.length} curso(s) en la base de datos ══\n`);
  for (const c of courses) {
    const flags = [
      c.published ? "PUBLICADO" : "borrador",
      c.type,
      c.badge ?? "",
    ].filter(Boolean).join(" · ");
    console.log(`▸ ${c.title}  [${flags}]`);
    console.log(`  slug: ${c.slug}  ·  precio: ${euro(c.priceCents)} ${c.currency}`);
    console.log(`  matrículas: ${c._count.enrollments}  ·  reseñas: ${c._count.reviews}`);
    if (c.lessons.length === 0) {
      console.log(`  lecciones: (ninguna)`);
    } else {
      console.log(`  lecciones (${c.lessons.length}):`);
      for (const l of c.lessons) {
        console.log(`    ${String(l.order).padStart(2)}. [${l.type}] ${l.title}`);
      }
    }
    console.log("");
  }
}

main()
  .catch((e) => { console.error("Error:", e?.message ?? e); process.exit(1); })
  .finally(() => db.$disconnect());
