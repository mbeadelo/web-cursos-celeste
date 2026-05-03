# Tailwind CSS

## ¿Qué es?

Tailwind es un **framework CSS basado en clases utility**. En lugar de escribir CSS en archivos `.css` con clases propias, escribes directamente las propiedades como clases en el HTML:

```html
<!-- En lugar de esto -->
<div class="card-titulo">Hola</div>
<style>.card-titulo { font-size: 1.5rem; font-weight: 700; color: #1f2937; }</style>

<!-- Escribes esto -->
<div class="text-2xl font-bold text-gray-800">Hola</div>
```

Suena raro al principio. Después de un par de horas, no quieres volver atrás.

Ventajas:

- **No hay que inventar nombres de clase** ni reorganizar CSS al refactorizar.
- **No hay CSS muerto**: solo se incluyen las clases que usas.
- **Diseño consistente**: el sistema te obliga a usar valores predefinidos (`p-4`, `p-6`, `p-8`) en vez de píxeles arbitrarios.
- **Responsive y dark mode** triviales: `md:text-lg dark:text-gray-100`.

## ¿Para qué lo usamos?

Para **toda la UI**. Páginas públicas, dashboard, panel de admin: todo estilizado con Tailwind. No hay archivos CSS propios (más allá de `globals.css` con un par de defaults).

Versión: **Tailwind 4**, que cambió cosas respecto a 3 — sobre todo configuración via CSS (`@theme`) en lugar de `tailwind.config.js`.

## ¿Para qué NO lo usamos?

Para componentes complejos preconstruidos (modal, dropdown, combobox). Para eso usamos [shadcn/ui](/herramientas/shadcn), que internamente usa Tailwind.

## Alternativas que valoramos

- **CSS Modules**: clases scopeadas, escribes CSS normal. Funciona bien pero requiere más nombres y archivos.
- **styled-components / emotion**: CSS-in-JS. Pesa más en runtime y menos popular hoy.
- **Plain CSS / SCSS**: lo de toda la vida. Trabaja más para mantener consistencia.

## Enlaces

- [Sitio oficial](https://tailwindcss.com)
- [Documentación](https://tailwindcss.com/docs)
- [Tailwind Play (probar online)](https://play.tailwindcss.com)
