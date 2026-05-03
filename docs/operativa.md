# Operativa diaria

Comandos y flujos que vas a usar todos los días.

## Arrancar el entorno de desarrollo

```powershell
# 1. Ir al proyecto
cd D:\web-cursos-celeste

# 2. (Solo si has tirado del repo o cambiado deps)
pnpm install

# 3. Servidor de desarrollo
pnpm dev
```

Abre http://localhost:3000.

## Documentación (esta web)

```powershell
# Modo dev (hot reload)
pnpm docs:dev
```

Abre http://localhost:5173.

```powershell
# Build estático (genera HTML en docs/.vitepress/dist/)
pnpm docs:build

# Servir el build local para verlo igual que en producción
pnpm docs:preview
```

## Prisma (base de datos)

```powershell
# Crear una nueva migración a partir de cambios en schema.prisma
pnpm exec prisma migrate dev --name <nombre-corto>

# Aplicar migraciones existentes en otra máquina (CI, otro dev)
pnpm exec prisma migrate deploy

# Regenerar el cliente TS tras cambiar el schema (lo hace migrate dev solo)
pnpm exec prisma generate

# Formatear schema.prisma (ordena, alinea columnas)
pnpm exec prisma format

# GUI para inspeccionar la base de datos
pnpm exec prisma studio
```

## Stripe (a partir de Fase 3)

```powershell
# Reenviar webhooks de Stripe a tu localhost mientras desarrollas
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copia el `whsec_...` que imprime al arrancar y pégalo en `.env` como `STRIPE_WEBHOOK_SECRET`.

```powershell
# Disparar manualmente un evento de prueba
stripe trigger checkout.session.completed
```

## Git y commits

```powershell
git status                  # qué ha cambiado
git diff                    # ver cambios sin stagear
git add <archivo>           # stagear archivos concretos (mejor que git add .)
git commit -m "mensaje"     # commit
git push                    # subir a GitHub
```

**Convención de mensajes**: `tipo: descripción corta` en imperativo. Tipos comunes:

- `feat:` nueva funcionalidad
- `fix:` bug fix
- `chore:` mantenimiento (deps, configs)
- `docs:` solo documentación
- `refactor:` cambios sin alterar comportamiento
- `test:` solo tests

Ejemplo: `feat: añadir checkout con Stripe`.

## Variables de entorno

| Archivo | Para qué | ¿Versionado? |
|---|---|---|
| `.env.example` | Plantilla con todas las vars que existen | ✅ sí |
| `.env` | Valores reales locales (DEV) | ❌ NO (gitignored) |
| Vercel env vars | Valores reales de producción | gestionado en su panel |

Cuando añadas una nueva variable:

1. Añádela a `src/lib/env.ts` (validación con Zod).
2. Añádela a `.env.example` con descripción.
3. Añádela a tu `.env` local con el valor real.
4. Añádela en Vercel → Settings → Environment Variables.

## Troubleshooting

### "Cannot find module '@/generated/prisma/client'"
Falta generar el cliente Prisma. Ejecuta:
```powershell
pnpm exec prisma generate
```

### El build de Vercel falla
Revisa los logs en Vercel. Causas más comunes:
- Falta una env var en Vercel.
- Una migración de DB no aplicada todavía.
- TypeScript: revisa errores en local con `pnpm exec tsc --noEmit`.

### "Invalid environment variables"
`src/lib/env.ts` está validando con Zod y faltan o son inválidas. El error te dice cuáles.

### El webhook de Stripe no llega
- ¿Está corriendo `stripe listen`?
- ¿El `STRIPE_WEBHOOK_SECRET` del `.env` es el del comando `stripe listen` actual? (cambia cada vez que lo arrancas).

## Despliegue

No hay despliegue manual. Push a `main` → Vercel despliega automáticamente.

Para un PR: push a una rama → Vercel crea un preview deploy con URL única.
