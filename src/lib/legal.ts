import "server-only";
import { db } from "@/lib/db";

/**
 * Fixed catalog of legal documents the public site exposes. Add a new entry
 * here + a default below to expose `/legal/<slug>` and an editor row in
 * `/admin/legal`.
 */
export const LEGAL_SLUGS = ["privacidad", "terminos", "cookies"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export const LEGAL_LABELS: Record<LegalSlug, string> = {
  privacidad: "Política de privacidad",
  terminos: "Términos y condiciones",
  cookies: "Política de cookies",
};

export type LegalDocumentView = {
  slug: LegalSlug;
  title: string;
  body: string;
  updatedAt: Date | null;
  isDefault: boolean;
};

/**
 * Read a legal document by slug. If no row exists in `LegalDocument`, returns
 * the default template (clearly marked as draft so the admin knows to edit).
 */
export async function getLegalDocument(
  slug: LegalSlug
): Promise<LegalDocumentView> {
  const row = await db.legalDocument.findUnique({ where: { slug } });
  if (row) {
    return {
      slug,
      title: row.title,
      body: row.body,
      updatedAt: row.updatedAt,
      isDefault: false,
    };
  }
  return {
    slug,
    title: LEGAL_LABELS[slug],
    body: LEGAL_DEFAULTS[slug],
    updatedAt: null,
    isDefault: true,
  };
}

export async function getAllLegalDocuments(): Promise<LegalDocumentView[]> {
  return Promise.all(LEGAL_SLUGS.map((s) => getLegalDocument(s)));
}

// ──────────────────────────────────────────────────────────────────
// Default templates. These are reasonable starting points for an MVP
// in Spain/EU but **MUST be reviewed by a lawyer** before going live
// with real customers. They contain placeholders (TODO:) the admin
// has to replace.
// ──────────────────────────────────────────────────────────────────

const DRAFT_DISCLAIMER = `<p style="border-left:3px solid #d97706;background:#fef3c7;padding:12px 16px;border-radius:6px;margin:0 0 24px"><strong>Plantilla pendiente de revisión legal.</strong> Este texto es un punto de partida razonable para una web de cursos online en España. Sustituye los datos en MAYÚSCULAS, completa las lagunas y revísalo con un abogado antes de publicarlo o lanzar a producción.</p>`;

const PRIVACIDAD_DEFAULT = `${DRAFT_DISCLAIMER}
<h2>Quién es el responsable</h2>
<p>El responsable del tratamiento de tus datos personales es <strong>NOMBRE DEL TITULAR</strong> (DNI/NIF: <strong>XXXXXXXX</strong>), con domicilio en <strong>DIRECCIÓN COMPLETA</strong> y email de contacto <strong>contacto@bienvenidoatuplaza.com</strong>.</p>

<h2>Qué datos recopilamos y para qué</h2>
<p>Recopilamos solo los datos imprescindibles para prestar el servicio:</p>
<ul>
  <li><strong>Email</strong>: para crear tu cuenta, enviarte el enlace de acceso (magic link), notificaciones del servicio y comunicaciones relacionadas con tu compra.</li>
  <li><strong>Datos de pago</strong>: gestionados directamente por Stripe Payments Europe Ltd. No almacenamos números de tarjeta en nuestros sistemas.</li>
  <li><strong>Dirección IP y datos de navegación básicos</strong>: para seguridad y prevención de fraude, además de para mostrar marcas de agua en los vídeos del curso.</li>
  <li><strong>Historial de cursos comprados y consumidos</strong>: para gestionar tu acceso al contenido.</li>
</ul>

<h2>Base legal del tratamiento</h2>
<p>Tratamos tus datos en base a las siguientes bases jurídicas (RGPD art. 6):</p>
<ul>
  <li><strong>Ejecución del contrato</strong> (art. 6.1.b): para la creación de la cuenta, la entrega del curso y la facturación.</li>
  <li><strong>Obligación legal</strong> (art. 6.1.c): para conservar facturas durante los plazos exigidos por Hacienda (4-6 años).</li>
  <li><strong>Interés legítimo</strong> (art. 6.1.f): para prevenir fraude y proteger nuestros derechos de propiedad intelectual.</li>
</ul>

<h2>Con quién compartimos tus datos</h2>
<p>Para prestar el servicio empleamos los siguientes encargados de tratamiento (todos con acuerdo DPA firmado):</p>
<ul>
  <li><strong>Stripe</strong> (Stripe Payments Europe Ltd., Irlanda) — procesamiento de pagos.</li>
  <li><strong>Resend</strong> (Resend Inc., EE. UU.) — envío de emails transaccionales.</li>
  <li><strong>Mux</strong> (Mux Inc., EE. UU.) — alojamiento y reproducción de vídeo.</li>
  <li><strong>Cloudflare</strong> (Cloudflare Inc., EE. UU.) — almacenamiento de archivos (R2) y red de distribución.</li>
  <li><strong>Vercel</strong> (Vercel Inc., EE. UU.) — alojamiento de la aplicación web.</li>
  <li><strong>Neon</strong> (Neon Inc., EE. UU.) — base de datos.</li>
</ul>
<p>Las transferencias internacionales a EE. UU. se amparan en las cláusulas contractuales tipo (SCC) aprobadas por la Comisión Europea y, en el caso de proveedores certificados, en el Marco de Privacidad de Datos UE-EE. UU. (DPF).</p>

<h2>Cuánto tiempo conservamos tus datos</h2>
<p>Conservaremos tus datos personales mientras mantengas tu cuenta activa. Si solicitas la baja, se borrarán salvo:</p>
<ul>
  <li>Datos de facturación: durante los plazos legales (mínimo 4 años por la legislación tributaria española).</li>
  <li>Datos necesarios para defender posibles reclamaciones legales.</li>
</ul>

<h2>Tus derechos</h2>
<p>Puedes ejercer en cualquier momento los derechos que el RGPD te reconoce:</p>
<ul>
  <li>Acceso, rectificación y supresión.</li>
  <li>Oposición y limitación del tratamiento.</li>
  <li>Portabilidad.</li>
  <li>Retirar el consentimiento (cuando aplique).</li>
</ul>
<p>Para ejercerlos, escríbenos a <strong>contacto@bienvenidoatuplaza.com</strong> con copia de tu DNI o documento equivalente. Tienes también derecho a presentar una reclamación ante la <strong>Agencia Española de Protección de Datos</strong> (<a href="https://www.aepd.es" rel="noopener noreferrer" target="_blank">aepd.es</a>) si crees que tu tratamiento no es conforme a la normativa.</p>

<h2>Cookies</h2>
<p>Consulta nuestra <a href="/legal/cookies">política de cookies</a> para más detalles sobre las cookies que utilizamos.</p>

<h2>Cambios en esta política</h2>
<p>Podemos actualizar esta política cuando lo consideremos necesario. Si los cambios son sustanciales te avisaremos por email. La fecha de última actualización aparece al pie de esta página.</p>`;

const TERMINOS_DEFAULT = `${DRAFT_DISCLAIMER}
<h2>Aceptación de los términos</h2>
<p>Al comprar un curso o crear una cuenta en Bienvenido a tu plaza aceptas íntegramente estos términos. Si no estás de acuerdo, no utilices el servicio.</p>

<h2>Descripción del servicio</h2>
<p>Bienvenido a tu plaza es una plataforma de cursos online en formato vídeo, PDF y texto, accesibles tras la compra del curso correspondiente. El acceso es individual e intransferible.</p>

<h2>Cuenta y registro</h2>
<p>Las cuentas se crean automáticamente al completar la compra de un curso o cuando el administrador da acceso manualmente. <strong>No se permite el autoregistro</strong>. La cuenta queda asociada al email facilitado en el momento del pago.</p>
<p>Eres responsable de mantener la confidencialidad de tu cuenta y de toda la actividad que ocurra bajo ella. Notifícanos inmediatamente cualquier uso no autorizado.</p>

<h2>Compra y pago</h2>
<p>Los precios se muestran en euros (EUR) e incluyen el IVA aplicable según tu localización (gestionado automáticamente por Stripe Tax). El pago se realiza a través de Stripe; no almacenamos datos de tarjeta. Tras el cobro, recibirás una factura por email.</p>

<h2>Acceso al contenido</h2>
<p>Tras la compra obtienes acceso permanente al curso adquirido, salvo en caso de reembolso o cierre voluntario de la plataforma. El contenido se entrega en formato digital, accesible desde tu cuenta.</p>

<h2>Uso aceptable y propiedad intelectual</h2>
<p>Todo el contenido (vídeos, textos, PDFs, ejercicios) está protegido por derechos de autor y es propiedad del titular. Al comprar un curso obtienes una <strong>licencia personal, no exclusiva, no transferible y no sublicenciable</strong> para acceder al contenido para uso personal y no comercial.</p>
<p>Queda expresamente prohibido:</p>
<ul>
  <li>Compartir tu cuenta con terceros.</li>
  <li>Descargar, redistribuir, retransmitir o vender el contenido.</li>
  <li>Eliminar las marcas de agua, modificar el contenido o realizar ingeniería inversa.</li>
  <li>Cualquier uso comercial o académico-institucional sin autorización expresa.</li>
</ul>
<p>Los vídeos llevan marcas de agua personalizadas (email + dirección IP del alumno) para disuadir la difusión no autorizada. La distribución del material puede dar lugar a reclamaciones civiles y penales.</p>

<h2>Reembolsos</h2>
<p>El derecho de desistimiento del consumidor (14 días) <strong>queda renunciado expresamente</strong> al confirmar el inicio del consumo del contenido digital, conforme al art. 103.m de la Ley General para la Defensa de Consumidores y Usuarios. Esto significa que <strong>una vez accedido el contenido, no procede el reembolso</strong>.</p>
<p>Si no has accedido a ningún material del curso, puedes solicitar el reembolso enviando un email a <strong>contacto@bienvenidoatuplaza.com</strong> dentro de los 14 días siguientes a la compra.</p>

<h2>Limitación de responsabilidad</h2>
<p>El servicio se presta "tal cual". Hacemos esfuerzos razonables para mantener la plataforma disponible y los contenidos correctos, pero no garantizamos resultados específicos derivados del aprendizaje del curso. La responsabilidad máxima por cualquier reclamación se limita al importe pagado por el curso afectado.</p>

<h2>Modificaciones</h2>
<p>Nos reservamos el derecho a modificar estos términos. Los cambios sustanciales se notificarán por email con al menos 15 días de antelación.</p>

<h2>Ley aplicable y jurisdicción</h2>
<p>Estos términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de <strong>CIUDAD</strong>, con renuncia expresa a cualquier otro fuero que pudiera corresponder.</p>

<h2>Contacto</h2>
<p>Para cualquier consulta sobre estos términos, escríbenos a <strong>contacto@bienvenidoatuplaza.com</strong>.</p>`;

const COOKIES_DEFAULT = `${DRAFT_DISCLAIMER}
<h2>Qué son las cookies</h2>
<p>Las cookies son pequeños archivos que un sitio web guarda en tu navegador para recordar información entre visitas. Pueden ser <em>estrictamente necesarias</em> (sin las cuales el sitio no funciona) o <em>opcionales</em> (analítica, marketing, etc.).</p>

<h2>Qué cookies usamos</h2>
<h3>Cookies estrictamente necesarias</h3>
<p>Las únicas cookies que utilizamos son las imprescindibles para el funcionamiento del sitio. No requieren tu consentimiento por ser técnicas (RGPD/LSSI):</p>
<ul>
  <li><code>__Host-authjs.csrf-token</code> — protege los formularios de login frente a ataques CSRF.</li>
  <li><code>__Secure-authjs.callback-url</code> — recuerda a dónde ibas antes de loguearte.</li>
  <li><code>__Secure-authjs.session-token</code> — mantiene tu sesión iniciada.</li>
</ul>

<h3>Cookies analíticas</h3>
<p>Actualmente <strong>no usamos cookies analíticas</strong> ni de marketing. Si en el futuro las añadimos (por ejemplo, Plausible, Google Analytics), actualizaremos esta página y te pediremos consentimiento explícito antes de instalarlas.</p>

<h3>Cookies de terceros</h3>
<p>Cuando completas un pago, te redirigimos a Stripe. Stripe puede instalar sus propias cookies, gobernadas por su <a href="https://stripe.com/privacy" rel="noopener noreferrer" target="_blank">política de privacidad</a>. Lo mismo ocurre con Mux al reproducir vídeos.</p>

<h2>Cómo gestionar las cookies</h2>
<p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador. Ten en cuenta que si bloqueas las cookies estrictamente necesarias, no podrás iniciar sesión ni acceder a tus cursos.</p>

<h2>Más información</h2>
<p>Si tienes dudas, escríbenos a <strong>contacto@bienvenidoatuplaza.com</strong>. Para más información sobre el tratamiento de tus datos personales, consulta nuestra <a href="/legal/privacidad">política de privacidad</a>.</p>`;

const LEGAL_DEFAULTS: Record<LegalSlug, string> = {
  privacidad: PRIVACIDAD_DEFAULT,
  terminos: TERMINOS_DEFAULT,
  cookies: COOKIES_DEFAULT,
};
