import { NextResponse } from "next/server";
import { getPublicImage, isStorageConfigured } from "@/lib/storage";

/**
 * Serve public R2 images (covers, site assets) through our own domain.
 *
 * Exists because Spanish ISPs block Cloudflare's shared IP ranges during
 * LaLiga match windows, which takes `pub-*.r2.dev` down for affected
 * visitors. This route fetches from R2 server-side (Vercel's network, outside
 * the blocks) and the immutable Cache-Control lets Vercel's CDN absorb
 * repeat traffic, so R2 is only hit on cache misses.
 *
 * Only prefixes that are public by design are allowed — gated lesson files
 * keep going through their own authorized route.
 */
const ALLOWED_PREFIXES = ["covers/", "site/"];

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await ctx.params;
  const key = segments.join("/");

  const allowed =
    key.length < 512 &&
    !key.includes("..") &&
    ALLOWED_PREFIXES.some((p) => key.startsWith(p));
  if (!allowed || !isStorageConfigured()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const obj = await getPublicImage(key);
  if (!obj) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(obj.bytes), {
    headers: {
      "Content-Type": obj.contentType ?? "application/octet-stream",
      // Keys embed timestamp + random suffix, so content at a key never
      // changes → safe to cache forever (browser and Vercel CDN).
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Neutralize scripts if an SVG is ever navigated to directly.
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
