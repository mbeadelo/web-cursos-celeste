"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import MuxPlayer from "@mux/mux-player-react";

type Props = {
  playbackId: string;
  /** Segundos de teaser antes de cortar con el CTA de compra. */
  previewSeconds: number;
  /** Tokens firmados de `signPlaybackTokens()`. undefined si el asset es público. */
  tokens?: {
    playback: string;
    thumbnail: string;
    storyboard: string;
  };
  title?: string;
  courseId: string;
  courseSlug: string;
  /** El visitante ya tiene la matrícula → mostramos "Ir al curso" en vez de comprar. */
  enrolled: boolean;
  /** Stripe operativo en este entorno → el botón de compra funciona. */
  stripeReady: boolean;
};

/**
 * Reproductor de teaser para la landing pública del curso. Reproduce una
 * lección real cortada a `previewSeconds` y, al llegar al corte, tapa el vídeo
 * con un CTA de compra.
 *
 * ⚠️ El corte es client-side: el asset firmado se sirve entero al navegador,
 * así que un usuario técnico podría extraer la lección completa. Es un gancho
 * de marketing, no contenido protegido — por eso el admin elige qué lección
 * exponer. El contenido de pago vive tras `Enrollment` en /dashboard.
 */
export function CoursePreviewPlayer({
  playbackId,
  previewSeconds,
  tokens,
  title,
  courseId,
  courseSlug,
  enrolled,
  stripeReady,
}: Props) {
  const playerRef = useRef<HTMLMediaElement | null>(null);
  const [reached, setReached] = useState(false);

  function cutIfNeeded(target: HTMLMediaElement) {
    if (target.currentTime >= previewSeconds) {
      // Ancla el tiempo en el corte y pausa. Evita que un timeupdate tardío
      // deje el vídeo unas décimas más allá del límite.
      target.pause();
      if (target.currentTime > previewSeconds) target.currentTime = previewSeconds;
      setReached(true);
    }
  }

  function replay() {
    const el = playerRef.current;
    if (!el) return;
    setReached(false);
    el.currentTime = 0;
    void el.play?.();
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
      <MuxPlayer
        ref={playerRef as never}
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#0ea5e9"
        title={title}
        tokens={tokens}
        style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
        onTimeUpdate={(e) => cutIfNeeded(e.currentTarget as HTMLMediaElement)}
        onSeeking={(e) => {
          // No dejar que hagan scrubbing más allá del teaser.
          const target = e.currentTarget as HTMLMediaElement;
          if (target.currentTime > previewSeconds) {
            target.currentTime = previewSeconds;
            cutIfNeeded(target);
          }
        }}
      />

      {/* Watermark discreta: recuerda origen y que es una muestra. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-3 right-3 select-none"
        style={{
          transform: "rotate(-2deg)",
          opacity: 0.5,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "11px",
          color: "white",
          textShadow: "0 0 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
          lineHeight: 1.3,
        }}
      >
        <div>vista previa gratuita</div>
        <div>bienvenidoatuplaza.com</div>
      </div>

      {reached && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
          <p className="text-lg font-semibold text-white">
            Esto es solo el principio
          </p>
          <p className="max-w-sm text-sm text-white/80 leading-relaxed">
            Has visto la muestra gratuita. El curso completo te espera dentro.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {enrolled ? (
              <Link
                href={`/dashboard/cursos/${courseSlug}`}
                className="rounded-full bg-brand-celeste px-6 py-2.5 font-semibold text-brand-celeste-foreground transition hover:bg-brand-celeste-deep"
              >
                Ir al curso →
              </Link>
            ) : stripeReady ? (
              <form action="/api/checkout" method="POST">
                <input type="hidden" name="courseId" value={courseId} />
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-brand-celeste px-6 py-2.5 font-semibold text-brand-celeste-foreground transition hover:bg-brand-celeste-deep"
                >
                  Comprar curso
                </button>
              </form>
            ) : null}
            <button
              type="button"
              onClick={replay}
              className="cursor-pointer rounded-full border border-white/40 px-5 py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              Ver de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
