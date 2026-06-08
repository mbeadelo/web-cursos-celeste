import Link from "next/link";
import { auth } from "@/lib/auth";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { FeaturedCourses } from "@/components/featured-courses";
import { AboutMe } from "@/components/about-me";
import { getAllContent, pickContent } from "@/lib/site-content";

export default async function Home() {
  const [session, content] = await Promise.all([auth(), getAllContent()]);

  const heroBadge = pickContent(content, "home.hero.badge");
  const heroSubtitle = pickContent(content, "home.hero.subtitle");
  const aboutEyebrow = pickContent(content, "about.eyebrow");
  const aboutTitle = pickContent(content, "about.title");
  const aboutBody = pickContent(content, "about.body");
  const aboutImage = pickContent(content, "about.image");
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

          <div className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center space-y-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-icon.png"
              alt="Bienvenido a tu plaza"
              className="mx-auto h-28 md:h-36 w-auto"
            />
            <p className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-foreground/10 px-3 py-1 text-xs font-medium text-neutral-700">
              <span className="size-1.5 rounded-full bg-brand-celeste" />
              {heroBadge}
            </p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Bienvenido a{" "}
              <span className="bg-gradient-to-r from-brand-celeste to-brand-magenta bg-clip-text text-transparent">
                tu plaza
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-neutral-600 leading-relaxed">
              {heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                href="/cursos"
                className="rounded-full bg-brand-celeste text-brand-celeste-foreground px-6 py-3 font-medium hover:bg-brand-celeste-deep transition shadow-sm"
              >
                Ver cursos
              </Link>
              {session ? (
                <Link
                  href="/dashboard"
                  className="rounded-full border border-neutral-300 bg-white px-6 py-3 font-medium hover:border-brand-celeste hover:text-brand-celeste-deep transition"
                >
                  Ir a mis cursos
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full border border-neutral-300 bg-white px-6 py-3 font-medium hover:border-brand-celeste hover:text-brand-celeste-deep transition"
                >
                  Acceder
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
        <section className="max-w-6xl mx-auto px-6 py-20">
          <FeaturedCourses />
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
        <section className="max-w-5xl mx-auto px-6 py-20 space-y-10">
          <div className="text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-brand-magenta-deep font-semibold">
              Por qué esta plaza
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Aprender no tiene por qué ser un agobio
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Feature
              title="A tu ritmo"
              body="Las lecciones quedan grabadas. Las repites cuando quieras, las pausas cuando lo necesites."
            />
            <Feature
              title="Material práctico"
              body="PDFs, ejercicios y referencias para descargar y revisitar. Lo importante se queda contigo."
            />
            <Feature
              title="Acompañamiento real"
              body="No estás sola en esto. Pregunta cuando te atasques y resuelves dudas con la comunidad."
            />
          </div>
        </section>

        {/* ── CTA final ─────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <div className="rounded-2xl bg-gradient-to-br from-brand-celeste to-brand-magenta p-10 md:p-14 text-center text-white shadow-lg">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              ¿Empezamos?
            </h2>
            <p className="mt-3 text-white/90 leading-relaxed">
              Echa un vistazo al catálogo y elige por dónde empezar. Te
              esperamos en la plaza.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/cursos"
                className="rounded-full bg-white text-brand-celeste-deep px-6 py-3 font-semibold hover:bg-neutral-100 transition"
              >
                Ver todos los cursos
              </Link>
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-foreground/10 p-6 space-y-2 transition hover:ring-brand-celeste/40 hover:-translate-y-0.5">
      <div className="size-9 rounded-full bg-gradient-to-br from-brand-celeste to-brand-magenta" />
      <h3 className="font-semibold text-lg pt-2">{title}</h3>
      <p className="text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
