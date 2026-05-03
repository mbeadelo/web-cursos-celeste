# shadcn/ui

## ¿Qué es?

shadcn/ui es **una colección de componentes React copy-paste**. No es una librería que instalas con `pnpm add` — es un CLI que **te copia el código del componente directamente a tu proyecto**.

Suena raro, pero es genial:

- Pides un `<Button>` → el CLI mete el archivo `src/components/ui/button.tsx` en tu repo.
- Tú **eres dueño** del código. Puedes editarlo, romperlo, adaptarlo a tu marca.
- No hay versionado de librería ni breaking changes. Solo es código tuyo.
- Internamente usa **Radix UI** (primitivas accesibles sin estilo) + **Tailwind** (estilos).

Esto resuelve el típico drama de "quiero cambiar X de la librería pero el equipo solo expone estos props". Aquí: edita el archivo y ya.

## ¿Para qué lo usamos?

Para componentes de UI que necesitan accesibilidad y comportamiento complejo:

- **Modals / Dialogs** (subir vídeo, confirmar borrado).
- **Dropdowns / Select**.
- **Tabs**, **Accordion**.
- **Toast** (notificaciones).
- **Forms** (con react-hook-form).
- **Tablas** con sort/filter/pagination.
- **Date pickers**.

Todo construido sobre Radix + estilizado con Tailwind, configurable por CSS variables.

## Cómo se añade un componente

```powershell
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
```

El CLI mete el archivo en `src/components/ui/`. Lo importas:

```tsx
import { Button } from "@/components/ui/button";
```

Si lo necesitas distinto, **editas el archivo**. Es tuyo.

## Alternativas que valoramos

- **Material UI / MUI**: muy completo. Look corporativo, difícil de personalizar sin pelearte. Pesado.
- **Chakra UI**: ergonomía buena, look propio. Menos flexibilidad que shadcn.
- **HeadlessUI**: solo primitivas (sin estilo). shadcn ya hace eso por debajo (Radix).
- **Mantine**: librería completa, muy buena. Si quisiéramos algo más "todo incluido", sería opción.

shadcn gana por la combinación **propiedad del código + Tailwind nativo + accesibilidad de Radix**.

## Enlaces

- [Sitio oficial](https://ui.shadcn.com)
- [Galería de componentes](https://ui.shadcn.com/docs/components)
- [Radix UI (primitivas que usa por dentro)](https://www.radix-ui.com)
