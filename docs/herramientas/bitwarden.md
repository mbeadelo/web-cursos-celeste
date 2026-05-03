# Bitwarden

## ¿Qué es?

Bitwarden es un **gestor de contraseñas open source**. Guarda credenciales (usuario + contraseña), códigos 2FA (TOTP), notas seguras y datos de tarjetas en una "bóveda" cifrada **end-to-end**: solo tu master password puede abrirla, ni siquiera Bitwarden puede leer tu contenido.

Sincroniza entre dispositivos (web, escritorio Windows/Mac/Linux, móvil, extensiones del navegador) y autocompleta credenciales en formularios.

## ¿Para qué lo usamos?

**No es parte del stack de la app**, pero es parte del **stack del proyecto**: gestiona los accesos a todos los servicios externos.

Esto incluye:

- GitHub
- Vercel
- Neon
- Stripe
- Mux
- Cloudflare (R2)
- Resend
- Sentry
- Webempresa
- API keys y secrets de cada uno (en "Secure Notes")
- Códigos de recuperación de 2FA

## Buenas prácticas adoptadas

1. **Master password única, larga, nunca reutilizada**. Si la pierdes, pierdes la bóveda.
2. **2FA en Bitwarden mismo** (Email o app TOTP).
3. **Cada servicio con password aleatoria** (generada por Bitwarden, 20+ chars).
4. **2FA activado en cada servicio crítico** (GitHub, Vercel, Stripe).
5. **Códigos de recuperación de 2FA** guardados en Secure Notes en la bóveda (si pierdes el dispositivo del 2FA, son la única forma de recuperar).
6. **API keys y secrets** copiados a la bóveda inmediatamente al generarlos. Algunos (como Stripe) solo se enseñan una vez.
7. **`.env.local` nunca es la fuente de verdad** — es una caché. La bóveda lo es.

## Alternativas que valoramos

- **1Password**: probablemente la mejor UX. ~€36/año, no es gratis.
- **Proton Pass**: bueno si ya usas Proton Mail/VPN.
- **KeePassXC**: archivo `.kdbx` que tú custodias. Sin sincronización gestionada.
- **Apple Keychain / Google Password Manager**: fáciles, atados a un ecosistema. Sin importación/exportación cómoda.

## Enlaces

- [Sitio oficial](https://bitwarden.com)
- [Documentación](https://bitwarden.com/help/)
- [Auto-host (Vaultwarden, alternativa ligera)](https://github.com/dani-garcia/vaultwarden)
