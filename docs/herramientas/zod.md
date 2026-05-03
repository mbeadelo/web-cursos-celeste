# Zod

## ¿Qué es?

Zod es una **librería de validación de datos para TypeScript**. Defines un schema una vez y obtienes:

1. **Validación en runtime**: Zod verifica que el dato cuadra con el schema.
2. **Tipo TypeScript inferido**: el tipo se genera automáticamente del schema.

Ejemplo:

```ts
import { z } from "zod";

const UserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
  role: z.enum(["STUDENT", "ADMIN"]),
});

type User = z.infer<typeof UserSchema>;
// User es { email: string; age: number; role: "STUDENT" | "ADMIN" }

const result = UserSchema.parse(datoCualquiera);
// Si no cuadra: throw con error detallado.
// Si cuadra: result tiene tipo User.
```

Resuelve un problema concreto de TypeScript: **TS solo valida en compile-time**. Si te llega un JSON de un fetch, TS confía en que tiene la forma que dijiste, pero en realidad el servidor podría devolver basura. Zod valida que sí lo tiene.

## ¿Para qué lo usamos?

- **Variables de entorno**: `src/lib/env.ts` valida `process.env` con Zod al boot. Si falta `DATABASE_URL`, la app **no arranca**, no falla en runtime al primer query.
- **Formularios**: cada form valida con Zod (vía `react-hook-form` + `@hookform/resolvers/zod`). Mismo schema en client y server.
- **Webhooks**: el body que manda Stripe se parsea y valida con Zod antes de tocarlo.
- **Server Actions**: input validado con Zod antes de hacer queries.

## Patrón típico

```ts
// Schema compartido entre cliente y servidor
export const CreateCourseSchema = z.object({
  title: z.string().min(3),
  priceCents: z.number().int().positive(),
});

// Tipo derivado
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;

// En el server action
"use server";
export async function createCourse(input: unknown) {
  const data = CreateCourseSchema.parse(input);
  // data ya está tipado y validado
  await db.course.create({ data });
}
```

## Alternativas que valoramos

- **Yup**: el clásico. API menos elegante, sin inferencia de tipos.
- **Joi**: muy completo, ecosistema Node, sin tipos TS de primera clase.
- **Valibot**: bundle más pequeño, API muy similar. Joven todavía.
- **TypeBox**: bonito, basado en JSON Schema. Menos popular.

Zod es **el estándar de facto en el mundo TS** ahora mismo. Decisión fácil.

## Enlaces

- [Sitio oficial](https://zod.dev)
- [Documentación](https://zod.dev/)
