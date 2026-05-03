---
layout: home
hero:
  name: "Bienvenido a tu plaza"
  text: "Documentación técnica"
  tagline: "Plataforma de cursos online — stack, arquitectura, herramientas y bitácora de fases."
  actions:
    - theme: brand
      text: Ver arquitectura
      link: /arquitectura
    - theme: alt
      text: Operativa diaria
      link: /operativa
    - theme: alt
      text: Herramientas
      link: /herramientas/

features:
  - icon: 🎓
    title: ¿Qué es esto?
    details: Una plataforma para vender cursos online. Vídeo + PDFs + ejercicios. Pagos con Stripe y panel de administración.
  - icon: 🧭
    title: ¿Por dónde empezar?
    details: Si no conoces el stack, empieza por Herramientas. Si quieres ver el conjunto, ve a Arquitectura. Si necesitas comandos del día a día, ve a Operativa.
  - icon: 🪜
    title: ¿Cómo avanzamos?
    details: Por fases. Cada fase termina cuando hay algo desplegado y verificable. Después de cada fase se actualiza esta documentación.
---

## Estado actual

- **Marca**: Bienvenido a tu plaza
- **Dominio**: `bienvenidoatuplaza.com` (aún sin apuntar a Vercel)
- **Repo**: `web-cursos-celeste` en GitHub
- **Despliegue**: producción en `web-cursos-celeste.vercel.app`
- **Fase actual**: Fase 1 completada. Login con magic link en producción. Lista para Fase 2 (admin CRUD de cursos).

## Mapa rápido

| Sección | ¿Cuándo consultarla? |
|---|---|
| [Arquitectura](/arquitectura) | Quiero ver el sistema entero de un vistazo |
| [Herramientas](/herramientas/) | Qué es X y por qué lo usamos |
| [Decisiones](/decisiones) | Por qué elegimos X en lugar de Y |
| [Operativa](/operativa) | Comandos para desarrollar día a día |
| [Fase 0](/fases/fase-0-setup) | Qué se hizo en el setup inicial |
| [Fase 1](/fases/fase-1-auth) | Auth.js + magic link + roles |
