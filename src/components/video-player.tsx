"use client";

import MuxPlayer from "@mux/mux-player-react";

type Props = {
  playbackId: string;
  /** Email of the logged-in student. Shown as overlay watermark. */
  watermarkEmail: string;
  /** IP (best effort from request headers). Shown as overlay watermark. */
  watermarkIp: string;
  /** Optional title for the player chrome (Mux shows it on the controls). */
  title?: string;
};

/**
 * Mux player with a client-side watermark overlay showing the student's email
 * and IP. The overlay is positioned absolute on top of the video and rotates
 * subtly so it's harder to crop out. This is **disuasion**, not protection —
 * a determined attacker can record the screen. For paid digital courses with
 * <100 students this is the right cost/value trade-off.
 *
 * Future upgrade path: signed playback URLs (Mux signing keys) + DRM. Both
 * require the playback policy to be `signed` instead of `public` when the
 * upload is created. Out of scope for v1.
 */
export function VideoPlayer({
  playbackId,
  watermarkEmail,
  watermarkIp,
  title,
}: Props) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#0ea5e9"
        title={title}
        style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
      />

      {/* Watermark overlay: top-right, faint, rotated. aria-hidden so it
          doesn't appear in screen reader announcements but is still visible
          on screen recordings. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-3 right-3 select-none"
        style={{
          transform: "rotate(-2deg)",
          opacity: 0.55,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "11px",
          color: "white",
          textShadow: "0 0 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
          lineHeight: 1.3,
        }}
      >
        <div>{watermarkEmail}</div>
        <div>{watermarkIp}</div>
      </div>

      {/* Second watermark, bottom-left, with different rotation. Two anchors
          make cropping harder. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-12 left-3 select-none"
        style={{
          transform: "rotate(1deg)",
          opacity: 0.45,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "10px",
          color: "white",
          textShadow: "0 0 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)",
        }}
      >
        {watermarkEmail}
      </div>
    </div>
  );
}
