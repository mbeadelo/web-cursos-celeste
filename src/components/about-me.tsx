type Props = {
  eyebrow: string;
  title: string;
  body: string; // HTML from TipTap or plain default
  image: string; // portrait URL (R2, external, or local default)
};

export function AboutMe({ eyebrow, title, body, image }: Props) {
  return (
    <section className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center">
      <div className="relative mx-auto md:mx-0">
        <div
          aria-hidden
          className="absolute -inset-3 rounded-full bg-gradient-to-br from-brand-celeste/40 to-brand-magenta/40 blur-2xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="Retrato de la persona detrás de Bienvenido a tu plaza"
          className="relative size-48 md:size-56 rounded-full object-cover ring-4 ring-white shadow-lg"
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
          {eyebrow}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
        <div
          className="prose prose-neutral max-w-none text-neutral-700 leading-relaxed"
          // Safe: body comes from the TipTap editor (admin-only) with whitelisted nodes/marks.
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </section>
  );
}
