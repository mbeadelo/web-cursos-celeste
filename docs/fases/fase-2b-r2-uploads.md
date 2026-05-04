# Fase 2b — Cloudflare R2 + subida de portada

> **Objetivo**: el admin puede subir un archivo de imagen como portada del curso y el navegador lo manda directo a R2 sin pasar por nuestro servidor.

> **Estado**: ✅ Activo en local y en producción (configurado 2026-05-04 sesión 2).

## Diseño

```
Admin elige archivo en /admin/courses/[id]
          │
          ▼
[CoverUpload (cliente)] ──→  requestCoverUploadUrl()  (server action)
                                    │
                                    ├─ ensureAdmin()
                                    ├─ check MIME type allowlist
                                    └─ AWS SDK firma PUT URL para R2
                                    │
                              ←── { uploadUrl, publicUrl, key }
          │
          ▼
fetch(uploadUrl, PUT, body=file) ──────────────→  Cloudflare R2 bucket
                                                       │
                                                       ▼
                                                 Objeto guardado
          │
          ▼
onChange(publicUrl)  → form actualiza coverUrl → Save → Course.coverUrl en DB
```

El navegador sube directamente a R2 sin pasar por nuestras funciones serverless. **Esto evita el límite de 4.5 MB de body en Vercel y ahorra coste de bandwidth en serverless**.

## Archivos añadidos

```
src/lib/storage.ts                         R2 client, signed URLs, buildCoverKey
src/app/admin/courses/_cover-upload.tsx    Picker de archivo (cliente)
```

Modificados:

- `src/app/admin/courses/_actions.ts` — `requestCoverUploadUrl` action.
- `src/app/admin/courses/_form.tsx` — sustituye el campo URL por `<CoverUpload />`.
- `src/app/admin/courses/new/page.tsx` y `[id]/page.tsx` — pasan `storageEnabled` (resultado de `isStorageConfigured()`).

## Dependencias añadidas

| Paquete | Para qué |
|---|---|
| `@aws-sdk/client-s3` | Cliente S3-compatible (R2 implementa la API de S3) |
| `@aws-sdk/s3-request-presigner` | Firmar URLs `PUT` con expiración corta |

## Decisiones de Fase 2b

### Subida directa desde el navegador (no streaming a través del backend)

El backend solo firma la URL — la subida va navegador → R2 directamente. Beneficios:

- Vercel limita el body de funciones a 4.5 MB. Subiendo directo sortemos esa restricción.
- No pagamos bandwidth de salida desde Vercel; R2 solo cobra storage (sin egress fees).
- Backend más rápido (la función termina inmediato tras devolver la URL).

### MIME allowlist en el servidor

El allowlist `image/jpeg | png | webp | avif | gif` se valida **antes** de firmar. Aunque el cliente eliciese decir "image/png" para un EXE, R2 va a almacenar lo que reciba — pero el `Content-Type` viaja firmado en la URL, así que cualquier discrepancia rompe la subida.

> Nota: esto no impide subir basura disfrazada de imagen (alguien puede renombrar `.exe` a `.png` con MIME válido). Para defenderse de eso de verdad haría falta validar la magic number del fichero en el servidor o procesar la imagen (resize, re-codificación). MVP-aceptable por ahora.

### Feature flag por env vars

`isStorageConfigured()` comprueba en runtime si las 4 env vars de R2 están definidas. Si no:

- `requestCoverUploadUrl` devuelve `{ ok: false, error: "R2 no está configurado" }`.
- El formulario muestra solo el campo URL externa, sin el botón de upload.

Esto permite que la app funcione en entornos sin R2 (p. ej. preview de Vercel sin secrets, dev local hasta que el dev configure su R2).

### `R2_PUBLIC_URL` opcional

R2 expone tu bucket por defecto en `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>` pero esa URL **requiere autenticación**. Para servir archivos públicos (como portadas en el catálogo) hace falta:

1. Activar **R2.dev subdomain** o **custom domain** en el dashboard de Cloudflare.
2. Poner esa URL pública en `R2_PUBLIC_URL` (p. ej. `https://assets.bienvenidoatuplaza.com`).

Si no la pones, `publicUrl` apunta a la URL no-pública y la imagen no se cargará para usuarios anónimos. La portada funciona en el admin (aunque tenga sesión) pero no en el catálogo.

## Pasos de configuración (ejecutados 2026-05-04)

### 1. Crear cuenta y activar R2

