# Next.js

## ¿Qué es?

Next.js es un **framework web full-stack basado en React**. Sirve a la vez como:

- **Frontend**: páginas, componentes, navegación.
- **Backend**: rutas API, lógica server-side, conexión a base de datos.

En lugar de tener dos repos (un frontend React + un backend Express), tienes uno solo donde Next decide qué corre en el navegador y qué corre en el servidor según donde lo escribas.

Conceptos clave:

- **App Router**: la forma actual de definir rutas. Cada carpeta dentro de `src/app/` es una ruta. Un `page.tsx` dentro de la carpeta es la página.
- **Server Components**: por defecto los componentes corren en el servidor. Hacen fetch a la DB directamente. Ahorran muchísimo JavaScript en el cliente.
- **Client Components**: marcados con `"use client"`. Necesarios para interactividad (estado, eventos, etc.).
- **Server Actions**: funciones que parecen normales pero corren en el servidor. Sustituyen a "tener que crear un endpoint API" para cada formulario.
- **Route Handlers**: equivalente a endpoints de API tradicional. Los usamos para webhooks externos (`/api/webhooks/stripe`).
- **Middleware**: corre antes de cualquier request. Lo usamos para gating de rutas (admin, dashboard).

## ¿Para qué lo usamos?

Es **toda la app**. Las páginas públicas (catálogo, login), el dashboard del alumno, el panel de admin y los webhooks de Stripe corren todos en la misma app Next.js.

Versión: **Next.js 16** (App Router, con Turbopack como motor de dev).

## Alternativas que valoramos

- **Astro**: mejor para sitios mayoritariamente estáticos (blogs, landing). Aquí tenemos mucha lógica autenticada → Next gana.
- **Remix**: filosofía similar a Next pero menor adopción. Next tiene más ecosistema.
- **Plain React + Express**: dos repos, dos despliegues, dos veces el trabajo de configuración. Sin sentido para un MVP.

## Enlaces

- [Sitio oficial](https://nextjs.org)
- [Documentación del App Router](https://nextjs.org/docs/app)
- [Aprende Next.js (curso oficial gratis)](https://nextjs.org/learn)
