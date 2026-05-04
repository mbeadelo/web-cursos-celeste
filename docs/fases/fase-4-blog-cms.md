# Fase 4 — Blog + CMS-light

> **Objetivo**: añadir un blog para SEO/captación y un editor para que el admin pueda cambiar textos de la web sin tocar código.

> **Estado**: ✅ Completada (2026-05-04 sesión 3, post Fase 3).

## Por qué juntas

Compartían el editor TipTap. Hacerlas en bloques separados implicaba meterlo dos veces y reescribir parte del UI. Costo combinado: ~1 sesión.

## Modelos nuevos (Prisma)

```prisma
model Article {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  excerpt     String    @db.Text
  body        String    @db.Text         // HTML producido por TipTap
  coverUrl    String?
  published   Boolean   @default(false)
  publishedAt DateTime?
  authorId    String?
  author      User?     @relation(...)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([published, publishedAt])
}

model SiteContent {
  key       String   @id        // ej. "home.hero.subtitle"
  value     String   @db.Text
  updatedAt DateTime @updatedAt
}
```

Migración: `20260504161340_add_article_and_site_content`.

## Editor: TipTap

| Paquete | Versión | Para |
|---|---|---|
| `@tiptap/react` | 3.x | API React del editor |
| `@tiptap/pm` | 3.x | ProseMirror (peer) |
| `@tiptap/starter-kit` | 3.x | nodos básicos (P, H, listas, blockquote, bold, italic) |
| `@tiptap/extension-link` | 3.x | enlaces con `rel="noopener noreferrer nofollow"` y `target="_blank"` |
| `@tiptap/extension-placeholder` | 3.x | placeholder cuando el editor está vacío |
| `@tailwindcss/typography` | 0.5.x | clase `prose` para renderizar el HTML resultante |

Componente: `src/components/rich-editor.tsx` (cliente). Toolbar con bold, itálica, H2/H3, listas (•/1.), blockquote, link, undo/redo. Output: HTML.

### Por qué HTML y no JSON

TipTap puede emitir JSON estructurado (más robusto, soporta migraciones de schema). HTML es más simple para el render server-side: `dangerouslySetInnerHTML` directo. Para volúmenes pequeños y un solo editor (admin), HTML es suficiente y evita el overhead de cargar TipTap server-side solo para render.

### Seguridad del HTML

TipTap con starter-kit + link **no permite** `<script>`, `<iframe>`, ni atributos de evento (`onclick`, etc.) — el schema lo bloquea en el parser. Solo el admin (autenticado y role-gated) escribe artículos. Por tanto **no sanitizamos al guardar**: confiamos en el schema del editor. Si en el futuro se acepta input de no-admin, hay que añadir DOMPurify o sanitize-html.

## Articles CRUD

```
src/lib/validations/article.ts                ArticleInputSchema (zod)
src/app/admin/articulos/_actions.ts           create/update/togglePublish/delete
src/app/admin/articulos/_form.tsx             Form con RichEditor
src/app/admin/articulos/_row-actions.tsx      Switch de publicar + Borrar
src/app/admin/articulos/page.tsx              Listado
src/app/admin/articulos/new/page.tsx          Crear
src/app/admin/articulos/[id]/page.tsx         Editar
```

`publishedAt` se setea en el primer publish y se preserva al guardar después; al despublicar vuelve a `null`. Esto evita que la fecha de publicación cambie cuando el admin edita un artículo ya publicado.

### Reuso del CoverUpload

Reutilizo `CoverUpload` de `/admin/courses/_cover-upload.tsx` (mismo flujo: signed PUT a R2, sube imagen y guarda URL). Las covers de artículos van al mismo bucket público con prefijo `covers/` — coexisten sin conflicto.

## Páginas públicas

```
src/app/articulos/page.tsx           Lista con header "Aprende, lee, vuelve."
src/app/articulos/[slug]/page.tsx    Detalle con prose + JSON-LD + OG
```

Detalle:
- `prose prose-neutral max-w-none` con accents de marca en links (`prose-a:text-brand-celeste-deep`).
- **JSON-LD schema.org/Article** inline para rich results de Google.
- **Open Graph** + Twitter Card metadata generados desde `generateMetadata`.

## CMS-light: SiteContent

### Catálogo

`src/lib/site-content-keys.ts` define qué claves son editables y su tipo (`text` o `rich`):

```ts
"home.hero.badge":   { type: "text", default: "Cursos online · Acceso permanente" }
"home.hero.subtitle": { type: "text", default: "Aprende a tu ritmo..." }
"about.eyebrow":     { type: "text", default: "Sobre mí" }
"about.title":       { type: "text", default: "Hola, soy quien está detrás..." }
"about.body":        { type: "rich", default: "<p>Lorem ipsum...</p>" }
```

