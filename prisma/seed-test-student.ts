import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Crea (o reutiliza) un alumno de pruebas y lo matricula (source=MANUAL) en
 * uno o todos los cursos/packs publicados, para poder probar la vista de alumno.
 *
 * Uso:
 *   tsx prisma/seed-test-student.ts [email] [slug]
 *   - email: opcional, por defecto alumno.pruebas@example.com
 *   - slug:  opcional, si se da matricula solo en ese curso/pack;
 *            si se omite, matricula en TODOS los publicados.
 *
 * Apunta DATABASE_URL a tu branch de DESARROLLO de Neon, nunca a prod.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const email = (process.argv[2] ?? "alumno.pruebas@example.com").toLowerCase();
const slug = process.argv[3];

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
});

async function main() {
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, role: "STUDENT" },
  });

  const courses = await db.course.findMany({
    where: slug ? { slug } : { published: true },
    select: { id: true, slug: true, title: true, type: true },
  });
  if (courses.length === 0) {
    console.error(
      slug
        ? `No existe ningún curso/pack con slug "${slug}".`
        : "No hay cursos/packs publicados que matricular."
    );
    process.exit(1);
  }

  for (const c of courses) {
    await db.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: c.id } },
      update: {},
      create: { userId: user.id, courseId: c.id, source: "MANUAL" },
    });
    console.log(`✔ ${email} → ${c.title} (${c.slug}) [${c.type}]`);
  }
  console.log(`\nAlumno de pruebas listo: ${email}. Entra con magic link en /login.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
