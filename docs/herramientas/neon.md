# Neon

## ¿Qué es?

Neon es **PostgreSQL serverless gestionado**. Te dan una URL de conexión y ya tienes una base de datos Postgres lista. No tienes que administrar servidores, hacer backups manuales, ni preocuparte de actualizaciones.

Lo "serverless" significa que la DB **escala sola**: se duerme cuando no se usa (no pagas) y se despierta en milisegundos al recibir una request. Para un MVP esto es perfecto: cuesta €0 mientras no tengas tráfico.

Características clave:

- **Branching de DB**: como `git branch`, pero para tu base de datos. Cada PR puede tener su propia copia de la DB con datos reales (anonimizados o no), aislada de la principal.
- **Point-in-time restore**: en planes pago, puedes "rebobinar" la DB a cualquier momento de las últimas 24 h o 7 días.
- **Compatible con cualquier cliente Postgres**: tu código no sabe que es Neon. Le das la URL y funciona.

## ¿Para qué lo usamos?

Es **el host de la DB**. Tendremos tres entornos:

- **Producción**: branch `main` de Neon ↔ entorno `production` en Vercel.
- **Preview**: cada PR de GitHub crea automáticamente un branch de DB en Neon, conectado al preview deploy de Vercel. Cambios destructivos no afectan a producción.
- **Local**: usamos un branch dev de Neon (o `prisma dev` con Postgres local efímero, según convenga).

## Plan y coste

- **Free tier**: 0,5 GB de storage, suficiente para arrancar.
- Cuando crezcamos: **Launch plan** ~€19/mes con backups automáticos y más storage.

## Alternativas que valoramos

- **Supabase**: incluye también auth + storage + realtime. Si quisiéramos paquete todo-en-uno sería opción A. Pero ya tenemos Auth.js + R2 + Mux por separado, así que solo nos hace falta Postgres puro.
- **Railway / Render**: Postgres tradicional, sin serverless. Más caro en idle.
- **AWS RDS**: industria, sí, pero overkill para MVP.

## Enlaces

- [Sitio oficial](https://neon.tech)
- [Branching](https://neon.tech/docs/introduction/branching)
- [Integración con Vercel](https://neon.tech/docs/guides/vercel)
