# Operaciones de lanzamiento

Bitácora de las operaciones de puesta en producción de **junio de 2026**: el bloque en el que la web pasó de "desplegada en una URL de Vercel" a "en su dominio propio, auditada y con monitorización".

A diferencia de las [Fases](/fases/fase-0-setup) (que cuentan cómo se construyó el producto), esta sección documenta las **operaciones de infraestructura y seguridad** del lanzamiento.

## En esta sección

| Página | Qué cubre |
|---|---|
| [Migración del dominio](/operaciones/migracion-dominio) | Apuntar `bienvenidoatuplaza.com` a Vercel: DNS, `www` canónico, `AUTH_URL`, y por qué cada cambio |
| [Auditoría de seguridad #2](/operaciones/auditoria-seguridad-2) | Revisión pre-lanzamiento en modo LIVE: hallazgos, correcciones y lo que quedó sólido |
| [Sentry](/herramientas/sentry) | Monitorización de errores: el cableado correcto para Next 16 + Sentry v10 |

## Bitácora — junio 2026

Orden cronológico de lo que se hizo en este bloque:

1. **Fix del botón de compra (CSP).** El botón "Comprar curso" estaba roto en el navegador: la CSP `form-action 'self'` bloqueaba el redirect del checkout a `checkout.stripe.com`. Arreglado en `src/proxy.ts` añadiendo el host de Stripe. Detalle en [Migración del dominio](/operaciones/migracion-dominio).

2. **IVA incluido en el checkout** (`tax_behavior: inclusive`): el IVA va dentro del precio mostrado, no se suma aparte.

3. **Migración del dominio** a Vercel: DNS en Webempresa, `www` canónico, `AUTH_URL`, verificación con HTTPS. → [Migración del dominio](/operaciones/migracion-dominio).

4. **Auditoría de seguridad #2** (5 ámbitos en paralelo) + correcciones de código aplicadas (refund parcial, webhook resistente a fallos, sanitización legal, endurecimiento del chatbot). → [Auditoría de seguridad #2](/operaciones/auditoria-seguridad-2).

5. **Endurecimiento del chatbot**: tope global diario como segunda línea anti-abuso, abort del stream si el cliente cuelga, y alertas de abuso a Sentry.

6. **Activación de Sentry**: se descubrió que el cableado estaba incompleto para Next 16 (faltaba `withSentryConfig` y el archivo `instrumentation-client.ts`); se corrigió y se verificó que la DSN ya se incrusta en el bundle. → [Sentry](/herramientas/sentry).

## Pendientes operativos (paneles, no código)

- ⏳ **Confirmar `MUX_SIGNING_*` en Vercel Production** (o que los assets de Mux tengan policy `signed`). Ver [Auditoría #2](/operaciones/auditoria-seguridad-2).
- ⏳ **Noviembre**: no renovar el hosting de Webempresa, **sí** el dominio; confirmar con soporte que se conserva el dominio + DNS sin hosting. Ver [Migración del dominio](/operaciones/migracion-dominio).
- ⏳ **Despublicar el curso de pruebas "Test Stripe"** y limpiar lecciones placeholder antes de abrir al público.
