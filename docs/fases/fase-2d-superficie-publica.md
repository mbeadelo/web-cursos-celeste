# Fase 2d — Superficie pública + primera pasada de marca

> **Objetivo**: dar al producto una superficie pública navegable (home + catálogo + detalle de curso) y una identidad visual mínima alineada con la marca "Bienvenido a tu plaza".

> **Estado**: ✅ Andamiaje funcional + tipografía Inter + tokens de paleta editables. Pendiente de ajustar hex finales con el usuario y diseño profundo del hero/catálogo.

## Por qué esta fase antes de Stripe

El roadmap original ponía Stripe después del admin. Reordenamos al detectar que la cliente real (la prometida del dev) ya tiene una cartera de alumnos pagando off-line. La urgencia no es cobrar online — es **darle a esos alumnos un sitio donde consumir el contenido y captar nuevos vía web**.

Conclusión: la superficie pública es palanca de captación. Stripe puede esperar; sin catálogo no hay nada que vender.

## Andamiaje (rutas nuevas)

| Ruta | Función |
|---|---|
| `/` | Home rica estilo Udemy + portfolio: hero con badges, stats strip, carrusel de cursos destacados, sección "Sobre mí", grid de features, CTA final con gradient, footer mínimo |
| `/cursos` | Catálogo público — grid de cards con cover, título, descripción truncada, precio. Solo cursos `published: true` |
| `/cursos/[slug]` | Detalle del curso — cover grande, descripción, lista de lecciones (títulos + tipo, sin acceso al contenido), aside con precio + CTA según estado |

### Estructura de la home

1. **Hero** con badge ("Cursos online · Acceso permanente"), titular con gradient en "tu plaza", descripción y CTAs (Ver cursos primario, Acceder secundario).
2. **Stats strip** — 4 mini-stats sobre fondo blanco con ring (alumnos, cursos, acceso ilimitado, a tu ritmo). Valores hardcoded de momento; cuando haya datos reales se podrán enchufar a queries (count de Enrollment, count de Course, etc.).
3. **Cursos destacados** (`<FeaturedCourses />`) — carrusel horizontal con `scroll-snap-type: x mandatory`, sin dependencias JS. Lista los 8 publicados más recientes; si hay menos de 6, rellena con cards demo (badge "Demo" en esquina) para que la sección no se vea vacía durante el bootstrap.
4. **Sobre mí** (`<AboutMe />`) — retrato circular con halo gradient celeste→magenta, lorem ipsum en español pidiendo refactor con copy real. Fondo levemente celeste para separar del resto.
5. **Por qué esta plaza** — 3 features con disco gradient y hover ring celeste.
6. **CTA final** — bloque con gradient celeste→magenta full y botones contrastados.
7. **Footer mínimo** — copyright + nav.

### Imágenes de prueba

