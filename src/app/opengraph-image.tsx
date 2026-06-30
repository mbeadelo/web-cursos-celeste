import { ImageResponse } from "next/og";

// Default Open Graph image for the whole site. Applies to any route that
// doesn't ship a more specific opengraph-image (home, /cursos, /packs,
// /articulos listing, legal…). Detail pages (/cursos/[slug], /articulos/[slug])
// have their own. Brand wordmark on the celeste→magenta gradient.

export const runtime = "nodejs";
export const alt = "Bienvenido a tu plaza";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
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
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.85,
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "9999px",
              background: "white",
            }}
          />
          Cursos para tu oposición
        </div>

        <div
          style={{
            fontSize: "92px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            textShadow: "0 2px 12px rgba(0,0,0,0.18)",
            marginTop: "24px",
            display: "flex",
          }}
        >
          Bienvenido a tu plaza
        </div>

        <div
          style={{
            fontSize: "30px",
            lineHeight: 1.4,
            opacity: 0.92,
            maxWidth: "900px",
            marginTop: "20px",
            display: "flex",
          }}
        >
          Prepara tu oposición a tu ritmo: vídeos, materiales y acompañamiento.
        </div>
      </div>
    ),
    { ...size }
  );
}
