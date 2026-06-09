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
 *   5. Signing key for protected playback: Settings → Signing Keys → Generate.
 *      Copy the key id to MUX_SIGNING_KEY_ID and the (base64) private key to
 *      MUX_SIGNING_PRIVATE_KEY. With both set, new uploads use a `signed`
 *      playback policy and the player needs a JWT to play them.
 */
export function isMuxConfigured(): boolean {
  return Boolean(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET);
}

export function isMuxSigningConfigured(): boolean {
  return Boolean(env.MUX_SIGNING_KEY_ID && env.MUX_SIGNING_PRIVATE_KEY);
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
    // Signing keys are passed at construction so mux.jwt.signPlaybackId works
    // without explicit args. Optional — only needed if signing is configured.
    jwtSigningKey: env.MUX_SIGNING_KEY_ID,
    jwtPrivateKey: env.MUX_SIGNING_PRIVATE_KEY,
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
 *
 * Playback policy: `signed` when signing keys are configured (production),
 * otherwise `public` (fine for local dev). Existing assets keep their original
 * policy — the change only affects new uploads.
 */
export async function createDirectUpload(opts: {
  /**
   * Lesson to tag as passthrough. Optional: when uploading while *creating* a
   * lesson the row doesn't exist yet, so we omit it. The webhook still links
   * the asset to the lesson via the muxUploadId chain (upload → asset →
   * playback), so passthrough is just a convenience fallback.
   */
  lessonId?: string;
  corsOrigin: string;
}): Promise<{ uploadId: string; uploadUrl: string }> {
  const mux = requireMux();
  const policy: "signed" | "public" = isMuxSigningConfigured()
    ? "signed"
    : "public";
  const upload = await mux.video.uploads.create({
    cors_origin: opts.corsOrigin,
    new_asset_settings: {
      playback_policies: [policy],
      ...(opts.lessonId ? { passthrough: opts.lessonId } : {}),
      // Mux Smart Encoding: MP4 + HLS, all resolutions up to 1080p by default.
      // For higher fidelity (4K, etc.) bump max_resolution_tier.
    },
  });
  if (!upload.url) throw new Error("Mux no devolvió URL de upload");
  return { uploadId: upload.id, uploadUrl: upload.url };
}

export type MuxPlaybackTokens = {
  playback: string;
  thumbnail: string;
  storyboard: string;
};

/**
 * Generate signed JWTs for playback, thumbnail and storyboard. The Mux Player
 * accepts them via the `tokens` prop. Returns `null` if signing is not
 * configured — callers should fall back to playing without tokens (the asset
 * must then have a `public` policy).
 *
 * Token expiration is short (default 6h) because tokens are bound to a
 * specific user session: once the student leaves the course, we don't want a
 * leaked token to remain valid for days. The Mux SDK accepts duration strings
 * like "1h", "6h", "1d", "7d".
 */
export async function signPlaybackTokens(
  playbackId: string,
  opts: { expiration?: string } = {}
): Promise<MuxPlaybackTokens | null> {
  if (!isMuxSigningConfigured()) return null;
  const mux = requireMux();
  const expiration = opts.expiration ?? "6h";
  // SDK type values: "video" → playback-token, "thumbnail" → thumbnail-token,
  // "storyboard" → storyboard-token. The public docs use "playback" but the
  // typed enum is "video".
  const tokens = await mux.jwt.signPlaybackId(playbackId, {
    expiration,
    type: ["video", "thumbnail", "storyboard"],
  });
  return {
    playback: tokens["playback-token"] ?? "",
    thumbnail: tokens["thumbnail-token"] ?? "",
    storyboard: tokens["storyboard-token"] ?? "",
  };
}