Para añadir nuevas claves: edita ese fichero, añade la entrada con default + label, y en el componente que la use llama `pickContent(content, "tu.clave")`.

### Lectura desde la home

`src/lib/site-content.ts`:
- `getAllContent()` — query única cacheada per-request via `cache()` de React. Devuelve `Map<key, value>`.
- `pickContent(map, key)` — sync, con fallback al default.

`src/app/page.tsx` carga `getAllContent()` en paralelo con `auth()` y pasa los valores a `<AboutMe />` por props. Una sola query por request, todos los textos resueltos.

### Separación cliente / servidor

**Importante**: `site-content.ts` tiene `import "server-only"` y usa Prisma. **No** importarlo desde client components. El catálogo (constante pura sin DB) vive en `site-content-keys.ts` separado para que el form de admin (`"use client"`) pueda leer el metadata sin romper el bundle.

Patrón a seguir cuando quieras compartir constantes entre server y client:
- Constante o tipos puros → archivo sin `server-only`.
- Lógica que toca DB / `auth()` → archivo separado con `server-only`.

### Admin

`/admin/contenido` lista cada clave editable agrupada por sección. Por clave:
- `text` corto → `Input`.
- `text` largo (>80 chars en el valor actual) → `Textarea`.
- `rich` → `RichEditor`.

Botón "Resetear" por clave que borra el row de `SiteContent` → vuelve al default. Útil si te arrepientes de un cambio.

Submit: server action `saveSiteContent` upserta solo claves con valor non-empty. Devuelve `{ updated: N }` para feedback.

## SEO

### sitemap.xml

`src/app/sitemap.ts` usa `MetadataRoute.Sitemap` de Next.js. Incluye:
- Rutas estáticas (/, /cursos, /articulos) con priority alta.
- Cada curso publicado (`/cursos/[slug]`).
- Cada artículo publicado (`/articulos/[slug]`).

Base URL hardcoded a `https://bienvenidoatuplaza.com` — la URL canónica que Google indexará. Mientras el dominio no apunte a Vercel, los URLs en el sitemap dan 404, pero como tampoco está en Search Console todavía, no pasa nada.

### robots.txt

`src/app/robots.ts`:
- Permite `/` por defecto.
- Bloquea `/admin`, `/dashboard`, `/api/`, `/login` (estas no aportan a SEO y exponer "/login" puede generar enumeración).
- Apunta al `sitemap.xml` y `host` canónico.

### JSON-LD Article

Inline `<script type="application/ld+json">` en `/articulos/[slug]` con schema.org/Article: headline, description, image, dates, author, publisher. Permite a Google generar fragmentos enriquecidos.

## Gotchas

1. **Singleton de Prisma cacheado**: tras `prisma migrate dev` + `prisma generate`, **el dev server hay que reiniciarlo**. El `db` de `lib/db.ts` está cacheado en `globalThis` y conserva el cliente generado al boot. Si no reinicias, `db.article.findMany` será `undefined` y dará TypeError 500.
2. **Server-only en bundle de cliente**: importar de `site-content.ts` desde un client component bundla Prisma para el navegador → error en runtime sobre `node:module`. Solución: archivo separado para constantes.
3. **`prisma format` con --schema explícito**: en Windows PowerShell la ruta `prisma/schema.prisma` no resuelve por algún motivo (posible parsing del `=`). Pero `prisma migrate dev` lee correctamente desde `prisma.config.ts`. Si necesitas formatear, hazlo desde un editor con extensión Prisma.
4. **Campo `publishedAt` y orden**: si quieres ordenar artículos por fecha de publicación con borradores al final, `orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]` con NULLS al final es el comportamiento de Postgres por defecto.

## Pendientes inmediatos

- **OG images dinámicas**: hoy usa la `coverUrl` del artículo. Para artículos sin cover, generar OG dinámicamente con `next/og` (ImageResponse) que pinte el título sobre fondo gradient celeste/magenta.
- **Reading time** en cards y detalle (estimar a partir de `body.length`).
- **Más claves editables** según vaya saliendo. Stats numbers, features de "Por qué esta plaza", footer copy, etc.
- **Sanitización en saveSiteContent** si en el futuro hay autores no-admin.
- **Vista preview** en admin antes de publicar (útil para artículos largos).
- **Admin pulido** — el panel sigue con shadcn neutral. Repintar con marca cuando toque.

## Commits

```
(pendiente — junto con superficie pública + R2 + flujo alumno)
```
