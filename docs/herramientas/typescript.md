# TypeScript

## ¿Qué es?

TypeScript es **JavaScript con tipos**. Le añades anotaciones al código (`name: string`, `age: number`) y un compilador (`tsc`) verifica que todo encaje **antes de ejecutar**.

Lo escribes igual que JavaScript, pero el editor te avisa cuando llamas a una función con argumentos del tipo equivocado, o cuando intentas leer una propiedad que no existe en un objeto. La mayoría de bugs "tontos" desaparecen.

Cuando se ejecuta, los tipos se borran y queda JavaScript normal. **El navegador y Node nunca ven TypeScript**, solo el código tras compilar.

## ¿Para qué lo usamos?

Es el **lenguaje principal del proyecto**. Todo el código de la app (`src/`), el schema de Prisma (que genera tipos TS), la validación con Zod (que también genera tipos), la configuración de VitePress... todo es TS.

Llevamos el `strict: true` activado y además:

- `noUncheckedIndexedAccess`: cuando accedes a un array por índice, el resultado es `T | undefined` (no `T`). Te obliga a comprobar que existe.
- `noImplicitOverride`: te obliga a marcar con `override` los métodos que sobrescriben uno del padre.
- `noFallthroughCasesInSwitch`: prohíbe `case` sin `break` (fuente clásica de bugs).

## Alternativas que valoramos

- **JavaScript "a secas"**: rápido al principio, doloroso al crecer. Sin tipos, refactors y errores de typo se descubren en producción.
- **Flow**: el equivalente de Facebook. Hace tiempo que TS ganó la guerra.

## Enlaces

- [Sitio oficial](https://www.typescriptlang.org)
- [TS Handbook (manual)](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TS Playground (probar código en el navegador)](https://www.typescriptlang.org/play)
