# Migración del dominio a Vercel

> **Fecha:** 23–26 de junio de 2026
> **Resultado:** `bienvenidoatuplaza.com` sirve la web desde Vercel, con HTTPS y `www` como dominio canónico.

Esta página documenta **qué** cambiamos para poner el dominio de verdad delante de la web y, sobre todo, **por qué** cada cambio. Es el guion a seguir si algún día hay que repetirlo o revertirlo.

## Punto de partida

Antes de migrar:

- **La web ya estaba desplegada y funcionando** en `web-cursos-celeste.vercel.app` (HTTP 200, servida por Vercel). No había nada que "mover": la app vive en Vercel, que compila y sirve directamente desde el repositorio de GitHub en cada `push` a `main`.
- **El dominio `bienvenidoatuplaza.com` apuntaba al parking** del hosting (Webempresa): resolvía a `213.158.84.61`, un `nginx` que devolvía **HTTP 404**. Es decir, el nombre bonito no llevaba a ningún sitio útil.

::: tip La confusión típica: dominio ≠ hosting
La web **no** vive en un hosting tradicional (de los de `public_html` y FTP). Vive en **Vercel**. Migrar el dominio **no** es subir ficheros a ningún sitio — es solo **redirigir el nombre** para que apunte a Vercel. Cero archivos, cero subidas.
:::

## Qué cambiamos y por qué

### 1. Añadir el dominio en Vercel (con `www` como canónico)

En **Vercel → proyecto → Domains → Add Existing** se añadió `bienvenidoatuplaza.com`. La configuración resultante:

- **`www.bienvenidoatuplaza.com`** es el dominio **principal** (Production).
- **`bienvenidoatuplaza.com`** (apex/raíz) hace un **redirect 308 → `www`**.

**Por qué `www` como canónico:** evita ambigüedad de "contenido duplicado" en dos URLs y centraliza todo en una sola dirección. Da igual que un usuario escriba con o sin `www`: siempre acaba en `www`. Es una decisión cosmética, pero hay que ser consistentes con ella en el resto de la config (ver `AUTH_URL` más abajo).

### 2. Registros DNS en Webempresa

Vercel indica los registros exactos que necesita. En el **Editor de Zona DNS del cPanel de Webempresa** se pusieron:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `@` (raíz) | `216.150.1.1` |
| `CNAME` | `www` | `6fdbc6a4090745f1.vercel-dns-017.com.` |

Detalles importantes de **por qué** así:

- **Se reemplazó el `A` viejo** (`213.158.84.61` → `216.150.1.1`), no se añadió uno nuevo al lado. Si se dejan los dos, el dominio sigue rebotando al parking de forma intermitente.
- **La IP `216.150.1.1` es la "nueva" de Vercel.** Vercel está ampliando su rango de IPs; las antiguas (`76.76.21.21` / `cname.vercel-dns.com`) siguen funcionando, pero se usaron las nuevas que recomienda su panel.
- **El `A` de la raíz** existe para que Vercel pueda emitir el redirect `308 → www`. **El `CNAME` de `www`** es el que apunta al servidor donde se sirve la app de verdad.
- **No se tocaron los registros `MX`** (correo): el email del dominio va por su lado y cambiar A/CNAME no lo afecta.

### 3. `AUTH_URL` apuntando al dominio canónico

Se añadió en **Vercel → Production** la variable:

```
AUTH_URL = https://www.bienvenidoatuplaza.com
```

**Por qué hace falta:** el código la lee (vía `src/lib/env.ts`) en dos sitios — el **checkout** (`src/app/api/checkout/route.ts`) y los **emails transaccionales** (`src/lib/email.ts`) — para construir URLs absolutas. Sin ella, caía a un valor por defecto con la URL vieja, de modo que:

- El botón **"Volver"** del checkout (`cancel_url`) y la **página de éxito** tras pagar (`success_url`) apuntaban a la URL antigua.
- Los enlaces de los **magic-links** y correos no usaban el dominio bonito.

::: warning Gotcha: `NEXT_PUBLIC_*` y `AUTH_URL` exigen redeploy
Las env vars **no se aplican retroactivamente**. Tras añadir o cambiar `AUTH_URL` hay que **redesplegar** para que entre en vigor.
:::

### 4. (Relacionado) El botón "Comprar curso" y la CSP

Durante la migración salió a la luz un bug que **no** era de DNS: el botón **"Comprar curso"** estaba roto en el navegador con el error:

```
Sending form data to '.../api/checkout' violates the following
Content-Security-Policy directive: "form-action 'self'".
```

**Causa:** el formulario de compra hace `POST` a `/api/checkout`, que responde con un **303 redirigiendo a `checkout.stripe.com`**. Los navegadores aplican la directiva `form-action` **también al destino del redirect**, y la CSP tenía `form-action 'self'` (sin Stripe) → el navegador cortaba la navegación. Funcionaba por `curl` (que ignora la CSP) pero no en un navegador real.

**Arreglo** (`src/proxy.ts`): añadir el host de Stripe a la directiva.

```ts
"form-action": "'self' https://checkout.stripe.com",
```

Se documenta aquí porque apareció en el mismo bloque de trabajo y porque el síntoma ("el dominio no funciona") se confundía fácilmente con el DNS.

## Verificación

Tras propagar el DNS, se comprobó con `nslookup` + `curl`:

- `bienvenidoatuplaza.com` → resuelve a `216.150.1.1` y devuelve **`308`** con `location: https://www.bienvenidoatuplaza.com/`.
- `www.bienvenidoatuplaza.com` → **`200`**, `server: Vercel`. La web se sirve.
- **Certificado HTTPS** emitido automáticamente por Vercel.
- El botón de compra desde el dominio nuevo → **303 → `checkout.stripe.com`** (sesión `cs_live_…`). Flujo de pago correcto.

## Pendiente: noviembre (fin del año de hosting)

Lo que se pagó en Webempresa son **dos productos distintos** aunque vengan en la misma factura:

- **El hosting** (el servidor de ficheros) → **ya no se necesita**, lo hace Vercel. En noviembre se deja caducar.
- **El dominio** (el registro del nombre) → **hay que seguir renovándolo** (~12–15 €/año un `.com`) o se pierde el nombre.

::: danger No dejar caducar el dominio
Muchos proveedores empaquetan dominio + hosting. Hay que **confirmar con el soporte de Webempresa** (por escrito) que se puede **conservar solo el dominio, con gestión de DNS, sin el hosting**. Y ojo si el **correo** del dominio depende de los `MX` de Webempresa: al dar de baja el hosting podría romperse.
:::

Alternativa opcional (no urgente): **transferir el dominio a Cloudflare** (a precio de coste, requiere desbloquear + código EPP/Auth en Webempresa) para desacoplarse por completo del hosting.

## Por qué se pudo migrar sin esperar al contenido

La migración del dominio es **independiente** de que los cursos estén terminados: el dominio solo "pone el nombre delante" de la app que ya corría en Vercel. Los cursos a medias podían quedarse como borrador (despublicados) sin bloquear nada.
