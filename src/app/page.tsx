import Link from "next/link";
import { auth } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { FeaturedCourses } from "@/components/featured-courses";
import { AboutMe } from "@/components/about-me";
import { getAllContent, pickContent } from "@/lib/site-content";
import {
  Footprints,
  FileText,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

export default async function Home() {
  const [session, content] = await Promise.all([auth(), getAllContent()]);

  const heroSubtitle = pickContent(content, "home.hero.subtitle");
  const heroCtaPrimary = pickContent(content, "home.hero.cta_primary");
  const heroCtaLogin = pickContent(content, "home.hero.cta_login");
  const heroCtaDashboard = pickContent(content, "home.hero.cta_dashboard");
  const featuredTitle = pickContent(content, "home.featured.title");
  const featuredSubtitle = pickContent(content, "home.featured.subtitle");
  const ctaTitle = pickContent(content, "home.cta.title");
  const ctaBody = pickContent(content, "home.cta.body");
  const ctaButton = pickContent(content, "home.cta.button");
  const aboutEyebrow = pickContent(content, "about.eyebrow");
  const aboutTitle = pickContent(content, "about.title");
  const aboutBody = pickContent(content, "about.body");
  const aboutImage = pickContent(content, "about.image");
  const whyEyebrow = pickContent(content, "home.why.eyebrow");
  const whyTitle = pickContent(content, "home.why.title");
  const whyFeatures = [
    {
      title: pickContent(content, "home.why.f1.title"),
      body: pickContent(content, "home.why.f1.body"),
      tone: "celeste" as const,
      Icon: Footprints,
    },
    {
      title: pickContent(content, "home.why.f2.title"),
      body: pickContent(content, "home.why.f2.body"),
      tone: "amber" as const,
      Icon: FileText,
    },
    {
      title: pickContent(content, "home.why.f3.title"),
      body: pickContent(content, "home.why.f3.body"),
      tone: "magenta" as const,
      Icon: HeartHandshake,
    },
  ];
  const stats = [
    {
      number: pickContent(content, "home.stats.s1.number"),
      label: pickContent(content, "home.stats.s1.label"),
    },
    {
      number: pickContent(content, "home.stats.s2.number"),
      label: pickContent(content, "home.stats.s2.label"),
    },
    {
      number: pickContent(content, "home.stats.s3.number"),
      label: pickContent(content, "home.stats.s3.label"),
    },
    {
      number: pickContent(content, "home.stats.s4.number"),
      label: pickContent(content, "home.stats.s4.label"),
    },
  ];

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-celeste/10 via-white to-white"
          />
          <div
            aria-hidden
            className="absolute -top-32 -right-20 -z-10 size-[500px] rounded-full bg-brand-magenta/10 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute top-40 -left-32 -z-10 size-[420px] rounded-full bg-brand-celeste/15 blur-3xl"
          />

          <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center space-y-8">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-icon.png"
                alt=""
                aria-hidden
                className="h-16 md:h-24 w-auto shrink-0"
              />
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                Bienvenido a{" "}
                <span className="bg-gradient-to-r from-brand-celeste to-brand-magenta bg-clip-text text-transparent">
                  tu plaza
                </span>
              </h1>
            </div>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-neutral-600 leading-relaxed">
              {heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                href="/cursos"
                className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-6 py-3 font-medium hover:bg-brand-celeste-deep transition shadow-sm"
              >
                {heroCtaPrimary}
              </Link>
              {session ? (
                <Link
                  href="/dashboard"
                  className="rounded-full border border-neutral-300 bg-white px-6 py-3 font-medium hover:border-brand-celeste hover:text-brand-celeste-deep transition"
                >
                  {heroCtaDashboard}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-neutral-300 bg-white px-6 py-3 font-medium hover:border-brand-celeste hover:text-brand-celeste-deep transition"
                >
                  {heroCtaLogin}
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ── Stats strip ────────────────────────────────── */}
        <section className="max-w-5xl mx-auto px-6 -mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-2xl bg-white ring-1 ring-foreground/10 p-6 shadow-sm">
            {stats.map((s, i) => (
              <Stat key={i} number={s.number} label={s.label} />
            ))}
          </div>
        </section>

        {/* ── Featured courses carousel ─────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <FeaturedCourses title={featuredTitle} subtitle={featuredSubtitle} />
        </section>

        {/* ── Sobre mí ───────────────────────────────────── */}
        <section className="bg-gradient-to-b from-white to-brand-celeste/5 border-y border-neutral-200">
          <div className="max-w-5xl mx-auto px-6 py-20">
            <AboutMe
              eyebrow={aboutEyebrow}
              title={aboutTitle}
              body={aboutBody}
              image={aboutImage}
            />
          </div>
        </section>

        {/* ── Por qué esta plaza ────────────────────────── */}
        <section className="bg-gradient-to-b from-brand-celeste/5 via-white to-brand-magenta/5 border-y border-neutral-200">
          <div className="max-w-5xl mx-auto px-6 py-20 space-y-10">
            <div className="text-center space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-celeste-deep font-semibold">
                {whyEyebrow}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                {whyTitle}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {whyFeatures.map((f) => (
                <Feature
                  key={f.title}
                  title={f.title}
                  body={f.body}
                  tone={f.tone}
                  Icon={f.Icon}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonios + CTA (degradado celeste compartido, full-width) ── */}
        <section className="bg-gradient-to-b from-white via-brand-celeste/5 to-brand-celeste/10 border-y border-neutral-200">
          <div className="max-w-5xl mx-auto px-6 py-20 space-y-16">
            {/* Testimonios (DEMO — quitar cuando haya reseñas reales) */}
            <div className="space-y-10">
              <div className="text-center space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
                  Testimonios
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Lo que cuentan quienes ya están dentro
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DEMO_TESTIMONIOS.map((t, i) => (
                  <figure
                    key={i}
                    className="rounded-2xl bg-white ring-1 ring-foreground/10 p-6 space-y-4 shadow-sm"
                  >
                    <div className="text-brand-amber text-sm tracking-widest" aria-hidden>
                      ★★★★★
                    </div>
                    <blockquote className="text-sm text-neutral-700 leading-relaxed">
                      “{t.body}”
                    </blockquote>
                    <figcaption className="text-sm font-semibold">
                      {t.name}{" "}
                      <span className="text-neutral-500 font-normal">· {t.role}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            {/* CTA "Empezamos" — plano sobre el degradado, sin recuadro */}
            <div className="text-center space-y-6 max-w-2xl mx-auto">
              <div className="space-y-3">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  {ctaTitle}
                </h2>
                <p className="text-neutral-600 leading-relaxed">{ctaBody}</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link
                  href="/cursos"
                  className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-7 py-3.5 font-semibold hover:bg-brand-celeste-deep transition shadow-sm"
                >
                  {ctaButton}
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>
      <PublicFooter />
    </>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-brand-celeste-deep">
        {number}
      </div>
      <div className="text-xs md:text-sm text-neutral-600 mt-1">{label}</div>
    </div>
  );
}

// DEMO — testimonios de ejemplo para maquetar la sección. Quitar este array y
// la sección "Testimonios" del JSX cuando haya reseñas reales de alumnas.
const DEMO_TESTIMONIOS = [
  {
    name: "María G.",
    role: "Aprobada 2024",
    body: "El acompañamiento marcó la diferencia. Llegué al examen con un método claro y seguridad, no a ciegas como otras veces.",
  },
  {
    name: "Laura M.",
    role: "Plaza en su 2ª convocatoria",
    body: "Las situaciones de aprendizaje se me hacían un mundo. Con las sesiones lo entendí y dejé de bloquearme.",
  },
  {
    name: "Sergio P.",
    role: "Opositor",
    body: "Material actualizado y al grano. Estudiar a mi ritmo con los vídeos y PDFs me dejó compaginarlo con el trabajo.",
  },
];

const FEATURE_TONES = {
  celeste: { dot: "bg-brand-celeste", ring: "hover:ring-brand-celeste/50" },
  amber: { dot: "bg-brand-amber", ring: "hover:ring-brand-amber/50" },
  magenta: { dot: "bg-brand-magenta", ring: "hover:ring-brand-magenta/50" },
} as const;

function Feature({
  title,
  body,
  tone,
  Icon,
}: {
  title: string;
  body: string;
  tone: keyof typeof FEATURE_TONES;
  Icon: LucideIcon;
}) {
  const t = FEATURE_TONES[tone];
  return (
    <div
      className={`rounded-2xl bg-white ring-1 ring-foreground/10 p-6 space-y-2 transition hover:-translate-y-0.5 ${t.ring}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`size-10 rounded-xl shrink-0 flex items-center justify-center text-white ${t.dot}`}
        >
          <Icon className="size-5" strokeWidth={2.25} aria-hidden />
        </div>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
