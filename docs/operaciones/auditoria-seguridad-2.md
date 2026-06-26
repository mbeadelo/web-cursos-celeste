# Auditoría de seguridad #2

> **Fecha:** 23 de junio de 2026
> **Método:** 5 investigaciones en paralelo (pagos, autorización, acceso a contenido, chatbot, XSS/CSP).
> **Veredicto:** base muy sólida. **0 hallazgos críticos** y **ningún alto incondicional**.

Segunda auditoría de seguridad, hecha tras migrar el dominio y con la web ya en **modo Stripe LIVE** (cobra dinero real). Continúa la primera auditoría (junio 2026). Cada ámbito se revisó por separado y aquí se consolida.

## Hallazgo nº1 — Protecciones que se apagan en silencio sin sus env vars

Es el de **mayor impacto** y salió en 3 de los 5 ámbitos. Varias defensas se **degradan a no-op silencioso** si faltan sus variables en el scope **Production** de Vercel:

| Variable | Si falta… | Estado |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | No hay rate-limit: chatbot sin techo (DoS económico), magic-links ilimitados, checkout sin límite | ✅ **Confirmado ACTIVO en prod** |
| `MUX_SIGNING_KEY_ID` + `_PRIVATE_KEY` | Los vídeos quedan política `public`: el `playbackId` es compartible sin sesión, de forma permanente | ⏳ **Pendiente de confirmar** |

**Upstash** se verificó con una ráfaga de peticiones malformadas a `/api/chat`: las primeras 15 devolvieron `400` y de la 16ª en adelante `429` — exactamente el límite `15/min` funcionando con Redis real. Como login, checkout y chat comparten el mismo Redis, **los tres están protegidos**.

**Mux signing** no es testeable desde fuera sin una sesión de alumno; se confirma en el Dashboard de Mux (que un asset tenga *playback policy* `signed`, no `public`) o en Vercel. ⚠️ Los vídeos subidos **mientras signing esté apagado se quedan `public` para siempre** aunque luego se activen las claves.

## Correcciones de código aplicadas

Todas mergeadas a `main`:

| Severidad | Corrección | Dónde |
|---|---|---|
| 🟠 Medio | **Refund parcial ya no revoca el acceso** — solo se borra el `Enrollment` en reembolso íntegro (`charge.refunded === true`) | `api/webhooks/stripe/route.ts` |
| 🟠 Medio | **Webhook resistente a fallos transitorios** — si el handler falla tras escribir `StripeEvent`, se revierte esa fila y se devuelve `500` para que Stripe reintente (los writes son upserts idempotentes) | `api/webhooks/stripe/route.ts` |
| 🟡 Bajo | **Sanitizar el HTML de documentos legales al guardar** (era el 4º punto de escritura rich que no pasaba por `sanitizeRichHtml`) | `admin/legal/_actions.ts` |
| 🟡 Bajo | **El stream del chatbot aborta si el cliente cuelga** (`req.signal`), para no pagar tokens que nadie lee | `api/chat/route.ts` |
| 🟡 Bajo | **Tope global diario del chatbot** — segunda línea anti-abuso ante ataques distribuidos/spoofeados; degrada a un mensaje amable sin gastar | `lib/rate-limit.ts` |
| 🟡 Bajo | **Alertas de abuso a Sentry** — aviso cuando una IP supera el límite horario o se alcanza el tope global diario | `api/chat/route.ts` |

## Lo que se confirmó sólido

- **Precio del curso siempre desde la DB**, nunca del formulario (el form solo aporta el `courseId`).
- **Firma del webhook** verificada sobre el *raw body*; **idempotencia** vía `StripeEvent` (PK = `event.id`).
- **Registro cerrado con triple barrera**: el adapter lanza salvo para el admin, el callback `signIn` rechaza emails desconocidos, y la server action de login revalida. No hay autoregistro.
- **Rol `ADMIN` sin escalada ni forja**: solo lo asigna el seed; el rol viaja en un JWT firmado con `AUTH_SECRET`.
- **Autorización en 4 capas**: proxy edge + revalidación server-side en `/admin` y `/dashboard` + `ensureAdmin` en **todas** las mutaciones (incluidos los endpoints de presign de R2).
- **Sin IDOR** en lecciones, PDFs ni vídeos: todo se gatea por `Enrollment`.
- **Sanitizador robusto** (`sanitize-html`): sin `javascript:`, sin handlers `on*`, sin `<iframe>`/`<style>`.
- **CSP con nonce por petición**, sin `unsafe-inline` en `script-src` en producción.
- **Secretos** solo en módulos `server-only`; ninguno filtrado al bundle de cliente.

## Aceptables (sin acción)

Enumeración de emails en el login (decisión de UX, rate-limited) · IP de `x-forwarded-for` spoofeable (aceptable para rate-limiting) · el prefetch se salta el proxy (lo cubre la capa server-side) · `trustHost` implícito (correcto en Vercel) · resistencia a *prompt-injection* del chatbot best-effort (inherente a cualquier LLM, acotada por `max_tokens` + rate-limit + spend cap).