`public/demo/` contiene 6 covers (`course-1.jpg` … `course-6.jpg`) + un retrato (`portrait.jpg`), todos descargados de [picsum.photos](https://picsum.photos) con seeds estables (las URLs se resuelven a las mismas imágenes en cada build). Sustituibles cuando lleguen los assets reales — solo cambiar archivos.

### CTA de detalle según estado de sesión

| Estado | Botón |
|---|---|
| No logueado | "Acceder para comprar" → `/login` |
| Logueado, no enrolado | "Comprar (próximamente)" deshabilitado (Stripe llega en Fase 3) |
| Logueado, enrolado | "Ir al curso" → `/dashboard` |

## Componentes nuevos

```
src/components/public-header.tsx     Header compartido (logo + nav Cursos + Acceder/Mis cursos)
src/components/featured-courses.tsx  Carrusel scroll-snap con publicados + demos
src/components/about-me.tsx          Sección "Sobre mí" con lorem ipsum
src/app/page.tsx                     Home (rediseñada)
src/app/cursos/page.tsx              Catálogo
src/app/cursos/[slug]/page.tsx       Detalle de curso
```

### Detalle: enrollment lookup

`/cursos/[slug]` consulta `enrollment.findUnique({ where: { userId_courseId: ... } })` para decidir el CTA. Esto **solo se ejecuta si hay sesión** — usuarios anónimos no pegan a la DB extra.

### Cover fallback

Si un curso publicado no tiene `coverUrl` (no debería pasar, pero defensivo), se renderiza un degradado celeste→magenta como placeholder. Diseño coherente con la marca aunque no haya imagen.

## Tipografía: Inter

Sustituí Geist por **Inter** ([fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter)).

Por qué Inter sobre alternativas:
- Hyper-legible a cualquier tamaño (criterio del usuario: "legible y directa").
- Optimizada para pantallas, neutra, con personalidad sutil.
- Variable font → un solo archivo cubre todos los pesos.
- Cargada via `next/font/google` → self-hosted en build, sin requests a Google en runtime.
- Geist (default Next) es demasiado genérica y tiene un look "AI startup" muy quemado.

```ts
// src/app/layout.tsx
import { Inter, Geist_Mono } from "next/font/google";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"], display: "swap" });
```

Geist Mono se queda como tipografía monospace (para código en docs/admin).

## Paleta de marca

Tres colores acordados con el usuario:
- **Azul celeste** — color principal, evocativo del nombre "celeste" en el repo.
- **Morado tirando a rosa** — acento secundario.
- **Blanco** — fondos / negativo.

### Tokens CSS

Definidos en `src/app/globals.css` como variables OKLCH para facilitar ajuste fino:

```css
:root {
  --brand-celeste: oklch(0.74 0.13 225);
  --brand-celeste-deep: oklch(0.62 0.16 230);   /* hover/active */
  --brand-celeste-foreground: oklch(1 0 0);     /* texto sobre celeste */
  --brand-magenta: oklch(0.66 0.24 325);
  --brand-magenta-deep: oklch(0.55 0.27 325);
  --brand-magenta-foreground: oklch(1 0 0);
}
```

Y expuestos a Tailwind como utilities (`bg-brand-celeste`, `text-brand-magenta`, etc.) en el bloque `@theme inline`.

### Por qué OKLCH

OKLCH es un espacio de color **perceptualmente uniforme** — pasar de `0.74 0.13 225` a `0.62 0.16 230` aclara/oscurece de forma visualmente lineal, cosa que con HSL no pasa. Permite generar variantes (hover, disabled) cambiando solo la luminancia (primer número).

Si prefieres trabajar con HEX:
- Sustituye `oklch(...)` por `#xxxxxx` directamente.
- Los tokens son CSS variables — todo el sistema se reajusta solo.

### Dónde se aplica la paleta

| Elemento | Token |
|---|---|
| Punto en logo del header | `bg-brand-celeste` |
| CTAs primarios (Ver cursos, Acceder, Mis cursos, Comprar) | `bg-brand-celeste` + `hover:bg-brand-celeste-deep` |
| Acento gradient en "tu plaza" del hero | `from-brand-celeste to-brand-magenta` |
| Precio en cards y detalle | `text-brand-celeste-deep` |
| Fallback de cover ausente | `from-brand-celeste/20 to-brand-magenta/20` |
| Hover ring de cards en catálogo | `ring-brand-celeste/40` |
| Focus ring (accesibilidad) | `focus-visible:ring-brand-celeste` |

Cards y elementos secundarios siguen con shadcn defaults — la paleta se queda en CTAs, acentos y feedback de interacción para no abrumar.

## Próximos pasos de diseño (pendientes con usuario)

- **Confirmar hex exactos** de celeste y magenta. Los OKLCH actuales son una aproximación razonable.
- **Logos**: el usuario los tiene; integrarlos en header (sustituir el "•" por logo SVG) y posiblemente en hero.
- **Sustituir lorem ipsum** del "Sobre mí" por bio real de la cliente.
- **Sustituir imágenes demo** de `public/demo/` cuando lleguen covers reales o cuando la cliente publique más cursos (los demos solo aparecen como relleno).
- **Stats reales en la home** — ahora son hardcoded (`100+`, `6`, etc.). Convertir a queries (`count` de Enrollment, Course, etc.) cuando tenga sentido.
- **Sección de testimonios** — pendiente. Probablemente tras lanzar.
- **Footer ampliado** con legal (privacidad, términos) cuando lleguen.
- **Pulir admin** — sigue con shadcn defaults sin paleta. Tarea más adelante.

## Decisiones que dejé tomadas

1. **No repintar shadcn `--primary`** — habría afectado al admin entero. Mejor introducir tokens `--brand-*` separados para tener control quirúrgico.
2. **CTAs como `<Link>` plano en vez de `<Button>`** en el detalle del curso — el componente Button de shadcn impone radius/padding estándar; queremos pildorillas redondeadas (`rounded-full`) en el header pero `rounded-md` en el aside del detalle. Simplificar evita peleas con `render` prop de Base UI.
3. **Inter sobre Geist** — Geist viene de Vercel y empieza a sentirse genérica.
4. **Gradient text en "tu plaza"** — único acento llamativo. El resto de la home queda calmado para no competir.
5. **Sin dark mode todavía** — los tokens dark están en `globals.css` (heredados de shadcn) pero los `--brand-*` no tienen variante dark. Cuando se necesite, ajustar luminancia (mover la `L` de OKLCH ~10% para arriba y bajar saturación ligeramente).

## Verificación

```powershell
pnpm dev
# Visita:
#   http://localhost:3000/
#   http://localhost:3000/cursos
#   http://localhost:3000/cursos/<slug-de-un-curso-publicado>
#   http://localhost:3000/cursos/no-existe   # debe dar 404
```

TypeScript y lint limpios. Smoke test desde curl: `/`, `/cursos` → 200; `/cursos/no-existe` → 404.
