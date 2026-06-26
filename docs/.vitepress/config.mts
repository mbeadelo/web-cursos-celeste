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
      { text: "Lanzamiento", link: "/operaciones/" },
      {
        text: "Fases",
        items: [
          { text: "Fase 0 — Setup", link: "/fases/fase-0-setup" },
          { text: "Fase 1 — Auth", link: "/fases/fase-1-auth" },
          { text: "Fase 2a — Courses CRUD", link: "/fases/fase-2a-courses" },
          { text: "Fase 2b — R2 uploads", link: "/fases/fase-2b-r2-uploads" },
          { text: "Fase 2c — Lessons", link: "/fases/fase-2c-lessons" },
          { text: "Fase 2d — Superficie pública", link: "/fases/fase-2d-superficie-publica" },
          { text: "Fase 3 — Flujo del alumno", link: "/fases/fase-3-alumno-flow" },
          { text: "Fase 4 — Blog + CMS-light", link: "/fases/fase-4-blog-cms" },
          { text: "Fase 5 — Stripe", link: "/fases/fase-5-stripe" },
          { text: "Fase 6 — Mux + uploads", link: "/fases/fase-6-mux-uploads" },
          { text: "Fase 7 — Legal + footer", link: "/fases/fase-7-legal-footer" },
          {
            text: "Fase 8 — Polish, seguridad y retención",
            link: "/fases/fase-8-polish-seguridad-retencion",
          },
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
      "/operaciones/": [
        {
          text: "Lanzamiento (jun 2026)",
          items: [
            { text: "Visión general / bitácora", link: "/operaciones/" },
            { text: "Migración del dominio", link: "/operaciones/migracion-dominio" },
            { text: "Auditoría de seguridad #2", link: "/operaciones/auditoria-seguridad-2" },
            { text: "Sentry", link: "/herramientas/sentry" },
          ],
        },
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
            { text: "Upstash Redis", link: "/herramientas/upstash" },
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
            { text: "Fase 2a — Courses CRUD", link: "/fases/fase-2a-courses" },
            { text: "Fase 2b — R2 uploads", link: "/fases/fase-2b-r2-uploads" },
            { text: "Fase 2c — Lessons", link: "/fases/fase-2c-lessons" },
            { text: "Fase 2d — Superficie pública", link: "/fases/fase-2d-superficie-publica" },
          { text: "Fase 3 — Flujo del alumno", link: "/fases/fase-3-alumno-flow" },
          { text: "Fase 4 — Blog + CMS-light", link: "/fases/fase-4-blog-cms" },
          { text: "Fase 5 — Stripe", link: "/fases/fase-5-stripe" },
          { text: "Fase 6 — Mux + uploads", link: "/fases/fase-6-mux-uploads" },
          { text: "Fase 7 — Legal + footer", link: "/fases/fase-7-legal-footer" },
          {
            text: "Fase 8 — Polish, seguridad y retención",
            link: "/fases/fase-8-polish-seguridad-retencion",
          },
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
