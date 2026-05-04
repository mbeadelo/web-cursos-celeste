import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isMuxConfigured, createDirectUpload } from "@/lib/mux";

export const runtime = "nodejs";

/**
 * POST /api/mux/upload-url
 * Body (JSON): { lessonId: string }
 *
 * Creates a Direct Upload for the given lesson and saves the upload id on
 * the Lesson row. The admin then PUTs the video file to the returned URL.
 * Mux webhooks will fill `muxAssetId` and `muxPlaybackId` once the asset is
 * processed and ready.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }
  if (!isMuxConfigured()) {
    return new Response("Mux no configurado", { status: 503 });
  }

  let body: { lessonId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Body JSON requerido", { status: 400 });
  }
  const lessonId = typeof body.lessonId === "string" ? body.lessonId : null;
  if (!lessonId) return new Response("lessonId requerido", { status: 400 });

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, type: true },
  });
  if (!lesson) return new Response("Lección no encontrada", { status: 404 });
  if (lesson.type !== "VIDEO") {
    return new Response("La lección no es de tipo VIDEO", { status: 400 });
  }

  const origin = new URL(req.url).origin;

  const { uploadId, uploadUrl } = await createDirectUpload({
    lessonId: lesson.id,
    corsOrigin: origin,
  });

  // Save the upload id so the webhook can find this lesson via passthrough
  // OR via direct lookup. We track both for resilience.
  await db.lesson.update({
    where: { id: lesson.id },
    data: { muxUploadId: uploadId },
  });

  return NextResponse.json({ uploadUrl, uploadId });
}
