# Fase 2b — Cloudflare R2 + subida de portada

> **Objetivo**: el admin puede subir un archivo de imagen como portada del curso y el navegador lo manda directo a R2 sin pasar por nuestro servidor.

> **Estado**: ✅ Código listo. Pendiente de que crees la cuenta de Cloudflare y configures las env vars para activarlo en producción.

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

## Lo que TÚ tienes que hacer para activarlo

1. **Crear cuenta en cloudflare.com** (login con GitHub).
2. **Activar R2** (dashboard → R2 → Get Started). Te pide tarjeta para el plan gratuito (10 GB).
3. **Crear un bucket**:
   - Nombre: `bienvenidoatuplaza-assets`
   - Location: `Eastern Europe (EEUR)` o `Western Europe (WEUR)`.
4. **Crear un API token**:
   - R2 → Manage R2 API Tokens → Create API Token
   - Permisos: `Object Read & Write` para el bucket creado
   - Anota: `Access Key ID`, `Secret Access Key`, `Account ID`
5. **(Opcional pero recomendado)** activar dominio público:
   - Bucket → Settings → Public access → Connect Custom Domain o R2.dev subdomain.
6. **Añadir al `.env` local** y a Vercel (Production + Preview):

```env
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="bienvenidoatuplaza-assets"
R2_PUBLIC_URL="https://pub-xxxx.r2.dev"   # si usas r2.dev
```

7. **(Importante)** configurar **CORS** en el bucket para permitir PUT desde tu dominio:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://web-cursos-celeste.vercel.app",
      "https://bienvenidoatuplaza.com"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

R2 → Bucket → Settings → CORS Policy.

8. Redeployar Vercel (o esperar al siguiente push).

## Verificación

Tras configurar las env vars:

- `/admin/courses/new`: el campo "Portada" debe mostrar el botón **"Subir imagen"**.
- Pulsa, elige una imagen JPG/PNG/WebP < 5 MB.
- El botón cambia a "Pidiendo URL..." y luego "Subiendo...".
- Cuando termina, la URL se rellena y aparece el preview.
- Guarda el curso. La portada se persiste en `Course.coverUrl`.

## Commit

```
de8b5f2  feat(admin): phase 2b + 2c - lessons CRUD with dnd reorder + R2 cover upload
```
