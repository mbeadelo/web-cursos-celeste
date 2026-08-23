/**
 * Rewrite public R2 image URLs so the browser fetches them through our own
 * domain (`/img/<key>`) instead of hitting `pub-*.r2.dev` directly.
 *
 * Why: Spanish ISPs block shared Cloudflare IP ranges during LaLiga match
 * windows (court-ordered anti-piracy blocks, active since Feb 2025). The
 * r2.dev hosts fall inside those ranges, so covers and site images vanish for
 * affected visitors. Served from our Vercel domain — with the CDN caching the
 * response — the images stay up regardless; Vercel fetches R2 from its own
 * network, outside the blocks.
 *
 * URLs that don't point at r2.dev (external pastes, local assets) pass
 * through untouched. DB values stay as canonical R2 URLs; the rewrite is
 * render-time only.
 */
export function proxiedImageSrc(url: string): string;
export function proxiedImageSrc(url: string | null | undefined): string | null;
export function proxiedImageSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && u.hostname.endsWith(".r2.dev")) {
      return `/img${u.pathname}`;
    }
  } catch {
    // Relative or malformed URL — leave it alone.
  }
  return url;
}