- Sign-up en [cloudflare.com](https://dash.cloudflare.com/sign-up) (login con GitHub recomendado).
- Saltar el paso "add a site" (no necesitamos meter el dominio en Cloudflare; el DNS lo gestiona Webempresa).
- En el sidebar: **R2 Object Storage** → activar.
- Cloudflare pide tarjeta aunque sea gratis (10 GB/mes free).

### 2. Crear el bucket

- R2 → **Create bucket**.
- Nombre: `bienvenidoatuplaza-assets`.
- Location: **Automatic** (o WEUR/EEUR si fuerzas).
- Default storage class: **Standard**.

### 3. API token

- En R2 hay dos sitios donde se ven los tokens. Vamos a **R2 → "Manage R2 API Tokens"** (botón arriba a la derecha).
- **Create API token**.
- **Tipo**: **Account API Token** (NO User API Token — un token de usuario muere si te quitan del equipo).
- **Permissions**: `Object Read & Write` (no uses Admin).
- **Specify bucket(s)**: "Apply to specific buckets only" → `bienvenidoatuplaza-assets`. Scope mínimo.
- **TTL**: Forever (sin caducidad para no rotar a mano).
- **Client IP filtering**: vacío (Vercel usa IPs dinámicas).
- ⚠️ La pantalla siguiente muestra los secrets **una sola vez**. Guarda en Bitwarden:
  - `Access Key ID` → `R2_ACCESS_KEY_ID`
  - `Secret Access Key` → `R2_SECRET_ACCESS_KEY`
  - `Endpoint` (URL `https://<algo>.r2.cloudflarestorage.com`) → de aquí sacas `R2_ACCOUNT_ID` (el subdominio antes de `.r2.cloudflarestorage.com`).

### 4. CORS

Bucket → **Settings** → **CORS Policy** → Add CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://web-cursos-celeste.vercel.app",
      "https://bienvenidoatuplaza.com",
      "https://www.bienvenidoatuplaza.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Notas:
- `GET` + `HEAD` permiten que el navegador renderice imágenes desde cualquier `<img>`.
- `PUT` permite la subida directa firmada.
- **R2 no soporta wildcards en orígenes** — los preview deploys de Vercel (`*.vercel.app` con git branch en URL) no entran. Si en algún momento necesitas subir desde una preview, añádelo puntualmente.

### 5. Public Development URL

Bucket → **Settings** → **Public Development URL** → **Enable**.

- Cloudflare avisa de que la URL es rate-limited y "not recommended for production". Para MVP es válido — al lanzar producción real migramos a `assets.bienvenidoatuplaza.com` (custom domain).
- El diálogo te pide **escribir literalmente la palabra `allow`** (en minúsculas) para confirmar. No es un campo de URL — es solo confirmación tipo GitHub-delete.
- Cloudflare genera automáticamente la URL `https://pub-XXXXXXXX.r2.dev`. Cópiala → será `R2_PUBLIC_URL`.

### 6. Env vars

En `.env` local **y** en Vercel (Production + Preview, NO Development):

```env
R2_ACCOUNT_ID=abc123def456
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=bienvenidoatuplaza-assets
R2_PUBLIC_URL=https://pub-XXXXXXXX.r2.dev
```

⚠️ **Sin comillas, sin barra final en `R2_PUBLIC_URL`**, sin espacios sobrantes. Vercel guarda los valores literales — un par de comillas accidental rompió `EMAIL_FROM` en Fase 1, no repitamos.

Para `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` marca **Sensitive** en Vercel para que no aparezcan en el dashboard luego.

### 7. Redeploy

Tras añadir las env vars en Vercel, **Redeploy** desde el dashboard (o haz un push trivial). Las env vars solo se aplican en deploys nuevos.

## Verificación

Tras configurar las env vars:

- `/admin/courses/new`: el campo "Portada" debe mostrar el botón **"Subir imagen"**.
- Pulsa, elige una imagen JPG/PNG/WebP < 5 MB.
- El botón cambia a "Pidiendo URL..." y luego "Subiendo...".
- Cuando termina, la URL se rellena y aparece el preview.
- Guarda el curso. La portada se persiste en `Course.coverUrl`.

## Gotchas que nos comimos en la configuración real

1. **"Type `allow` to confirm"** al activar el subdomain público. No es un campo de URL custom domain; es solo confirmación. Si te aparece "tengo que dar yo una URL", probablemente confundiste la sección con "Custom Domains".
2. **Dos secciones distintas para serving público**: `Public Development URL` (gratis, rate-limited, automática) y `Custom Domains` (requiere DNS en Cloudflare). Para MVP, la primera.
3. **Comillas en Vercel** vuelven a morder: pegar `"https://pub-xxx.r2.dev"` con comillas mete las comillas en el valor y rompe la app entera. Pega solo el valor.
4. **CORS sin wildcards**: Cloudflare R2 no acepta `*.vercel.app`. Añade los orígenes explícitos.
5. **Lista de cursos vs. detalle**: la miniatura de la cover **solo se renderiza en la página de edición** (`/admin/courses/[id]`), no en el listado de admin. Si subes y no ves miniatura, asegúrate de estar en la página correcta.
6. **Warning de `pg` sobre SSL modes** apareció en runtime al cargar `/admin/courses`: el driver `pg` deprecará el alias `sslmode=require` → `verify-full`. Cambiar `?sslmode=require` por `?sslmode=verify-full` en `DATABASE_URL`.

## Decisión de seguridad: bucket único público

Por ahora todo va a un solo bucket configurado público. Esto está bien para covers de cursos (queremos que sean visibles a usuarios anónimos en el catálogo) pero **no para los PDFs** (Fase 4) — esos exigirán signed URLs con expiración. Cuando llegue Fase 4 valorar:

- Opción A: usar el mismo bucket pero con prefijos `covers/` (público vía R2.dev) y `pdfs/` (acceso solo via signed URLs generadas por la app).
- Opción B: crear un segundo bucket privado (`bienvenidoatuplaza-private`) para PDFs.

Opción B es más limpia (separación de blast radius) pero opción A simplifica configuración. Decisión pendiente.

## Commits

```
de8b5f2  feat(admin): phase 2b + 2c - lessons CRUD with dnd reorder + R2 cover upload
6f93fa5  docs: phase 2b + 2c retrospectives, R2 setup guide
```
