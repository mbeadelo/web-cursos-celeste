import { Quote } from "lucide-react";

export type Testimonial = {
  name: string;
  role: string;
  body: string;
};

/**
 * Slots reserved in SITE_CONTENT_KEYS (`home.testimonials.tN.*`). Keep in sync
 * with the catalogue when adding more.
 */
export const TESTIMONIAL_SLOTS = [1, 2, 3, 4, 5, 6] as const;

/** A slot is visible when it has both a name and a body, and neither is "-". */
export function isVisibleTestimonial(t: Testimonial): boolean {
  const name = t.name.trim();
  const body = t.body.trim();
  return name.length > 0 && name !== "-" && body.length > 0 && body !== "-";
}

// Accent rotates per card so the wall doesn't look monotone. Same trio as the
// "Por qué esta plaza" cards (celeste → amber → magenta).
const TONES = [
  {
    quote: "text-brand-celeste",
    avatar: "bg-brand-celeste text-brand-celeste-foreground",
    ring: "hover:ring-brand-celeste/50",
  },
  {
    quote: "text-brand-amber",
    avatar: "bg-brand-amber text-brand-amber-foreground",
    ring: "hover:ring-brand-amber/50",
  },
  {
    quote: "text-brand-magenta",
    avatar: "bg-brand-magenta text-brand-magenta-foreground",
    ring: "hover:ring-brand-magenta/50",
  },
] as const;

export function Testimonials({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: Testimonial[];
}) {
  const visible = items.filter(isVisibleTestimonial);
  if (visible.length === 0) return null;
  const [featured, ...rest] = visible;

  return (
    <div className="space-y-10">
      <div className="text-center space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
          {eyebrow}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      </div>

      {/* First slot is the featured quote (full width); the rest fill a 3-col grid.
          The admin picks the featured one by putting it in "Reseña 1". */}
      {featured ? <Card t={featured} tone={TONES[0]} featured /> : null}
      {rest.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rest.map((t, i) => (
            <Card key={i} t={t} tone={TONES[(i + 1) % TONES.length] ?? TONES[0]} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Card({
  t,
  tone,
  featured = false,
}: {
  t: Testimonial;
  tone: (typeof TONES)[number];
  featured?: boolean;
}) {
  const initial = t.name.trim().charAt(0).toUpperCase();
  const role = t.role.trim();
  return (
    <figure
      className={`relative break-inside-avoid rounded-2xl bg-white ring-1 ring-foreground/10 shadow-sm transition hover:-translate-y-0.5 ${tone.ring} ${
        featured ? "p-7 md:p-10" : "p-6 md:p-7"
      }`}
    >
      <Quote
        className={`absolute right-5 top-5 opacity-25 ${tone.quote} ${
          featured ? "size-10 md:size-12" : "size-8"
        }`}
        strokeWidth={1.5}
        aria-hidden
      />
      <blockquote
        className={`pr-8 text-neutral-700 leading-relaxed whitespace-pre-line ${
          featured ? "text-base md:text-lg md:pr-16 max-w-3xl" : "text-[15px]"
        }`}
      >
        {t.body.trim()}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full font-bold ${tone.avatar} ${
            featured ? "size-11 text-base" : "size-9 text-sm"
          }`}
          aria-hidden
        >
          {initial}
        </span>
        <span className="text-sm leading-tight">
          <span className="block font-semibold">{t.name.trim()}</span>
          {role ? <span className="block text-neutral-500">{role}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}
