import "server-only";
import Mux from "@mux/mux-node";
import { env } from "@/lib/env";

/**
 * Mux is feature-flagged: env vars are optional in env.ts so the app boots
 * without it. Code paths that need Mux must call `isMuxConfigured()` first
 * or import `requireMux()`.
 *
 * Set up:
 *   1. Create a Mux account, generate an Access Token (Settings → Access Tokens).
 *   2. Permissions: Mux Video → Read+Write.
 *   3. Copy MUX_TOKEN_ID and MUX_TOKEN_SECRET to .env and Vercel.
 *   4. Webhook secret: Settings → Webhooks → Add → URL pointing to
 *      `/api/webhooks/mux`. Copy the signing secret to MUX_WEBHOOK_SECRET.
 */
export function isMuxConfigured(): boolean {
  return Boolean(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET);
}

let _client: Mux | null = null;

export function requireMux(): Mux {
  if (_client) return _client;
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    throw new Error(
      "Mux no está configurado. Define MUX_TOKEN_ID y MUX_TOKEN_SECRET."
    );
  }
  _client = new Mux({
    tokenId: env.MUX_TOKEN_ID,
    tokenSecret: env.MUX_TOKEN_SECRET,
  });
  return _client;
}

/**
 * Create a Mux Direct Upload that the browser uploads to. Returns the upload
 * id (we save in Lesson.muxUploadId so the webhook can match) and the URL
 * (where the browser PUTs the file).
 *
 * `passthrough` is reflected back to us in webhook payloads — we use the
 * lessonId so we know which Lesson row to update when the asset is ready.
 */
export async function createDirectUpload(opts: {
  lessonId: string;
  corsOrigin: string;
}): Promise<{ uploadId: string; uploadUrl: string }> {
  const mux = requireMux();
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin,
    new_asset_settings: {
      playback_policies: ["public"],
      passthrough: opts.lessonId,
      // Mux Smart Encoding: MP4 + HLS, all resolutions up to 1080p by default.
      // For higher fidelity (4K, etc.) bump max_resolution_tier.
    },
  });
  if (!upload.url) throw new Error("Mux no devolvió URL de upload");
  return { uploadId: upload.id, uploadUrl: upload.url };
}
