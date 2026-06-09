/**
 * Catalog of editable site copy. Defined here (without `server-only`) so client
 * components in /admin/contenido can read the metadata to render forms.
 *
 * - `text`  : single-line or short paragraph (rendered as plain text).
 * - `rich`  : HTML produced by the TipTap editor (rendered via dangerouslySetInnerHTML).
 * - `image` : a URL to an image (uploaded to R2 or pasted). Stored as a plain
 *             string just like `text`; the form renders an upload/preview widget.
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
  "home.hero.cta_primary": {
    type: "text",
    section: "Home — Hero",
    label: "Botón principal",
    hint: "Lleva al catálogo de cursos.",
    default: "Ver cursos",
  },
  "home.hero.cta_login": {
    type: "text",
    section: "Home — Hero",
    label: "Botón secundario (visitante)",
    hint: "Lo ven quienes no han iniciado sesión.",
    default: "Acceder",
  },
  "home.hero.cta_dashboard": {
    type: "text",
    section: "Home — Hero",
    label: "Botón secundario (con sesión)",
    hint: "Lo ven quienes ya han iniciado sesión.",
    default: "Ir a mis cursos",
  },
  "home.stats.s1.number": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 1 — número",
    hint: "Por ejemplo: 100+, 250, 1.2k.",
    default: "100+",
  },
  "home.stats.s1.label": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 1 — etiqueta",
    hint: "",
    default: "Alumnos formados",
  },
  "home.stats.s2.number": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 2 — número",
    hint: "",
    default: "6",
  },
  "home.stats.s2.label": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 2 — etiqueta",
    hint: "",
    default: "Cursos disponibles",
  },
  "home.stats.s3.number": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 3 — número",
    hint: "",
    default: "∞",
  },
  "home.stats.s3.label": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 3 — etiqueta",
    hint: "",
    default: "Acceso ilimitado",
  },
  "home.stats.s4.number": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 4 — número",
    hint: "",
    default: "24/7",
  },
  "home.stats.s4.label": {
    type: "text",
    section: "Home — Cifras",
    label: "Cifra 4 — etiqueta",
    hint: "",
    default: "A tu ritmo",
  },
  "home.featured.title": {
    type: "text",
    section: "Home — Cursos destacados",
    label: "Título",
    hint: "",
    default: "Cursos destacados",
  },
  "home.featured.subtitle": {
    type: "text",
    section: "Home — Cursos destacados",
    label: "Subtítulo",
    hint: "",
    default: "Lo más buscado por la comunidad. Desliza para ver más.",
  },

  "about.image": {
    type: "image",
    section: "Sobre mí",
    label: "Foto / retrato",
    hint: "Se muestra en redondo. Idealmente cuadrada (1:1) y de al menos 400×400 px.",
    default: "/demo/portrait.jpg",
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

  // ─── Home — Por qué esta plaza ───
  "home.why.eyebrow": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Etiqueta superior",
    hint: "Texto pequeño en mayúsculas.",
    default: "Por qué esta plaza",
  },
  "home.why.title": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Título de la sección",
    hint: "",
    default: "Aprender no tiene por qué ser un agobio",
  },
  "home.why.f1.title": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 1 — título",
    hint: "",
    default: "A tu ritmo",
  },
  "home.why.f1.body": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 1 — texto",
    hint: "",
    default:
      "Las lecciones quedan grabadas. Las repites cuando quieras, las pausas cuando lo necesites.",
  },
  "home.why.f2.title": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 2 — título",
    hint: "",
    default: "Material práctico",
  },
  "home.why.f2.body": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 2 — texto",
    hint: "",
    default:
      "PDFs, ejercicios y referencias para descargar y revisitar. Lo importante se queda contigo.",
  },
  "home.why.f3.title": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 3 — título",
    hint: "",
    default: "Acompañamiento real",
  },
  "home.why.f3.body": {
    type: "text",
    section: "Home — Por qué esta plaza",
    label: "Bloque 3 — texto",
    hint: "",
    default:
      "No estás sola en esto. Pregunta cuando te atasques y resuelves dudas con la comunidad.",
  },

  // ─── Home — CTA final ───
  "home.cta.title": {
    type: "text",
    section: "Home — CTA final",
    label: "Título",
    hint: "",
    default: "¿Empezamos?",
  },
  "home.cta.body": {
    type: "text",
    section: "Home — CTA final",
    label: "Texto",
    hint: "",
    default:
      "Echa un vistazo al catálogo y elige por dónde empezar. Te esperamos en la plaza.",
  },
  "home.cta.button": {
    type: "text",
    section: "Home — CTA final",
    label: "Botón",
    hint: "Lleva al catálogo de cursos.",
    default: "Ver todos los cursos",
  },

  // ─── Email — Bienvenida tras compra ───
  // Estas claves se inyectan en src/lib/email.ts → sendPurchaseWelcomeEmail.
  // Soportan placeholders entre llaves dobles: {{courseTitle}}, {{loginUrl}}.
  // El admin los ve en el hint para que pueda usarlos en su redacción.
  "email.purchase.subject": {
    type: "text",
    section: "Email — Bienvenida tras compra",
    label: "Asunto del email",
    hint: 'Placeholders: {{courseTitle}}.',
    default: "Tu acceso a {{courseTitle}} está listo",
  },
  "email.purchase.body_new": {
    type: "rich",
    section: "Email — Bienvenida tras compra",
    label: "Mensaje (alumno nuevo, primera compra)",
    hint:
      "Lo verán quienes compran por primera vez. Placeholders disponibles: {{courseTitle}}, {{loginUrl}}.",
    default:
      `<p>Acabamos de procesar tu compra de <strong>{{courseTitle}}</strong>. Tu cuenta está creada y lista.</p>` +
      `<p>Para entrar al curso, accede a <a href="{{loginUrl}}">{{loginUrl}}</a> con este mismo email y recibirás un enlace de un solo uso.</p>` +
      `<p>Tu acceso es permanente. Puedes ver el curso cuando quieras desde tu panel.</p>`,
  },
  "email.purchase.body_existing": {
    type: "rich",
    section: "Email — Bienvenida tras compra",
    label: "Mensaje (alumno que ya tenía cuenta)",
    hint:
      "Lo verán quienes ya tenían cuenta antes. Placeholders disponibles: {{courseTitle}}, {{loginUrl}}.",
    default:
      `<p>Acabamos de añadir <strong>{{courseTitle}}</strong> a tu cuenta.</p>` +
      `<p>Entra en <a href="{{loginUrl}}">{{loginUrl}}</a> con este mismo email para acceder al curso.</p>`,
  },
  "email.purchase.cta_label": {
    type: "text",
    section: "Email — Bienvenida tras compra",
    label: "Texto del botón",
    hint: "Botón principal del email. Apunta siempre a la página de acceso.",
    default: "Acceder ahora",
  },
} as const satisfies Record<
  string,
  {
    type: "text" | "rich" | "image";
    section: string;
    label: string;
    hint: string;
    default: string;
  }
>;

export type SiteContentKey = keyof typeof SITE_CONTENT_KEYS;
