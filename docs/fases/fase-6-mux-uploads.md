# Fase 6 — Mux (vídeo + watermarks) y subida de PDFs

> **Objetivo**: cerrar la entrega de contenido. Vídeo via Mux con watermark client-side; PDFs de lección subidos directos a R2 desde el admin.

> **Estado**: 🟡 Código completo y degradado correctamente sin claves. Pendiente que el usuario active la cuenta Mux y meta las claves para activarlo.

## Por qué este orden

Stripe (Fase 5) cerró el canal de monetización; Mux cierra el canal de **entrega**. Sin Mux, los cursos VIDEO solo muestran un placeholder. Con Mux + PDFs subibles, el admin puede crear cursos completos sin tocar la base de datos a mano.

## Mux

### Schema

Añadido a `Lesson`:

```prisma
muxUploadId   String?    @unique  // referencia a la Direct Upload de Mux
muxAssetId    String?              // se rellena en webhook video.upload.asset_created
muxPlaybackId String?              // se rellena en webhook video.asset.ready
```

Migración: `20260504170000_add_mux_upload_id`.

### Flujo

```
Admin en /admin/courses/[id] · diálogo de lección · type=VIDEO
        │
        ▼ click "Subir vídeo"
POST /api/mux/upload-url { lessonId }
   ├─ ensureAdmin()
   ├─ Mux.video.uploads.create({
   │     cors_origin,
   │     new_asset_settings: {
   │       playback_policies: ["public"],
   │       passthrough: lessonId    // viaja en los webhooks
   │     }
   │   })
   ├─ guarda upload.id en Lesson.muxUploadId
   └─ devuelve { uploadUrl, uploadId }
        │
        ▼ navegador PUT file → upload.url
Mux procesa el vídeo
        │
        ├─ video.upload.asset_created → /api/webhooks/mux
        │     └─ Lesson.update({ where: { muxUploadId }, data: { muxAssetId } })
        │
        └─ video.asset.ready → /api/webhooks/mux
              ├─ extrae playback_ids[0].id (público)
              ├─ match por muxAssetId → set muxPlaybackId
              └─ fallback: match por passthrough (lessonId)
                                       │
                                       ▼
        En /dashboard/cursos/[slug] aparece el <mux-player>
```

### Verificación de firma del webhook

Mux firma cada evento con HMAC-SHA256. Header `mux-signature: t=<unix_ts>,v1=<hex>`. El payload firmado es `${ts}.${rawBody}`. Implementado a mano en `src/app/api/webhooks/mux/route.ts` con `crypto.timingSafeEqual` para evitar timing attacks. Si el timestamp tiene más de 5 minutos, rechazamos (mitiga replay).

Si `MUX_WEBHOOK_SECRET` no está definido (entorno de pre-producción), el webhook acepta sin verificar firma. **No dejar así en producción**.

### Watermark client-side

`src/components/video-player.tsx` envuelve `<MuxPlayer />` y superpone dos divs absolute con email + IP del alumno. Cada div tiene rotación distinta y `text-shadow` denso para que sea legible sobre cualquier frame y disuasorio aunque el alumno haga screenshot.

Datos:
- `email` viene de `session.user.email`
- `ip` viene de `headers().get("x-forwarded-for")?.split(",")[0]` con fallback a `x-real-ip` y `"—"`

Limitaciones:
- Una grabación de pantalla seguirá funcionando.
- Un usuario técnico puede ocultar los divs vía DevTools antes de grabar — pero la grabación previa está marcada y queda evidencia. Para <100 alumnos vale.

Future-proof: si la cliente reporta filtraciones, escalamos a **signed playback URLs** (cambio en `playback_policies` a `signed` + signing key + JWT con `exp` corto). Documentado como pendiente.

### Player

