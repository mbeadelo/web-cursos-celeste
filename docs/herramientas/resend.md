# Resend

## ¿Qué es?

Resend es un **servicio de email transaccional**. Cuando tu app necesita mandar un email programáticamente (magic link de login, recibo de compra, recuperación de contraseña), llamas a su API y ellos lo entregan.

¿Por qué no usar `nodemailer` con tu Gmail? Porque:

- Gmail/Outlook bloquean el envío masivo desde scripts.
- La entrega ("deliverability") depende de SPF, DKIM, DMARC, reputación de IP, etc. Esto lo gestiona Resend por ti.
- Necesitas un dominio verificado para no caer en spam.

Resend nació pensado para developers — su API y SDK son muy limpios, y tienen una integración nativa con Auth.js.

## ¿Para qué lo usamos?

Todo el email saliente:

- **Magic link** de login (Fase 1).
- **Recibo** tras una compra (Fase 5).
- **Bienvenida** al matricularse en un curso (Fase 5).
- **Recuperación / reenvío** de magic link.

Dominio remitente: **bienvenidoatuplaza.com**, verificado en Resend con registros DNS (TXT, DKIM, MX para bounces).

## Plan y coste

- **Free tier**: 100 emails/día, 3000/mes, un dominio verificado. Suficiente para el MVP.
- **Pro**: $20/mes, 50k emails/mes, varios dominios.

## Cómo se verifica el dominio

Resend pide que añadas unos registros DNS en tu proveedor:

- **TXT** con un `v=spf1 ...` (declara que Resend puede enviar como tu dominio).
- **TXT con DKIM** (firma criptográfica de los emails).
- **MX** para gestionar bounces.

Lo haremos en Webempresa (o Cloudflare, dependiendo de cómo organicemos el DNS) cuando lleguemos a Fase 1.

## Alternativas que valoramos

- **Postmark**: similar, excelente reputación. Más caro.
- **SendGrid**: industria, sí, pero DX peor y más complicado de configurar.
- **Mailgun**: más antiguo, mismo nicho.
- **Amazon SES**: barato a escala, doloroso de configurar.

Para un MVP con poco volumen y máxima simplicidad, **Resend gana**.

## Enlaces

- [Sitio oficial](https://resend.com)
- [Documentación](https://resend.com/docs)
- [Integración con Auth.js](https://authjs.dev/getting-started/providers/resend)
