/**
 * Catalog of editable site copy. Defined here (without `server-only`) so client
 * components in /admin/contenido can read the metadata to render forms.
 *
 * - `text` : single-line or short paragraph (rendered as plain text).
 * - `rich` : HTML produced by the TipTap editor (rendered via dangerouslySetInnerHTML).
 *
 * `default` is what users see if no row exists in `SiteContent` for the key.
 */
export const SITE_CONTENT_KEYS = {
  "home.hero.badge": {
    type: "text",
    section: "Home — Hero",
    label: "Badge sobre el titular",
    hint: "Texto pequeño con un punto azul, encima del titular.",
    default: "Cursos online · Acceso permanente",
  },
  "home.hero.subtitle": {
    type: "text",
    section: "Home — Hero",
    label: "Subtítulo",
    hint: "Frase debajo del titular.",
    default:
      "Aprende a tu ritmo con cursos grabados, material descargable y acompañamiento real. Sin prisa, sin agobios, a tu manera.",
  },
  "about.eyebrow": {
    type: "text",
    section: "Sobre mí",
    label: "Etiqueta superior",
    hint: "Texto pequeño en mayúsculas.",
    default: "Sobre mí",
  },
  "about.title": {
    type: "text",
    section: "Sobre mí",
    label: "Título de la sección",
    hint: "",
    default: "Hola, soy quien está detrás de tu plaza",
  },
  "about.body": {
    type: "rich",
    section: "Sobre mí",
    label: "Cuerpo",
    hint: "Tu bio. Usa la barra para formato.",
    default: `<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Llevo años enseñando lo que sé y guiando a alumnas y alumnos a su propio ritmo. Empecé compartiendo apuntes sueltos y, sin darme cuenta, terminé montando una pequeña comunidad que crecía con cada nueva pregunta.</p><p>Mauris aliquet, lectus eu pulvinar tincidunt, mi sapien efficitur ipsum. Hoy, esta plaza es el sitio donde reúno todo lo que he ido aprendiendo y donde puedes acceder a los cursos cuando y como quieras. Material práctico, lecciones grabadas y respuestas reales cuando te atascas.</p><p>Pellentesque habitant morbi tristique senectus et netus. Si quieres empezar por algún sitio, te recomiendo darte una vuelta por el catálogo y ver qué encaja contigo.</p>`,
  },
} as const satisfies Record<
  string,
  {
    type: "text" | "rich";
    section: string;
    label: string;
    hint: string;
    default: string;
  }
>;

export type SiteContentKey = keyof typeof SITE_CONTENT_KEYS;