`@mux/mux-player-react` registra `<mux-player>` como Custom Element. El componente sirve HLS adaptive y MP4 fallback automáticamente. Configurado con `accentColor` celeste (#0ea5e9).

## PDF upload de lecciones

Replica del patrón de `CoverUpload` pero para PDFs:

- `requestLessonFileUploadUrl(input)` server action en `_lessons-actions.ts`. Allowlist MIME `application/pdf`. Genera key con prefijo `lesson-files/<lessonId>/<timestamp>-<rand>-<safe-name>.pdf`.
- `PdfUpload` sub-componente dentro de `_lesson-dialog.tsx`. File picker → request URL → PUT directo a R2 → onUploaded callback rellena `fileKey` en el form.

`src/lib/storage.ts` ahora exporta `buildLessonFileKey({ lessonId, filename })` además de `buildCoverKey(filename)`. Ambos usan un helper interno `buildKey(prefix, filename)`.

## Para activar Mux

### 1. Crear cuenta

- [mux.com](https://www.mux.com) → Sign up.
- Plan free incluye 1000 min de streaming/mes, suficiente para empezar.

### 2. Generar Access Token

- Dashboard → **Settings → Access Tokens → Generate new token**.
- Permissions: **Mux Video** → Read + Write.
- Copia:
  - `MUX_TOKEN_ID` (no es sensitive, pero trátalo como credencial igualmente)
  - `MUX_TOKEN_SECRET` (sensitive — Bitwarden + Vercel con flag Sensitive)

### 3. Webhook

- Dashboard → **Settings → Webhooks → Create new webhook**.
- URL en producción: `https://web-cursos-celeste.vercel.app/api/webhooks/mux` (o el custom domain cuando apuntes el DNS).
- Selecciona eventos `video.upload.asset_created` y `video.asset.ready` (o "all" para no perder nada).
- Tras crear, copia el **signing secret** → `MUX_WEBHOOK_SECRET` (Sensitive).

Para testing local existe `mux webhooks tunnel` o un servicio como ngrok. Lo más práctico: configurar Mux para apuntar a tu deploy Vercel preview, y testear desde ahí.

### 4. Variables de entorno

`.env` local **y** Vercel (Production + Preview, sin comillas, Sensitive donde aplique):

```env
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
MUX_WEBHOOK_SECRET=...
```

`isMuxConfigured()` chequea TOKEN_ID + TOKEN_SECRET. Hasta que ambas estén, los botones "Subir vídeo" no aparecen.

### 5. Probar el flujo completo

1. En admin, crea una lección de tipo VIDEO.
2. Ábrela para editar — aparece "Subir vídeo".
3. Selecciona un archivo (mp4, mov, etc.).
4. Estado: "Pidiendo URL…" → "Subiendo a Mux…" → "Procesando…".
5. Espera ~30s-2min según tamaño. Mux dispara el webhook.
6. Vuelve a abrir la lección — el `muxPlaybackId` debe estar relleno.
7. Como alumno enrolado, ve a `/dashboard/cursos/[slug]?l=<lessonId>` — debe reproducirse el vídeo con watermark.

## Decisiones técnicas

### Public playback policy (no signed) en v1

Crear el upload con `playback_policies: ["public"]`. La URL del vídeo es accesible sin auth si conoces el playbackId. Mitigaciones:
- El playbackId solo se sirve a alumnos enrolados via `/dashboard/cursos/[slug]` (gated por `canAccessCourse`).
- Watermark client-side con email+IP disuade compartir.

Trade-off vs `signed`:
- Signed playback URLs requieren JWT firmado con `exp` corto + signing key. Más seguro pero más fricción (token caduca, hay que regenerar). Reservado para fase posterior si hay leakage.

### Idempotencia sin tabla

Los handlers de Mux usan `update`/`updateMany` con `where` específicos. Si un evento se reentrega, las actualizaciones son idempotentes (escriben los mismos valores). No necesitamos tabla `MuxEvent` por ahora.

Si en el futuro añadimos lógica con efectos colaterales (cobrar al admin por minutos consumidos, p. ej.), introducimos idempotencia con tabla similar a `StripeEvent`.

### Smart Encoding por defecto

Mux Smart Encoding (incluido por defecto) genera HLS adaptive con todas las resoluciones hasta 1080p. Para 4K bumpear `max_resolution_tier` en `new_asset_settings`. Cuesta más por minuto.

### `passthrough = lessonId`

Pasamos `lessonId` como passthrough para que el webhook lo reciba de vuelta. Permite buscar la Lesson sin necesidad de mantener el mapping en otra parte. Combinado con `muxUploadId` da dos vías de matching (resilient frente a eventos en orden raro).

## Pendientes

- **Signed playback URLs** cuando haga falta. Requiere `playback_policies: ["signed"]` al crear upload + JWT con `aud: "v"` + `exp` 60-300s.
- **`video.asset.errored` event handler** para marcar la lección como fallida y permitir re-upload.
- **`mux-player`-side analytics**: con `metadata-video-id` y `metadata-viewer-user-id` Mux Data ofrece dashboards de visionado por alumno. Útil para detectar engagement bajo.
- **Subida de subtítulos** (.vtt). Mux soporta tracks via API.
- **Forensic watermarking** (Mux Pro+) si la disuasión client-side resulta insuficiente. Marca invisible en el codec, ~€100s/mes.

## Commits

```
(pendiente)
```
