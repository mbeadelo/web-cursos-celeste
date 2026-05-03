import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Bienvenido a tu plaza · Docs",
  description: "Documentación técnica del proyecto: stack, arquitectura, herramientas y bitácora de fases.",
  lang: "es",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: "localhostLinks",

  themeConfig: {
    outline: { level: [2, 3], label: "En esta página" },

    nav: [
      { text: "Inicio", link: "/" },
      { text: "Arquitectura", link: "/arquitectura" },
      { text: "Herramientas", link: "/herramientas/" },
      { text: "Decisiones", link: "/decisiones" },
      { text: "Operativa", link: "/operativa" },
      {
        text: "Fases",
        items: [
          { text: "Fase 0 — Setup", link: "/fases/fase-0-setup" },
          { text: "Fase 1 — Auth", link: "/fases/fase-1-auth" },
        ],
      },
    ],

    sidebar: {
      "/": [
        { text: "Inicio", link: "/" },
        { text: "Arquitectura", link: "/arquitectura" },
        { text: "Operativa", link: "/operativa" },
        { text: "Decisiones", link: "/decisiones" },
      ],
      "/herramientas/": [
        {
          text: "Herramientas",
          items: [
            { text: "Visión general", link: "/herramientas/" },
            { text: "Next.js", link: "/herramientas/nextjs" },
            { text: "TypeScript", link: "/herramientas/typescript" },
            { text: "Tailwind CSS", link: "/herramientas/tailwind" },
            { text: "shadcn/ui", link: "/herramientas/shadcn" },
            { text: "Zod", link: "/herramientas/zod" },
            { text: "Prisma", link: "/herramientas/prisma" },
            { text: "PostgreSQL", link: "/herramientas/postgresql" },
            { text: "Neon", link: "/herramientas/neon" },
            { text: "Auth.js", link: "/herramientas/authjs" },
            { text: "Stripe", link: "/herramientas/stripe" },
            { text: "Mux", link: "/herramientas/mux" },
            { text: "Cloudflare R2", link: "/herramientas/cloudflare-r2" },
            { text: "Resend", link: "/herramientas/resend" },
            { text: "Vercel", link: "/herramientas/vercel" },
            { text: "Sentry", link: "/herramientas/sentry" },
            { text: "Volta", link: "/herramientas/volta" },
            { text: "pnpm", link: "/herramientas/pnpm" },
            { text: "Bitwarden", link: "/herramientas/bitwarden" },
          ],
        },
      ],
      "/fases/": [
        {
          text: "Fases",
          items: [
            { text: "Fase 0 — Setup", link: "/fases/fase-0-setup" },
            { text: "Fase 1 — Auth", link: "/fases/fase-1-auth" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/mbeadelo/web-cursos-celeste" },
    ],

    search: { provider: "local" },

    footer: {
      message: "Documentación interna · Bienvenido a tu plaza",
      copyright: "© Bienvenido a tu plaza",
    },
  },
});
