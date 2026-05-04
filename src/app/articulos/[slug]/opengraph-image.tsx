import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

// Dynamic Open Graph image for articles. Renders for any /articulos/[slug]
// page; if the article has a coverUrl set in metadata it overrides this.
// Falls back to the article title on a celeste→magenta gradient.

export const runtime = "nodejs";
export const alt = "Bienvenido a tu plaza";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await db.article.findUnique({
    where: { slug },
    select: { title: true, excerpt: true },
  });

  const title = article?.title ?? "Bienvenido a tu plaza";
  const excerpt = article?.excerpt?.slice(0, 140) ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          background:
            "linear-gradient(135deg, #38bdf8 0%, #c084fc 50%, #f0abfc 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "20px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              background: "white",
            }}
          />
          Bienvenido a tu plaza · Blog
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center" }}>
          <div
            style={{
              fontSize: title.length > 60 ? "60px" : "76px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 12px rgba(0,0,0,0.18)",
              display: "flex",
            }}
          >
            {title}
          </div>
        </div>

        {excerpt && (
          <div
            style={{
              fontSize: "26px",
              lineHeight: 1.4,
              opacity: 0.92,
              maxWidth: "1000px",
              display: "flex",
            }}
          >
            {excerpt}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
