type Props = {
  /** Rating value 0..5. Decimals render as half stars. */
  value: number;
  /** Pixel size of each star. Default 16. */
  size?: number;
  /** When true, this is a label for screen readers ("4.6 de 5 estrellas"). */
  ariaLabel?: string;
};

/**
 * Read-only 5-star rating display. Renders filled, half, and empty stars
 * using a single SVG with two layered gradients so it works without JS.
 * For interactive input use `<RatingInput>` (separate, client component).
 */
export function RatingStars({ value, size = 16, ariaLabel }: Props) {
  const clamped = Math.max(0, Math.min(5, value));
  const fillPct = (clamped / 5) * 100;
  const px = `${size}px`;

  return (
    <span
      className="inline-flex items-center"
      role="img"
      aria-label={ariaLabel ?? `${clamped.toFixed(1)} de 5 estrellas`}
    >
      <span className="relative inline-block leading-none" style={{ height: px }}>
        {/* Empty layer */}
        <span className="text-neutral-300" style={{ fontSize: px, letterSpacing: "1px" }}>
          ★★★★★
        </span>
        {/* Filled layer clipped by width */}
        <span
          className="absolute left-0 top-0 overflow-hidden text-amber-400"
          style={{ width: `${fillPct}%`, fontSize: px, letterSpacing: "1px" }}
        >
          ★★★★★
        </span>
      </span>
    </span>
  );
}
