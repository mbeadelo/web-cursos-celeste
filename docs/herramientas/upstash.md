# Upstash Redis

## ¿Qué es?

Redis serverless con API REST. Pago por petición, sin servidor que mantener, latencias de pocos ms desde edge.

## ¿Para qué la usamos?

**Rate limiting** en endpoints sensibles:

- `/login` (server action de magic link) — 5 emails / 15 min por dirección + 10 / 15 min por IP. Evita que un atacante spamee un buzón ajeno y que enumere emails desde una IP.
- `/api/checkout` — 10 / min por IP. Cap para no consumir API de Stripe en un bucle apretado.

Implementación en `src/lib/rate-limit.ts` con `@upstash/ratelimit` (sliding window). Si las vars de entorno no están definidas, los limiters son **no-op** — dev/test no necesitan Redis.

## Configuración

1. [console.upstash.com](https://console.upstash.com) → New Database → Redis → región europea (Frankfurt o Dublín).
2. En la página del DB, sección "REST API" → copiar:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Pegarlas en Vercel (Production + Preview) y opcionalmente en `.env` local si quieres probar el limiter.

## Coste

Plan **Free**: 10 000 comandos/día. Cada chequeo de límite es 1-2 comandos. Sobrado para cientos de logins y compras al día.

Plan **Pay as you go**: $0.20 por 100k comandos. A escala MVP estamos lejos.

## Alternativas que valoramos

**`@vercel/kv`** (que envuelve Upstash internamente):
- Pros: integración nativa con Vercel, instalación de un click.
- Contras: bloquea a Vercel como hosting. Upstash directo nos deja portables.

**Redis self-hosted**:
- Coste cero pero hay que mantener el servidor. Para un MVP, no merece la pena.

**In-memory por instancia**:
- Vercel lambdas son efímeras → un atacante distribuiría su tráfico entre instancias y rompería el límite. Inservible.

## Enlaces

- Web: <https://upstash.com>
- Docs Ratelimit: <https://upstash.com/docs/redis/sdks/ratelimit-ts/overview>
- Console: <https://console.upstash.com>
