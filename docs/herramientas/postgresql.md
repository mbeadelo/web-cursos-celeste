# PostgreSQL

## ¿Qué es?

PostgreSQL (a veces "Postgres") es una **base de datos relacional** open source. Es probablemente la mejor base de datos relacional de propósito general que existe hoy.

"Relacional" significa que los datos se guardan en **tablas con columnas y tipos definidos** (`Users.email VARCHAR(255)`), y entre tablas hay **relaciones** (un `Order` pertenece a un `User` y a un `Course`). Antes de insertar, la DB verifica que los tipos cuadran y que las relaciones existen.

Otras DBs relacionales: MySQL, SQL Server, SQLite. Postgres destaca por:

- **Tipos avanzados**: JSON, arrays, vectores, tipos geográficos, enums.
- **Transacciones reales**: si algo falla a medio camino, todo vuelve atrás.
- **Estabilidad**: lleva 30 años madurando.
- **Ecosistema**: extensiones para todo (full-text search, vector search, time series).

## ¿Para qué lo usamos?

Es **la única base de datos** del proyecto. Almacena usuarios, cursos, lecciones, matrículas, pedidos, eventos de Stripe, sesiones de Auth.js… todo.

No la corremos directamente — la accedemos a través de [Prisma](/herramientas/prisma) y la hospedamos en [Neon](/herramientas/neon).

## ¿Por qué relacional y no NoSQL?

Los datos del proyecto son **muy relacionales**: un alumno tiene matrículas, una matrícula es de un curso, un curso tiene lecciones, una compra genera una matrícula… Forzar esto a Mongo/DynamoDB sería trabajo extra para perder integridad.

## Alternativas que valoramos

- **MySQL**: similar, ecosistema enorme, pero Postgres tiene tipos y features más ricos.
- **SQLite**: perfecto para apps locales o muy pequeñas. No serverless.
- **MongoDB / DynamoDB**: NoSQL. Buenas para casos sin relaciones complejas. No es nuestro caso.

## Enlaces

- [Sitio oficial](https://www.postgresql.org)
- [Documentación](https://www.postgresql.org/docs/current/)
