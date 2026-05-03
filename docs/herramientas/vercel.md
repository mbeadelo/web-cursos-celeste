# Vercel

## ¿Qué es?

Vercel es una **plataforma de hosting y CI/CD** especializada en Next.js (de hecho, los creadores de Next.js fundaron Vercel).

Conectas un repo de GitHub y Vercel:

- Cada push hace **build automático**.
- Cada PR genera un **preview deploy** con URL única.
- Push a `main` → **producción**.
- Sirve la app desde una **CDN global** (cache cerca del usuario, latencia baja).
- Server-side se ejecuta en **funciones serverless / edge** distribuidas.

Sin servidores que provisionar, sin Dockerfiles, sin scripts de despliegue.

## ¿Para qué lo usamos?

Para **alojar la app entera**. La frontend (HTML, JS, CSS) se sirve desde su CDN; las API routes y server components corren en sus funciones serverless.

Conectado al repo `web-cursos-celeste` en GitHub. Cada push:

- A `main` → despliega a producción (`bienvenidoatuplaza.com` cuando apuntemos el dominio).
- A cualquier rama → preview deploy `nombre-rama-...vercel.app`.

## Variables de entorno

Se gestionan en el dashboard de Vercel (Project → Settings → Environment Variables) con tres entornos:

- **Production**: solo aplicado al deploy de `main`.
- **Preview**: aplicado a deploys de PRs.
- **Development**: si haces `vercel dev` en local.

Cuando añadimos una variable nueva, hay que añadirla en los tres entornos relevantes.

## Plan y coste

- **Hobby (gratis)**: suficiente para MVP con tráfico moderado.
- **Pro ($20/mes)**: cuando crezcamos. Más bandwidth, soporte, build minutes.

Limitaciones del plan gratis a vigilar:

- 100 GB bandwidth/mes.
- 100 GB-hours de funciones serverless/mes.
- Builds limitados (concurrencia 1).

Para un MVP <100 alumnos, ni nos acercamos.

## Integración con Neon

Vercel tiene una integración nativa con Neon: cada PR crea un branch de DB en Neon y enchufa la URL al preview deploy automáticamente. Cero configuración.

## Comandos relevantes

```powershell
# CLI de Vercel (opcional, para hacer cosas desde local)
pnpm dlx vercel login
pnpm dlx vercel env pull .env.local      # copiar variables de Vercel a local
pnpm dlx vercel deploy --prod            # deploy manual a producción (rara vez necesario)
```

## Alternativas que valoramos

- **Netlify**: similar, también full-stack. Menos optimizado para Next.js (Vercel tiene ventaja "casa").
- **Cloudflare Pages**: muy bueno, integrado con todo CF. Menor compatibilidad con APIs específicas de Next.
- **Railway**: excelente para apps con servicios persistentes (DB, workers). Para Next puro, Vercel gana.
- **AWS / GCP / Azure**: control total, configuración compleja. Excesivo para MVP.

## Enlaces

- [Sitio oficial](https://vercel.com)
- [Documentación](https://vercel.com/docs)
- [Pricing](https://vercel.com/pricing)
