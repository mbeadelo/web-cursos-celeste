# Prisma

## ¿Qué es?

Prisma es un **ORM** (Object-Relational Mapper) para Node.js. Su trabajo es ser la capa entre tu código TypeScript y una base de datos relacional como PostgreSQL.

En lugar de escribir SQL a mano (`SELECT * FROM users WHERE id = ?`), escribes:

```ts
const user = await db.user.findUnique({ where: { id: "abc" } });
```

Y Prisma:

1. Genera el SQL correcto.
2. Devuelve el resultado tipado (TypeScript sabe que `user.email` es un `string`).
3. Si te equivocas en un campo, te lo dice **al compilar**, no en producción.

Tiene 3 piezas:

- **`schema.prisma`**: archivo único donde defines todos los modelos (tablas) en un lenguaje propio. Vive en `prisma/schema.prisma`.
- **Migraciones**: cada cambio del schema genera un `.sql` (en `prisma/migrations/`) que se aplica en orden. Versionas el SQL en git, se aplica en orden en cualquier entorno.
- **Cliente generado**: a partir del schema, Prisma genera código TypeScript específico para tus tablas. Vive en `src/generated/prisma/` (gitignored, se regenera).

## Comandos clave

```powershell
pnpm exec prisma migrate dev --name <nombre>    # cambia el schema y genera migración
pnpm exec prisma migrate deploy                 # aplica migraciones existentes (CI / prod)
pnpm exec prisma generate                       # regenera el cliente (sin migrar)
pnpm exec prisma studio                         # GUI tipo phpMyAdmin para inspeccionar la DB
pnpm exec prisma format                         # formatea schema.prisma
```

## ¿Para qué lo usamos?

Para **toda la lógica de base de datos**. El cliente se importa desde `@/lib/db` como `db` y se usa en server components, server actions y route handlers.

Versión: **Prisma 7** (la actual). Importante porque:

- Generador nuevo (`prisma-client`) con ESM.
- Requiere un **adapter** de driver explícito (`@prisma/adapter-pg`).
- Output del cliente en `src/generated/prisma/`, no en `node_modules`.

## Alternativas que valoramos

- **Drizzle**: más cercano a SQL, schemas en TS puro. Excelente, pero migraciones y workflow de Prisma son algo más maduros.
- **TypeORM**: más viejo, sintaxis con decoradores, menos popular hoy.
- **SQL crudo (con `pg`)**: máximo control, mínima ergonomía. Para un MVP es trabajo extra.

## Enlaces

- [Sitio oficial](https://www.prisma.io)
- [Documentación](https://www.prisma.io/docs)
- [Schema reference (sintaxis de schema.prisma)](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
