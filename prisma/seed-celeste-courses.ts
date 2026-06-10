import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Andamiaje de los 3 cursos de Celeste según "ESQUEMA CURSOS.pdf".
 * Para cada curso (que YA existe): borra fases/lecciones previas, lo despublica,
 * y crea las fases con sus lecciones VACÍAS (placeholders). Celeste solo tiene
 * que entrar a cada lección, subir el archivo, renombrar y publicar.
 *
 * Idempotente: limpia antes de crear, así que re-ejecutarlo deja el mismo estado.
 * Apunta DATABASE_URL a Prod (es donde están los cursos).
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
});

type LessonSpec = { type: "VIDEO" | "PDF"; title: string };
type FaseSpec = { title: string; lessons: LessonSpec[] };
type CourseSpec = { slug: string; fases: FaseSpec[] };

const videos = (n: number): LessonSpec[] =>
  Array.from({ length: n }, (_, i) => ({ type: "VIDEO", title: `Vídeo ${i + 1}` }));
const pdf = (): LessonSpec => ({ type: "PDF", title: "PDF" });

// Sesiones 1..20 (fases 2..21). Mentoría: solo vídeo. A tu ritmo: vídeo + PDF.
const sesiones = (withPdf: boolean): FaseSpec[] =>
  Array.from({ length: 20 }, (_, i) => ({
    title: `Sesión ${i + 1}`,
    lessons: withPdf ? [...videos(1), pdf()] : videos(1),
  }));

const COURSES: CourseSpec[] = [
  {
    slug: "supuestos-practicos-mentoria-individual",
    fases: [{ title: "Sesión 0. Los Comodines", lessons: videos(6) }, ...sesiones(false)],
  },
  {
    slug: "supuestos-practicos-a-tu-ritmo",
    fases: [{ title: "Sesión 0. Los Comodines", lessons: videos(6) }, ...sesiones(true)],
  },
  {
    slug: "programacion-de-aula-a-tu-manera",
    fases: [
      { title: "Primeros Pasos", lessons: [...videos(2), pdf()] },
      { title: "Embarque", lessons: videos(1) },
      { title: "Los Centros", lessons: videos(1) },
      { title: "Ser Competente", lessons: videos(1) },
      { title: "Ser Diverso", lessons: videos(2) },
      { title: "Tic-Tac", lessons: videos(1) },
      { title: "El Tercer Maestro", lessons: videos(1) },
      { title: "Las Situaciones de Aprendizaje", lessons: [...videos(3), pdf()] },
      { title: "La Evaluación", lessons: videos(2) },
      { title: "Fase 10", lessons: videos(1) }, // sin nombre — Celeste edita
      { title: "Fase 11", lessons: videos(2) }, // sin nombre — Celeste edita
    ],
  },
];

async function main() {
  const host = (process.env.DATABASE_URL ?? "").match(/@([^/:]+)/)?.[1] ?? "?";
  console.log("DB host:", host, "\n");

  for (const spec of COURSES) {
    const course = await db.course.findUnique({
      where: { slug: spec.slug },
      select: { id: true, title: true },
    });
    if (!course) {
      console.error(`✗ No existe curso con slug "${spec.slug}" — saltado.`);
      continue;
    }

    // Limpiar contenido previo y despublicar.
    await db.lesson.deleteMany({ where: { courseId: course.id } });
    await db.module.deleteMany({ where: { courseId: course.id } });
    await db.course.update({ where: { id: course.id }, data: { published: false } });

    // Crear fases + lecciones vacías. order de lección: global incremental.
    let order = 0;
    let lessonCount = 0;
    for (let f = 0; f < spec.fases.length; f++) {
      const fase = spec.fases[f]!;
      const mod = await db.module.create({
        data: { courseId: course.id, order: f + 1, title: fase.title },
      });
      for (const l of fase.lessons) {
        order++;
        lessonCount++;
        await db.lesson.create({
          data: {
            courseId: course.id,
            moduleId: mod.id,
            order,
            title: l.title,
            type: l.type,
          },
        });
      }
    }
    console.log(
      `✔ "${course.title}": ${spec.fases.length} fases, ${lessonCount} lecciones (despublicado)`
    );
  }
  console.log("\nListo. Celeste solo tiene que subir archivos y publicar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
