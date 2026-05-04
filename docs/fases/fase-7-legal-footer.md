# Fase 7 — Legal, footer y pulido admin

> **Objetivo**: dejar la web lista para abrirse al público desde un punto de vista legal y de UX. Documentos legales editables, footer compartido con enlaces obligatorios, y un pase de marca al admin.

> **Estado**: 🟡 Plantillas legales por defecto pendientes de **revisión por abogado** antes de pasar a producción real con KYC y modo live de Stripe.

## Documentos legales

### Modelo

```prisma
model LegalDocument {
  slug      String   @id  // "privacidad" | "terminos" | "cookies"
  title     String
  body      String   @db.Text
  updatedAt DateTime @updatedAt
}
```

Migración: `20260504171500_add_legal_document`.

### Patrón "default + override"

`src/lib/legal.ts` (server-only) define:
- `LEGAL_SLUGS` y `LEGAL_LABELS` para el catálogo fijo.
- `LEGAL_DEFAULTS` con plantillas HTML largas como punto de partida (~5-15 KB cada una).
- `getLegalDocument(slug)` que busca primero en DB; si no hay row, devuelve el default con `isDefault: true`.

Esto permite:
- Que el sitio funcione desde el día 1 con plantillas razonables.
- Que el admin sobrescriba via `/admin/legal/[slug]` con su propio texto (TipTap).
- Que el admin pueda volver al default con "Restaurar plantilla por defecto".

### Plantillas

Las plantillas cubren los puntos básicos para una web de cursos online en España:

**Privacidad** (RGPD):
- Responsable del tratamiento (placeholder TODO: NOMBRE DEL TITULAR + DNI/NIF + dirección).
- Datos recopilados (email, datos de pago via Stripe, IP, historial).
- Bases legales (ejecución de contrato, obligación legal, interés legítimo).
- Encargados (Stripe, Resend, Mux, Cloudflare, Vercel, Neon — todos con DPA).
- Transferencias internacionales (SCC + DPF para US providers).
- Retención.
- Derechos RGPD (acceso, rectificación, supresión, oposición, limitación, portabilidad, retirada del consentimiento).
- Reclamación a la AEPD.

**Términos**:
- Aceptación.
- Descripción del servicio.
- Cuenta y registro (cerrado, no autoregistro).
- Compra y pago (Stripe, IVA via Stripe Tax).
- Acceso al contenido (permanente, individual, intransferible).
- Uso aceptable y propiedad intelectual (con mención explícita de las marcas de agua de los vídeos).
- **Reembolsos**: redacción acorde al art. 103.m LGDCU — se renuncia al desistimiento al iniciar el consumo del contenido digital. Política expresa de "antes de iniciar el contenido sí, después no".
- Limitación de responsabilidad.
- Ley aplicable y jurisdicción (CIUDAD a rellenar).

**Cookies**:
- Solo cookies estrictamente necesarias (Auth.js CSRF + callback URL + session token).
- Sin analytics ni marketing actualmente. Si en el futuro se añaden, requerirán consentimiento.
- Cookies de terceros (Stripe en checkout, Mux al reproducir).

**TODO antes de producción**:
- Sustituir `NOMBRE DEL TITULAR`, `DNI/NIF`, `DIRECCIÓN COMPLETA`, `CIUDAD`, `contacto@bienvenidoatuplaza.com` por datos reales.
- Pasar por abogado (ideal). Mínimo, revisar con el equipo de Stripe Tax y el seguro de RC profesional si aplica.
- Si añades analytics (Plausible, GA, etc.), actualizar la política de cookies y añadir banner de consentimiento.

### Admin

`/admin/legal` lista los 3 documentos con estado (mostrando default vs editado) y enlace a editar. `/admin/legal/[slug]` es el editor con TipTap. Server actions `saveLegalDocument` y `resetLegalDocument` en `_actions.ts`.

### Público

`/legal/[slug]` con `generateStaticParams` para los 3 slugs conocidos. Render via `dangerouslySetInnerHTML` confiando en TipTap (admin-only) y los defaults.

Los slugs inválidos hacen `notFound()` (404).

Sitemap incluye los 3 legales con `priority: 0.3`.

## Footer compartido

Antes: la home tenía un footer minimal inline. Resto de páginas no tenían footer.

Ahora: `src/components/public-footer.tsx` con 3 columnas (brand + email contacto, Plataforma, Información legal con todos los slugs), barra de copyright con año dinámico y "Hecho en España con cuidado".

Aplicado a:
- `/`
- `/cursos`
- `/cursos/[slug]`
- `/articulos`
- `/articulos/[slug]`
- `/legal/[slug]`
- `/checkout/success`

Excluido a propósito de `/login` y `/dashboard` (flujos centrados, footer distrae).

## Admin polish

Cambios discretos al header admin:
- Logo dot con gradient `celeste→magenta` (en vez de neutro).
- Hover de los links nav en `brand-celeste-deep`.
- "Salir del admin" diferenciado (más tenue) — es un enlace de salida, no un nav principal.

Mantenidos:
- Tipografía y resto de paleta neutral. El admin es funcional, no de marca pública.
- Tablas, formularios, switches: shadcn neutral por ahora.

## Verificación

```powershell
pnpm dev
# Pruebas:
#  http://localhost:3000/legal/privacidad   → renderiza plantilla default con banner amber
#  http://localhost:3000/legal/terminos     → idem
#  http://localhost:3000/legal/cookies      → idem
#  http://localhost:3000/legal/inexistente  → 404
#  http://localhost:3000/sitemap.xml        → incluye los 3 /legal/*
```

Como admin:
- `/admin/legal` lista los 3 docs con badge "⚠ Mostrando plantilla por defecto".
- Click en "Editar" → ves la plantilla en el editor → modifica → guarda → recarga `/legal/[slug]` → ves tu versión.
- "Restaurar plantilla por defecto" borra el row → la siguiente carga muestra default de nuevo.

## Pendientes / TODOs antes de producción

1. **Revisar plantillas con abogado**. Esto NO sustituye asesoría legal.
2. **Sustituir placeholders** (NOMBRE, DNI, dirección, ciudad, teléfono opcional) en las 3 plantillas vía `/admin/legal`.
3. **Decidir política de reembolso** real. La plantilla de términos ofrece reembolso solo si no se ha accedido al contenido — es la opción más conservadora desde el punto de vista del proveedor pero puede dañar la confianza si no se comunica bien.
4. **Cookie banner**: si en el futuro se añaden analytics, instalar un banner (p. ej. CookieConsent o vanilla-cookieconsent). Mientras solo haya cookies estrictamente necesarias, no es obligatorio.
5. **DPA con Resend/Stripe/Mux/Cloudflare/Vercel/Neon**: todos tienen DPA estándar. Aceptar / firmar desde sus dashboards y archivar.
6. **Aviso legal completo**: las plantillas no incluyen un "aviso legal" formal con nombre/CIF/dirección que la LSSI exige para sitios comerciales en España. Añadirlo como parte de Términos o como sección separada.

## Commits

```
(pendiente)
```
