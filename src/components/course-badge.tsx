type Badge = "BESTSELLER" | "NEW" | "COMING_SOON";

const STYLES: Record<Badge, { label: string; className: string }> = {
  BESTSELLER: {
    label: "Más vendido",
    className:
      "bg-gradient-to-r from-brand-magenta to-brand-celeste text-white shadow-sm",
  },
  NEW: {
    label: "Nuevo",
    className: "bg-brand-celeste text-brand-celeste-foreground",
  },
  COMING_SOON: {
    label: "Próximamente",
    className: "bg-neutral-900 text-white",
  },
};

/**
 * Marketing pill shown on course cards and on the landing page. Use the
 * `floating` variant when the badge sits over a cover image (adds backdrop
 * blur for legibility); plain variant for inline text contexts.
 */
export function CourseBadge({
  badge,
  floating = false,
}: {
  badge: Badge | null | undefined;
  floating?: boolean;
}) {
  if (!badge) return null;
  const { label, className } = STYLES[badge];
  return (
    <span
      className={
        "inline-flex items-center rounded-full text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 " +
        className +
        (floating
          ? " absolute top-3 left-3 backdrop-blur-sm ring-1 ring-white/20"
          : "")
      }
    >
      {label}
    </span>
  );
}
