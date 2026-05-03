# Volta

## ¿Qué es?

Volta es un **gestor de versiones de Node.js**. Te permite tener varias versiones de Node instaladas y cambiar entre ellas según el proyecto.

¿Por qué importa? Porque:

- Distintos proyectos pueden requerir distintas versiones de Node (uno tira con 18, otro necesita 22).
- Sin gestor, tienes que reinstalar Node manualmente cada vez. Doloroso.
- Volta cambia automáticamente la versión al `cd` al proyecto.

¿En qué se diferencia de **nvm**?

- Volta es **multiplataforma** (Windows, Mac, Linux) — nvm Windows es un proyecto separado, no muy mantenido.
- Volta cambia la versión **automáticamente sin shells hooks**. nvm requiere `nvm use` cada vez.
- Volta es nativo (escrito en Rust) — más rápido.
- Volta lee la versión del `package.json` (`volta.node`) y la fija al proyecto.

## ¿Para qué lo usamos?

Para **fijar la versión de Node al proyecto**. Cualquiera (tú, otro dev, CI) que entre al repo usa exactamente Node 22.

```powershell
volta install node@22       # instala Node 22
volta pin node@22           # lo fija en package.json para este proyecto
```

En `package.json`:

```json
{
  "volta": {
    "node": "22.22.2"
  }
}
```

Cuando hagas `cd` al proyecto, Volta usa Node 22 sin pensarlo. Si vas a otro proyecto con Node 18, también lo cambia solo.

## ¿Y pnpm?

Volta solo soporta `node` y `yarn` para pinning. **pnpm** lo instalas con Volta (`volta install pnpm`) pero no lo fijas en `package.json` con `volta pin`. La versión la pone Volta a nivel global.

Esto fue precisamente el cuello de botella en Fase 0: el `pnpm` instalado por corepack apuntaba al Node viejo. Solución: instalar pnpm vía Volta para que use la versión correcta.

## Alternativas que valoramos

- **nvm-windows**: específico Windows, menos features.
- **fnm**: alternativa moderna, también en Rust. Comparable.
- **asdf**: gestor de versiones para muchísimos lenguajes (Ruby, Python, Node, etc.). Más complejo si solo necesitas Node.
- **Instalador oficial de Node**: solo te deja una versión. Se queda corto en cualquier escenario multi-proyecto.

## Enlaces

- [Sitio oficial](https://volta.sh)
- [Documentación](https://docs.volta.sh)
