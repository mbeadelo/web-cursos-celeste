import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canAccessLesson } from "@/lib/access";
import { getObjectBytes, isStorageConfigured } from "@/lib/storage";
import { watermarkPdf } from "@/lib/pdf-watermark";

export const runtime = "nodejs";

/**
 * GET /api/lessons/[lessonId]/file
 *
 * Serves a lesson's PDF gated by Enrollment, with a per-student watermark.
 *
 * Why this exists instead of a public R2 URL: a paid temario must not live on a
 * shareable public link. This route (a) requires a logged-in user who is
 * enrolled in the course (or an admin), (b) fetches the file from R2 with our
 * own credentials so the object key is never exposed, and (c) stamps the
 * student's email on every page so a leaked copy is traceable.
 *
 * `?download=1` serves it as an attachment; otherwise inline (for the embedded
 * viewer). Responses are per-user, so they must never be shared-cached.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await ctx.params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (!isStorageConfigured()) {
    return new Response("Almacenamiento no configurado", { status: 503 });
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true, fileKey: true, title: true },
  });
  if (!lesson || lesson.type !== "PDF" || !lesson.fileKey) {
    return new Response("No encontrado", { status: 404 });
  }

  // Gate: enrolled in the course, or admin (admins preview without enrollment).
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin) {
    const ok = await canAccessLesson(session.user.id, lessonId);
    if (!ok) return new Response("Sin acceso", { status: 403 });
  }

  let bytes: Uint8Array;
  try {
    bytes = await getObjectBytes(lesson.fileKey);
  } catch (err) {
    console.error("[lesson file] no se pudo leer de R2", lesson.fileKey, err);
    return new Response("Archivo no disponible", { status: 502 });
  }

  // Watermark with the student's identity. If stamping fails (corrupt/odd PDF),
  // fall back to the original bytes rather than breaking the lesson.
  const label = session.user.email ?? session.user.id;
  let out = bytes;
  try {
    out = await watermarkPdf(bytes, label);
  } catch (err) {
    console.warn("[lesson file] watermark falló, sirvo original", lessonId, err);
  }

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const filename = `${slugifyTitle(lesson.title)}.pdf`;

  return new Response(out as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      // Per-user (watermarked): never store in shared caches.
      "Cache-Control": "private, no-store",
    },
  });
}

function slugifyTitle(title: string): string {
  return (
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "material"
  );
}
