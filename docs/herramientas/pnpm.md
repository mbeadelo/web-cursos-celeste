# pnpm

## ¿Qué es?

pnpm es un **gestor de paquetes para Node.js**. Hace lo mismo que `npm` o `yarn`: instala dependencias, ejecuta scripts del `package.json`, gestiona el `lockfile`.

La diferencia clave es **cómo guarda los paquetes en disco**:

- **npm/yarn**: cada proyecto tiene su `node_modules` con copias completas de cada librería. Si tienes 10 proyectos con React, tienes React 10 veces en disco.
- **pnpm**: guarda **una sola copia** de cada librería en un store global (`~/.pnpm-store/`). Cada `node_modules` son **enlaces simbólicos** al store. Mismo React → mismo archivo en disco.

Resultado:

- **2-3x más rápido** que npm en instalaciones repetidas (cache global).
- **Mucho menos espacio en disco**.
- **Lockfile más estricto**: pnpm es más severo con resolución de dependencias, lo que detecta problemas que npm ignora.

## ¿Para qué lo usamos?

Es nuestro gestor de paquetes. Todos los comandos van con `pnpm`:

```powershell
pnpm install               # instalar todo según package.json
pnpm add <paquete>         # añadir dep de runtime
pnpm add -D <paquete>      # añadir dep de desarrollo
pnpm remove <paquete>      # quitar
pnpm update                # actualizar a las últimas versiones permitidas
pnpm dev                   # ejecutar el script "dev" del package.json
pnpm exec <comando>        # ejecutar binario instalado en node_modules/.bin
pnpm dlx <paquete>         # ejecutar paquete sin instalarlo (como npx)
```

## Configuración propia del proyecto

Hay dos cosas no triviales en nuestro `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "@prisma/client",
    "@prisma/engines",
    "esbuild",
    "prisma"
  ]
}
```

pnpm 10 **bloquea por defecto** los scripts de `postinstall` de las dependencias (medida de seguridad anti supply-chain attacks). Aquí declaramos cuáles confiamos para que ejecuten su `postinstall` (necesario para que Prisma compile su engine y esbuild se descargue su binario).

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

El `postinstall` del **propio proyecto** sí corre siempre. Lo usamos para regenerar el cliente Prisma tras cada `pnpm install`, así CI (Vercel) tiene los tipos.

## Alternativas que valoramos

- **npm**: el oficial. Funciona, más lento, más espacio.
- **yarn (v1 / classic)**: rápido para su época, no se mantiene activamente.
- **yarn (v2+, "Berry")**: nuevo enfoque (Plug'n'Play). Polémico, complica integración con muchas tools.
- **bun**: muy rápido, intenta reemplazar Node. Joven, no maduro para producción de empresa.

## Enlaces

- [Sitio oficial](https://pnpm.io)
- [Documentación](https://pnpm.io/motivation)
