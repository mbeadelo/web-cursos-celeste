"use client";

import { useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { recordVideoProgress } from "@/lib/progress";

type Props = {
  playbackId: string;
  /** Email of the logged-in student. Shown as overlay watermark. */
  watermarkEmail: string;
  /** IP (best effort from request headers). Shown as overlay watermark. */
  watermarkIp: string;
  /** Optional title for the player chrome (Mux shows it on the controls). */
  title?: string;
  /**
   * Signed playback tokens from `signPlaybackTokens()`. Required when the
   * underlying asset uses a `signed` playback policy; ignored if the asset is
   * `public`. When undefined we play unsigned (legacy/dev path).
   */
  tokens?: {
    playback: string;
    thumbnail: string;
    storyboard: string;
  };
  /**
   * If set, the player records playback progress for this lesson. Throttled
   * to one upsert every 10 s plus one on `ended`. Server action validates
   * enrollment, so we silently ignore failures here.
   */
  lessonId?: string;
  /**
   * Initial seek (in seconds) for "continue where you left off". Comes from
   * the latest LessonProgress.lastSeconds. Skipped when 0 or unset.
   */
  startAt?: number;
};

const PROGRESS_INTERVAL_MS = 10_000;

/**
 * Mux player with signed playback tokens (when configured) plus a client-side
 * watermark overlay showing the student's email and IP. The overlay rotates
 * subtly so it's harder to crop out. Watermark is disuasion against casual
 * sharing; signed playback is what actually prevents non-students from
 * watching the video by URL.
 */
export function VideoPlayer({
  playbackId,
  watermarkEmail,
  watermarkIp,
  title,
  tokens,
  lessonId,
  startAt,
}: Props) {
  const lastReportRef = useRef(0);
  const seekedRef = useRef(false);

  function reportProgress(currentTime: number, duration: number) {
    if (!lessonId) return;
    void recordVideoProgress({
      lessonId,
      lastSeconds: currentTime,
      durationSeconds: duration,
    }).catch(() => {
      // Silent — auth may have expired; don't break playback.
    });
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#0ea5e9"
        title={title}
        tokens={tokens}
        style={{ width: "100%", height: "100%", aspectRatio: "16/9" }}
        onLoadedMetadata={(e) => {
          // Restore last position once metadata is available. We only seek
          // once per mount so re-renders don't fight the user scrubbing.
          if (seekedRef.current) return;
          if (typeof startAt === "number" && startAt > 5) {
            const target = e.currentTarget as HTMLMediaElement;
            // Don't seek past the end — clamp to duration - 5s as a safety net.
            const max = Math.max(0, (target.duration || 0) - 5);
            target.currentTime = Math.min(startAt, max);
          }
          seekedRef.current = true;
        }}
        onTimeUpdate={(e) => {
          if (!lessonId) return;
          const now = Date.now();
          if (now - lastReportRef.current < PROGRESS_INTERVAL_MS) return;
          lastReportRef.current = now;
          const target = e.currentTarget as HTMLMediaElement;
          reportProgress(target.currentTime, target.duration || 0);
        }}
        onEnded={(e) => {
          if (!lessonId) return;
          const target = e.currentTarget as HTMLMediaElement;
          reportProgress(target.currentTime, target.duration || 0);
        }}
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
        <div>bienvenidoatuplaza.com</div>
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
        <div>{watermarkEmail}</div>
        <div>bienvenidoatuplaza.com</div>
      </div>
    </div>
  );
}
