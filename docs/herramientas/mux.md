# Mux

## ¿Qué es?

Mux es un **servicio especializado en alojar y servir vídeo**. Le subes un archivo (`.mp4`, `.mov`, etc.) y Mux:

1. **Transcodifica** (genera versiones a distintas resoluciones para móvil, tablet, fibra, 4G).
2. **Sirve por HLS** (protocolo de streaming adaptativo: el reproductor elige calidad según ancho de banda).
3. **Genera URLs firmadas** (sin firma, no se reproduce — caducan rápido).
4. **Genera thumbnails y previsualizaciones** automáticas.

Es lo que hay detrás de Patreon, Robinhood, Intercom, Vimeo OTT y muchas plataformas educativas.

## ¿Para qué lo usamos?

**Vídeo de las lecciones** (las clases en sí).

Flujo:

1. **Admin sube vídeo** desde el panel: nuestro backend pide a Mux una URL de subida directa, el admin sube el archivo, Mux notifica por webhook cuando el `asset` está listo (`video.asset.ready`). Guardamos `playbackId` en `Lesson.muxPlaybackId`.
2. **Alumno reproduce**: nuestro backend genera una **signed playback URL** (con caducidad de unos minutos) **solo si el alumno tiene `Enrollment` para el curso**. El reproductor (`@mux/mux-player-react`) la consume.

Resultado: nadie puede compartir un enlace y que un tercero lo vea, porque el enlace caduca y solo se genera para alumnos con acceso.

## Coste

Mux cobra por:

- **Vídeo subido (transcoding)**: ~€0.04 por minuto procesado, una vez.
- **Vídeo visto (delivery)**: ~€0.0005 por minuto visto.
- **Storage**: ~€0.003 por minuto almacenado al mes.

Para un MVP con catálogo de 30 horas y <100 alumnos, hablamos de **<€20/mes**. A medida que crezca, el coste escala con el uso real.

## Alternativas que valoramos

- **Cloudflare Stream**: similar, integrado con CF. Precio comparable. Mux gana en DX y SDKs.
- **YouTube unlisted**: gratis pero no puedes revocar enlaces. Filtrabilidad alta. Descartado.
- **Bunny Stream**: más barato. Menos pulido.
- **Self-hosted (ffmpeg + S3 + HLS)**: trabajo extra significativo. Para un MVP no compensa.

## Enlaces

- [Sitio oficial](https://mux.com)
- [Documentación](https://docs.mux.com)
- [@mux/mux-node (SDK)](https://docs.mux.com/sdks/server/node)
- [@mux/mux-player-react (reproductor)](https://docs.mux.com/sdks/player/mux-player-react)
