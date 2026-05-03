# Cloudflare R2

## ¿Qué es?

R2 es el **almacenamiento de objetos** de Cloudflare. "Objetos" significa archivos: PDFs, imágenes, ZIPs, lo que sea.

Es el equivalente de **Amazon S3** pero con dos diferencias clave:

- **Sin egress fees**: cuando alguien descarga un archivo, no pagas por la salida de datos. S3 sí cobra.
- **API compatible con S3**: cualquier librería S3 funciona apuntando al endpoint de R2.

Plan gratis: **10 GB de storage + 1M operaciones de clase A + 10M de clase B/mes**. Suficiente para arrancar un proyecto entero.

## ¿Para qué lo usamos?

- **PDFs descargables** de las lecciones (`Lesson` con `type: PDF` guarda la `fileKey` que apunta al objeto en R2).
- **Imágenes de portada** de los cursos (`Course.coverUrl`).

Flujo de subida:

1. Admin selecciona archivo en el panel.
2. Backend genera **URL firmada de subida** (válida unos minutos).
3. Navegador del admin sube directo a R2 (no pasa por nuestro servidor → ahorro de bandwidth y CPU).
4. Backend guarda la `fileKey`.

Flujo de descarga:

1. Alumno pulsa "Descargar PDF".
2. Backend verifica que tenga `Enrollment` para el curso.
3. Si OK, genera **URL firmada de descarga** (caducidad corta).
4. Navegador descarga directamente de R2.

## ¿Cómo se accede?

R2 es S3-compatible. Usamos `@aws-sdk/client-s3` apuntando al endpoint específico de la cuenta:

```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

En este proyecto el cliente vive en `src/lib/storage.ts` con tres helpers:

- `isStorageConfigured()` — true cuando las 4 env vars están definidas. La UI usa esto para esconder el upload si R2 no está activo.
- `createUploadUrl({ key, contentType })` — devuelve una URL `PUT` firmada (5 min) que el navegador usa para subir directo.
- `buildCoverKey(filename)` — genera una key segura (`covers/<ts>-<rand>-<slug>.<ext>`).

## CORS — paso fácil de olvidar

R2 tiene política CORS por bucket. Sin esto, el navegador **rechaza** las subidas con un error de preflight. Configuración mínima:

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

Se pega en R2 → Bucket → Settings → CORS Policy.

## URL pública vs URL firmada

R2 expone los objetos por defecto en `https://<accountId>.r2.cloudflarestorage.com/<bucket>/<key>` pero esa URL **requiere autenticación**.

Para servir archivos públicos (portadas que se ven en el catálogo) hay dos opciones:

- **R2.dev subdomain** (gratis, dominio `pub-xxx.r2.dev`).
- **Custom domain** (apuntas un subdominio tuyo, p. ej. `assets.bienvenidoatuplaza.com`).

Cualquiera de las dos, pones la URL base en `R2_PUBLIC_URL` y el código construye `${R2_PUBLIC_URL}/<key>` para el `coverUrl` que guardamos en DB.

Para archivos protegidos (PDFs solo accesibles si el alumno tiene `Enrollment`), no se sirve público — se generan URLs firmadas en el momento (Fase 4).

## Alternativas que valoramos

- **Supabase Storage**: simple, integrado. Egress no es gratis ilimitadamente.
- **AWS S3**: el estándar. Egress caro a partir de cierto volumen.
- **Backblaze B2**: barato, S3-compatible. Buena alternativa pero R2 + Cloudflare integran mejor con todo lo demás.

## Enlaces

- [Sitio oficial](https://www.cloudflare.com/products/r2/)
- [Documentación](https://developers.cloudflare.com/r2/)
- [Compatibilidad con S3](https://developers.cloudflare.com/r2/api/s3/api/)
