import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Stamp a per-student watermark onto every page of a PDF.
 *
 * The watermark is the real deterrent against sharing a paid temario: a légible
 * but unobtrusive diagonal tiling of the student's identity (email) at very low
 * opacity, plus a footer line on each page. It disuades, it doesn't prevent —
 * any rendered PDF can ultimately be captured — but a leaked file points back at
 * who leaked it.
 *
 * Helvetica (WinAnsi) only encodes Latin-1; we sanitise the label so an unusual
 * character in an email can't make `drawText` throw mid-stream.
 */
export async function watermarkPdf(
  bytes: Uint8Array,
  label: string
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const safe = sanitize(label);
  const footer = sanitize(`Licencia personal de ${label} · no compartir`);

  const tileSize = 13;
  const footerSize = 7;
  const stepX = 240;
  const stepY = 170;

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Diagonal tiled watermark across the whole page.
    for (let y = -stepY; y < height + stepY; y += stepY) {
      for (let x = -stepX; x < width + stepX; x += stepX) {
        page.drawText(safe, {
          x,
          y,
          size: tileSize,
          font,
          color: rgb(0.55, 0.55, 0.6),
          opacity: 0.07,
          rotate: degrees(45),
        });
      }
    }

    // Footer band with the student's identity.
    page.drawText(footer, {
      x: 24,
      y: 14,
      size: footerSize,
      font,
      color: rgb(0.5, 0.5, 0.55),
      opacity: 0.55,
    });
  }

  return pdf.save();
}

/** Drop characters Helvetica/WinAnsi can't encode, to avoid drawText throwing. */
function sanitize(s: string): string {
  // Keep printable ASCII plus a handful of common Latin-1 accents.
  return (
    s
      .replace(/[^\x20-\x7EÀ-ſ·]/g, "")
      .trim() || "licencia personal"
  );
}
