# Plan de 5 días: Dockerización de Gaming Solutions Admin

**Meta:** correr en local con Docker Compose tres capas aisladas y comunicadas por red: **Base de datos → Backend → Frontend**, más un componente de soporte (PostgREST) que explico en el diagnóstico. **Dedicación:** 4–6 h por día. **Asumo:** Docker Desktop con Compose v2 (`docker compose`, sin guion). Los comandos son para bash (Git Bash o WSL en Windows).

## 0. Diagnóstico de tu proyecto

| Capa | Qué encontré |
| --- | --- |
| Backend | Node.js + Express 4 (CommonJS). Entrada `src/server.js`, routers en `src/routes/`, JWT + bcrypt en `src/middleware/auth.js`. Sin paso de build. |
| Frontend | HTML/CSS/JS vanilla en `public/` (no hay React ni Vite, así que no hay build). Hoy lo sirve el propio Express. Llama a la API con rutas relativas `/api/...` y `public/js/auth.js` les añade el token. |
| Base de datos | Tu `.env` apunta a **Supabase (PostgreSQL en la nube)**. El código también conserva un modo Oracle/ORDS heredado (el zip no trae DDL de Oracle) y un modo demo. **Decisión: PostgreSQL 16.** |
| Móvil | `android/` + Capacitor apuntan a Vercel (`server.url`). Queda fuera del alcance y no se modifica. |

El backend usa 9 tablas y 2 funciones RPC (`registrar_venta`, `registrar_compra`) definidas en `sql/10_supabase_schema.sql`.

### Hallazgos que cambian el plan

1. **El backend no se conecta a Postgres por SQL.** Usa `@supabase/supabase-js`, que habla HTTP con **PostgREST** bajo la ruta `/rest/v1`. Un contenedor PostgreSQL solo no basta: hace falta PostgREST (contenedor ligero de soporte) y un parche de 8 líneas en el cliente (Día 2). Es la opción de menor riesgo frente a reescribir \~420 líneas de `supabase-api.js` con el driver `pg`.
2. **El esquema no corre en PostgreSQL estándar.** Falla en la línea 327 (`role "anon" does not exist`) porque usa roles propios de Supabase (`anon`, `authenticated`). Lo reproduje. Solución: script de roles (Día 1).
3. **`sql/datos.sql` está roto** y abortaría la inicialización del contenedor: usa `ON CONFLICT (sku)` pero `productos.sku` no tiene restricción UNIQUE, y tras el INSERT de productos quedan líneas sueltas (`6` y `);`).
4. **El hash del admin del seed no corresponde a `Admin123*`**, aunque el comentario lo afirma (lo comprobé con bcryptjs). Con ese seed nadie podría iniciar sesión. Solución: fijar la clave al inicializar (Día 1).
5. **Permisos de las funciones.** El esquema hace `REVOKE EXECUTE ... FROM PUBLIC` en las dos funciones RPC; hay que volver a otorgarlas a `service_role` o las ventas fallan con permiso denegado.
6. **Seguridad.** Tu `.env` contiene una `SERVICE_ROLE_KEY` real de Supabase y un `JWT_SECRET`. No está en git (bien), pero va dentro del zip: si lo compartiste, **rótalas**. Además tienes `AUTH_DEMO_MODE=true`, que habilita usuarios fijos (`admin/admin123`…) aunque los datos vengan de la BD; en Docker irá en `false`.
7. **Saltos de línea CRLF.** Tus archivos están en formato Windows. Los scripts `.sh` de inicialización deben ir en LF o fallan dentro de Linux.

### Qué verifiqué y qué no

Reproduje la cadena completa en un entorno de prueba con PostgreSQL 16, PostgREST 12.2.3, nginx y Node 22, ejecutando **tu backend real**: login con hash bcrypt desde la BD, inventario con certificados (trigger), venta transaccional vía RPC que descuenta stock, error 400 por stock insuficiente, 401 sin token, auditoría por trigger, scripts de init bajo `sh` (dash) desde cero, `npm ci --omit=dev` (21 MB) y `oracledb` en modo *thin* (JS puro, no requiere Oracle Instant Client).

**Lo único que no pude ejecutar es Docker** (no hay daemon en mi entorno): los `Dockerfile` y el `docker-compose.yml` están sin probar. Por eso cada día termina con criterios de validación concretos para atrapar cualquier fallo antes de seguir.

## 1. Arquitectura objetivo

```
Navegador ──► web (nginx :80, publicado en :8080)
                 ├─ sirve public/ (estáticos)
                 └─ /api/* ─► api (Express :3000) ─► postgrest (:3000) ─► db (PostgreSQL 16 :5432)
                                                                            └─ volumen gs_pgdata
Redes:  frontend_net = web + api        backend_net (interna) = api + postgrest + db
```

- Solo `web` publica un puerto al host. `db`, `postgrest` y `api` quedan sin exposición (Día 5).
- Navegador y API comparten origen (nginx hace de proxy): **sin CORS y sin tocar el JS del frontend**.
- Dos secretos distintos: `JWT_SECRET` (tokens de los usuarios del panel) y `PGRST_JWT_SECRET` (firma la `service_role` key que usa el backend contra PostgREST).

**Estructura de archivos nuevos:**

```
Proyecto fase 2/
├─ docker-compose.yml
├─ .env.docker              (generado, NO versionar)
├─ .dockerignore · .gitattributes
├─ db/Dockerfile
├─ db/init/   00_roles.sh · 12_fixes.sql · 15_grants.sql · 25_admin_user.sh
├─ docker/    api.Dockerfile · web.Dockerfile · nginx.conf
├─ scripts/   gen-env.js · smoke.sh
└─ sql/       10_supabase_schema.sql · datos.sql (corregido)
```

**Regla de oro:** todos los comandos llevan `--env-file .env.docker`, porque el `.env` actual es el de Supabase en la nube y **no debe** usarse para Compose.

---

## Día 1 — Preparación y contenedor de Base de Datos

**Objetivos**

- Entorno Docker listo y repositorio preparado sin filtrar secretos.
- Contenedor PostgreSQL 16 que se autoinicializa con roles, esquema, datos y un admin con clave real.

**Tareas paso a paso**

1. Verifica herramientas: `docker --version`, `docker compose version`, `docker info` (en Windows, Docker Desktop con WSL2 activo).
2. Crea rama: `git checkout -b feat/docker`.
3. Si compartiste el zip o el `.env`, rota en Supabase la service role key y el `JWT_SECRET`.
4. Crea `.dockerignore` y `.gitattributes`; añade a `.gitignore` las líneas `.env.docker` y `backups/`.
5. Corrige `sql/datos.sql`: tras `ON CONFLICT (sku) DO NOTHING;` borra las dos líneas siguientes (`   6 ` y `);`) y el comentario que promete `Admin123*`. La restricción UNIQUE de `sku` se añade en `12_fixes.sql`.
6. Crea los archivos de `db/` y `scripts/gen-env.js` (abajo).
7. Crea un `docker-compose.yml` mínimo solo con `db` (abajo).
8. Genera secretos, construye y levanta.

**Archivos de configuración**

`.dockerignore`

```
.git
.github
node_modules
android
data
.env
.env.*
!.env.docker.example
*.md
*.http
npm-debug.log*
```

`.gitattributes` (si ya hiciste commit de `.sh` con CRLF: `git add --renormalize .`)

```
*.sh   text eol=lf
*.conf text eol=lf
docker/* text eol=lf
db/**  text eol=lf
```

`db/Dockerfile`

```dockerfile
FROM postgres:16-alpine
# El orden alfabético es el orden de ejecución. Solo corren con el volumen VACÍO.
COPY db/init/00_roles.sh        /docker-entrypoint-initdb.d/00_roles.sh
COPY sql/10_supabase_schema.sql /docker-entrypoint-initdb.d/10_supabase_schema.sql
COPY db/init/12_fixes.sql       /docker-entrypoint-initdb.d/12_fixes.sql
COPY db/init/15_grants.sql      /docker-entrypoint-initdb.d/15_grants.sql
COPY sql/datos.sql              /docker-entrypoint-initdb.d/20_datos.sql
COPY db/init/25_admin_user.sh   /docker-entrypoint-initdb.d/25_admin_user.sh
```

`db/init/00_roles.sh` (roles que el esquema y PostgREST esperan)

```sh
#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE anon          NOLOGIN NOINHERIT;
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
  CREATE ROLE service_role  NOLOGIN NOINHERIT BYPASSRLS;
  CREATE ROLE authenticator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
         PASSWORD '${AUTHENTICATOR_PASSWORD}';
  GRANT anon, authenticated, service_role TO authenticator;
EOSQL
```

`db/init/12_fixes.sql`

```sql
-- datos.sql usa ON CONFLICT (sku) y el backend ya traduce el error 23505 como "NIT, DPI o SKU duplicado".
ALTER TABLE productos ADD CONSTRAINT uq_productos_sku UNIQUE (sku);
```

`db/init/15_grants.sql` (solo `service_role` toca el esquema; `anon` no puede nada)

```sql
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
-- El esquema hace REVOKE ... FROM PUBLIC en registrar_venta/registrar_compra: hay que re-otorgar.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
```

`db/init/25_admin_user.sh` (hash bcrypt `$2a$` compatible con bcryptjs; no se guarda la clave en ningún archivo)

```sh
#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  UPDATE usuarios SET clave_hash = crypt('${ADMIN_INITIAL_PASSWORD}', gen_salt('bf', 10)) WHERE username = 'admin';
  DROP EXTENSION pgcrypto;
EOSQL
```

`scripts/gen-env.js` (solo usa módulos nativos de Node; todo en hex para que las claves no necesiten URL-encoding)

```js
const c = require('node:crypto');
const hex = n => c.randomBytes(n).toString('hex');
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');

const pgrstSecret = hex(32); // 64 caracteres (PostgREST exige >= 32)
const now = Math.floor(Date.now() / 1000);
const head = b64u({ alg: 'HS256', typ: 'JWT' });
const body = b64u({ role: 'service_role', iss: 'gs-local', iat: now, exp: now + 10 * 365 * 24 * 3600 });
const sig = c.createHmac('sha256', pgrstSecret).update(`${head}.${body}`).digest('base64url');

console.log(`# Generado ${new Date().toISOString()} - NO versionar
COMPOSE_PROJECT_NAME=gaming-solutions
POSTGRES_USER=gs_owner
POSTGRES_PASSWORD=${hex(16)}
POSTGRES_DB=gamingsolutions
AUTHENTICATOR_PASSWORD=${hex(16)}
PGRST_JWT_SECRET=${pgrstSecret}
SERVICE_ROLE_KEY=${head}.${body}.${sig}
JWT_SECRET=${hex(32)}
ADMIN_INITIAL_PASSWORD=${hex(8)}
AUTH_DEMO_MODE=false
WEB_PORT=8080`);
```

`docker-compose.yml` (versión del Día 1: solo la BD)

```yaml
name: gaming-solutions

services:
  db:
    build:
      context: .
      dockerfile: db/Dockerfile
    image: gs-db:local
    container_name: gs-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?requerido}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?requerido}
      POSTGRES_DB: ${POSTGRES_DB:?requerido}
      AUTHENTICATOR_PASSWORD: ${AUTHENTICATOR_PASSWORD:?requerido}
      ADMIN_INITIAL_PASSWORD: ${ADMIN_INITIAL_PASSWORD:?requerido}
    volumes:
      - gs_pgdata:/var/lib/postgresql/data
    ports:
      - '127.0.0.1:5432:5432'   # SOLO depuración: se elimina el Día 5
    healthcheck:
      # -h 127.0.0.1 evita un falso "healthy" durante el servidor temporal de init (solo escucha por socket)
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s

volumes:
  gs_pgdata:
```

**Comandos exactos**

```bash
node scripts/gen-env.js > .env.docker
docker compose --env-file .env.docker build db
docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker logs db
docker compose --env-file .env.docker ps
```

> **Windows/PowerShell:** `>` escribe UTF-16 y rompe el env-file. Usa Git Bash/WSL, o `node scripts/gen-env.js | Out-File -Encoding ascii .env.docker`. Sin Node en el host: `docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gen-env.js > .env.docker`.

**Criterios de validación**

```bash
# 1) Sin errores y con los 6 scripts ejecutados (verás "running"/"sourcing" por cada uno)
docker compose --env-file .env.docker logs db | grep -E 'running|sourcing|ERROR'
# 2) 16 tablas
docker compose --env-file .env.docker exec db psql -U gs_owner -d gamingsolutions -At -c 'select count(*) from pg_tables where schemaname = current_schema()'
# 3) Datos semilla
docker compose --env-file .env.docker exec db psql -U gs_owner -d gamingsolutions -c 'select (select count(*) from roles) roles, (select count(*) from categorias) categorias, (select count(*) from productos) productos, (select count(*) from certificados_gs) certificados, (select count(*) from usuarios) usuarios, (select count(*) from bitacora_auditoria) auditoria'
# 4) Roles de acceso
docker compose --env-file .env.docker exec db psql -U gs_owner -d gamingsolutions -c '\du'
```

- `ps` muestra `db` en estado **healthy**.
- (1) no contiene `ERROR`. (2) devuelve `16`.
- (3) devuelve `3 | 4 | 3 | 3 | 1 | 3` (certificados y auditoría los crean triggers: confirma que los triggers funcionan).
- (4) lista `anon`, `authenticated`, `authenticator` y `service_role` (este último con *Bypass RLS*).
- **Persistencia:** `down` (sin `-v`) y `up -d db` → `select count(*) from productos` sigue en `3`.
- **Reinicialización:** `down -v` borra el volumen y los scripts se ejecutan de nuevo.

**Problemas frecuentes**

- `bad interpreter` / `^M` en los `.sh`: CRLF. Aplica `.gitattributes` y `git add --renormalize .`.
- Puerto 5432 ocupado: cambia a `127.0.0.1:5433:5432`.
- **Regla clave:** los scripts de `docker-entrypoint-initdb.d` solo corren con el volumen vacío. Si cambias un script o regeneras `.env.docker`, ejecuta `docker compose --env-file .env.docker down -v`.

**Go/No-Go:** pasas al Día 2 solo si (1)–(4) dan lo esperado.

---

## Día 2 — Capa de acceso a datos: PostgREST y parche del cliente

**Objetivos**

- Contenedor PostgREST que expone la BD con el mismo contrato que Supabase.
- Backend capaz de apuntar a PostgREST local sin cambiar su lógica ni romper el modo nube.

**Alternativas evaluadas**

| Opción | Veredicto |
| --- | --- |
| A. PostgREST + parche de `fetch` en el cliente | **Elegida.** Cambio mínimo, reversible, probada. |
| B. PostgREST + nginx que reescribe `/rest/v1` | Cero cambios de código, pero añade otro contenedor. |
| C. Reescribir `supabase-api.js` con `pg` | 3–5 días y riesgo alto de regresiones. |

**Tareas paso a paso**

1. Añade el servicio `postgrest` al compose (abajo).
2. En `src/supabase-api.js`, función `createSupabaseClient()`, reemplaza la última línea `return createClient(url, key, { auth: {...} });` por el bloque de abajo.
3. Valida sintaxis: `node --check src/supabase-api.js`.
4. Levanta y prueba PostgREST directamente con `curl`.

**Parche** (opt-in: sin `POSTGREST_LOCAL=true` el comportamiento con Supabase nube es idéntico)

```js
  // Docker/local: PostgREST no sirve bajo /rest/v1, pero supabase-js lo añade siempre.
  const localRest = process.env.POSTGREST_LOCAL === 'true';
  const stripRestPrefix = (input, init) => fetch(String(input).replace('/rest/v1/', '/'), init);
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(localRest ? { global: { fetch: stripRestPrefix } } : {})
  });
```

**Servicio a añadir en `docker-compose.yml`** (bajo `services:`)

```yaml
  postgrest:
    image: postgrest/postgrest:v12.2.3
    container_name: gs-postgrest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${AUTHENTICATOR_PASSWORD}@db:5432/${POSTGRES_DB}
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${PGRST_JWT_SECRET:?requerido}
      PGRST_SERVER_PORT: '3000'
    ports:
      - '127.0.0.1:3001:3000'   # SOLO depuración: se elimina el Día 5
```

**Comandos exactos**

```bash
docker compose --env-file .env.docker up -d postgrest
docker compose --env-file .env.docker logs postgrest
set -a; . ./.env.docker; set +a
curl -s -H "Authorization: Bearer $SERVICE_ROLE_KEY" 'http://localhost:3001/roles?select=nombre_rol'
curl -s -H "Authorization: Bearer $SERVICE_ROLE_KEY" 'http://localhost:3001/productos?select=nombre,stock,certificados_gs!certificados_gs_id_producto_fkey(codigo_certificado)'
curl -s -o /dev/null -w 'HTTP %{http_code}' 'http://localhost:3001/roles'; echo
curl -s -w ' HTTP %{http_code}' -X POST -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'Content-Type: application/json' -d '{"p_id_cliente":1,"p_metodo_pago":"EFECTIVO","p_notas":"test","p_usuario":"admin","p_items":[{"productId":1,"quantity":999,"price":1}]}' 'http://localhost:3001/rpc/registrar_venta'; echo
```

**Criterios de validación**

- Los logs muestran `Schema cache loaded` con 16 relaciones y 2 funciones.
- `roles` devuelve los 3 roles (Administrador, Ventas, Almacen).
- La consulta de `productos` devuelve 3 productos, cada uno con su `codigo_certificado` (prueba el *hint* de relación que usa tu código).
- La llamada **sin token** responde `HTTP 401` (el rol `anon` no puede leer nada: se mantiene la seguridad de tu esquema).
- El RPC con cantidad 999 responde **HTTP 400** con un mensaje que contiene `Stock insuficiente` (la función transaccional corre y no deja datos a medias).
- Una clave alterada (añade una letra al final) responde `401`.

**Problemas frecuentes**

- `permission denied for table ...`: no se aplicó `15_grants.sql` → `down -v` y vuelve a levantar.
- `password authentication failed for user "authenticator"`: regeneraste `.env.docker` con el volumen ya creado → `down -v`.
- `PGRST202` (función no encontrada) tras cambiar el esquema: recarga el caché con `docker compose --env-file .env.docker kill -s SIGUSR1 postgrest`.

**Go/No-Go:** pasas al Día 3 solo si los 6 criterios se cumplen.

---

## Día 3 — Contenedor del Backend (API Express)

**Objetivos**

- Imagen reproducible, liviana y **sin secretos**, ejecutada como usuario no-root.
- API comunicada con PostgREST/BD por la red de Docker, con healthcheck real.

**Tareas paso a paso**

1. Crea `docker/api.Dockerfile` (abajo). Instala solo dependencias de producción (medí 21 MB) y copia únicamente `src/`: no entran `.env`, `android/`, `data/` ni `public/`.
2. Añade el servicio `api` al compose.
3. Construye, levanta y valida.

`docker/api.Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
```

> `oracledb` 6.x corre en modo *thin* (JS puro), así que **no necesitas Oracle Instant Client** aunque `server.js` lo importe siempre. Node 22 es el que probé; evita Node 20 (fin de soporte en abril de 2026).

**Servicio a añadir en `docker-compose.yml`**

```yaml
  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    image: gs-api:local
    container_name: gs-api
    restart: unless-stopped
    depends_on:
      postgrest:
        condition: service_started
    environment:
      NODE_ENV: production
      PORT: '3000'
      DEMO_MODE: 'false'
      AUTH_DEMO_MODE: ${AUTH_DEMO_MODE:-false}
      JWT_SECRET: ${JWT_SECRET:?requerido}
      SUPABASE_URL: http://postgrest:3000
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:?requerido}
      POSTGREST_LOCAL: 'true'
    ports:
      - '127.0.0.1:3000:3000'   # SOLO depuración: se elimina el Día 5
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 15s
```

> No uses `env_file: .env`: ese archivo trae las claves reales de Supabase. Toda la configuración llega por `environment:`. `/api/health` ya hace una consulta real a la tabla `roles`, así que el healthcheck prueba toda la cadena API → PostgREST → BD.

**Comandos exactos**

```bash
docker compose --env-file .env.docker build api
docker compose --env-file .env.docker up -d api
docker compose --env-file .env.docker logs api
docker compose --env-file .env.docker ps

set -a; . ./.env.docker; set +a
curl -s http://localhost:3000/api/health
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"'"$ADMIN_INITIAL_PASSWORD"'"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
echo ${#TOKEN}
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/inventory
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dashboard
curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000/api/inventory; echo
curl -s -o /dev/null -w 'HTTP %{http_code}' -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'; echo
curl -s -w ' HTTP %{http_code}' -X POST http://localhost:3000/api/sales -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"customerId":1,"payment":"EFECTIVO","notes":"prueba docker","items":[{"productId":2,"quantity":1,"price":699.99}]}'; echo
docker compose --env-file .env.docker exec db psql -U gs_owner -d gamingsolutions -c 'select id_producto, nombre, stock from productos order by 1'
docker compose --env-file .env.docker exec api id
docker compose --env-file .env.docker exec api ls -a /app
docker compose --env-file .env.docker exec api node -e 'console.log(require("oracledb").thin)'
docker image ls gs-api:local
```

**Criterios de validación**

- `ps`: `api` en **healthy**. Los logs muestran `Conectando a Supabase: http://postgrest:3000` y `Gaming Solutions listo en ... (Supabase)`.
- `/api/health` → `{"ok":true,"mode":"supabase"}`.
- Login devuelve un token (la longitud impresa es > 100).
- `/api/inventory` lista 3 productos con certificados `#GS-2201…2203`; `/api/dashboard` devuelve métricas `inventory 13, lowStock 1, customers 3` (con la semilla intacta).
- Sin token → `HTTP 401`. Login con `admin/admin123` → `HTTP 401` (confirma que el modo demo está apagado).
- La venta responde `{"id":...} HTTP 201` y el stock del producto 2 baja de 2 a 1; el evento queda en `bitacora_auditoria`.
- `id` muestra `uid=1000(node)`; `ls -a /app` **no** muestra `.env`, `android` ni `public`; `oracledb` imprime `true`.
- **Resiliencia** (esperado por lectura del código, confírmalo): `docker compose --env-file .env.docker stop postgrest` hace que `/api/health` responda 502; al hacer `start postgrest` vuelve a 200 sin reiniciar la API.

**Problemas frecuentes**

- `Invalid path specified in request URL` (PGRST125): falta el parche del Día 2 o `POSTGREST_LOCAL=true`.
- 502 con `JWSError`/`PGRST301`: `SERVICE_ROLE_KEY` no fue firmada con el `PGRST_JWT_SECRET` actual. Regenera **ambos juntos** (`gen-env.js`) y haz `down -v`.
- `JWT_SECRET es obligatorio fuera de DEMO_MODE`: falta `JWT_SECRET` en `.env.docker`.

**Go/No-Go:** pasas al Día 4 si API healthy, login, venta y 401 se comportan como arriba.

---

## Día 4 — Contenedor del Frontend (nginx)

**Objetivos**

- Servir `public/` desde un contenedor nginx independiente.
- Proxy de `/api/*` hacia el backend con el mismo origen, replicando las rutas "limpias" que hoy resuelve Express.

**Tareas paso a paso**

1. Crea `docker/nginx.conf` y `docker/web.Dockerfile`.
2. Añade el servicio `web` al compose.
3. Construye, levanta y valida con `curl` y con el navegador.

`docker/nginx.conf` (validada con `nginx -t` y servida en pruebas contra tu `public/` real)

```nginx
server {
    listen 80;
    server_name _;
    root  /usr/share/nginx/html;
    index index.html;

    # DNS interno de Docker: nginx arranca aunque "api" aún no exista y re-resuelve su IP si se recrea.
    resolver 127.0.0.11 valid=10s ipv6=off;
    set $api_upstream http://api:3000;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy same-origin always;

    # Rutas limpias que antes resolvía Express (pageRoutes en server.js)
    location = /dashboard  { try_files /index.html     =404; }
    location = /inventario { try_files /inventory.html =404; }
    location = /catalogo   { try_files /catalog.html   =404; }
    location = /clientes   { try_files /clients.html   =404; }
    location = /ventas     { try_files /sales.html     =404; }
    location = /compras    { try_files /purchases.html =404; }
    location = /auditoria  { try_files /audit.html     =404; }

    location /api/ {
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout    30s;
    }

    # Equivale al app.get('*') de Express
    location / { try_files $uri $uri/ /index.html; }
}
```

`docker/web.Dockerfile`

```dockerfile
FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
```

**Servicio a añadir en `docker-compose.yml`**

```yaml
  web:
    build:
      context: .
      dockerfile: docker/web.Dockerfile
    image: gs-web:local
    container_name: gs-web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    ports:
      - '${WEB_PORT:-8080}:80'
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://127.0.0.1/ || exit 1']
      interval: 10s
      timeout: 3s
      retries: 5
```

**Comandos exactos**

```bash
docker compose --env-file .env.docker build web
docker compose --env-file .env.docker up -d web
docker compose --env-file .env.docker exec web nginx -t
for p in / /dashboard /inventario /catalogo /clientes /ventas /compras /auditoria /login.html; do echo -n "$p -> "; curl -s -o /dev/null -w '%{http_code}' http://localhost:8080$p; echo; done
curl -s http://localhost:8080/api/health; echo
curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:8080/api/inventory; echo
```

**Criterios de validación**

- `nginx -t` → `syntax is ok`. Las 9 rutas devuelven `200`.
- `/api/health` a través de nginx → `{"ok":true,"mode":"supabase"}`; `/api/inventory` sin token → `401` (el proxy transmite el estado de la API).
- **Prueba en navegador** (`http://localhost:8080`):
  1. Sin sesión, te redirige a `/login.html`.
  2. Inicia sesión con `admin` y la clave `ADMIN_INITIAL_PASSWORD` de `.env.docker`.
  3. El dashboard muestra inventario, stock bajo y clientes (3) con datos reales de la BD.
  4. Navega por todo el menú lateral (inventario, catálogo, clientes, ventas, compras, auditoría): ninguna da 404.
  5. DevTools → Network: todas las llamadas `/api/...` salen a `localhost:8080` con 200; Console sin errores de CORS.
  6. Registra una venta desde la UI: baja el stock y aparece en Ventas y en Auditoría.
  7. Ejecuta `docker compose --env-file .env.docker restart api` y recarga: sigues autenticado (el JWT no depende de memoria del servidor).

**Problemas frecuentes**

- 502 en `/api/*`: la API no está healthy → `docker compose --env-file .env.docker logs api`. El `resolver 127.0.0.11` solo existe dentro de Docker; si pruebas nginx fuera de Compose, cámbialo.
- Vuelve siempre a `/login.html`: token firmado con otro `JWT_SECRET` (regeneraste secretos). En la consola del navegador: `localStorage.clear()`.
- Cambiaste algo en `public/` y no se ve: `docker compose --env-file .env.docker up -d --build web` (y recarga forzada).
- La app Android sigue apuntando a Vercel (`capacitor.config.json`); apuntarla a este stack local exige HTTPS o `cleartext` y la IP de tu red: fuera de este plan.

**Go/No-Go:** pasas al Día 5 si el recorrido completo en navegador funciona.

---

## Día 5 — Integración final, aislamiento de red, pruebas y runbook

**Objetivos**

- Compose maestro definitivo: dos redes, `backend_net` interna, y **solo `web` publicado** al host.
- Pruebas automatizadas de humo, de resiliencia y de persistencia; backup y restauración probados.
- Repositorio limpio, documentado y con plan de reversa.

**Tareas paso a paso**

1. Reemplaza `docker-compose.yml` por la versión final (abajo): quita los `ports` de depuración y añade las redes.
2. Reinicio limpio de todo el stack (`down -v` + `up -d --build`) para probar la inicialización desde cero.
3. Verifica el aislamiento de red.
4. Crea y ejecuta `scripts/smoke.sh`.
5. Prueba resiliencia y persistencia.
6. Prueba backup y restauración.
7. Higiene del repo y documentación.

`docker-compose.yml` **final**

```yaml
name: gaming-solutions

services:
  db:
    build:
      context: .
      dockerfile: db/Dockerfile
    image: gs-db:local
    container_name: gs-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?requerido}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?requerido}
      POSTGRES_DB: ${POSTGRES_DB:?requerido}
      AUTHENTICATOR_PASSWORD: ${AUTHENTICATOR_PASSWORD:?requerido}
      ADMIN_INITIAL_PASSWORD: ${ADMIN_INITIAL_PASSWORD:?requerido}
    volumes:
      - gs_pgdata:/var/lib/postgresql/data
    networks: [backend_net]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -h 127.0.0.1 -U $${POSTGRES_USER} -d $${POSTGRES_DB}']
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s

  postgrest:
    image: postgrest/postgrest:v12.2.3
    container_name: gs-postgrest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${AUTHENTICATOR_PASSWORD}@db:5432/${POSTGRES_DB}
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${PGRST_JWT_SECRET:?requerido}
      PGRST_SERVER_PORT: '3000'
    networks: [backend_net]

  api:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    image: gs-api:local
    container_name: gs-api
    restart: unless-stopped
    depends_on:
      postgrest:
        condition: service_started
    environment:
      NODE_ENV: production
      PORT: '3000'
      DEMO_MODE: 'false'
      AUTH_DEMO_MODE: ${AUTH_DEMO_MODE:-false}
      JWT_SECRET: ${JWT_SECRET:?requerido}
      SUPABASE_URL: http://postgrest:3000
      SUPABASE_SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:?requerido}
      POSTGREST_LOCAL: 'true'
    networks: [backend_net, frontend_net]
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://127.0.0.1:3000/api/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 15s

  web:
    build:
      context: .
      dockerfile: docker/web.Dockerfile
    image: gs-web:local
    container_name: gs-web
    restart: unless-stopped
    depends_on:
      api:
        condition: service_healthy
    ports:
      - '${WEB_PORT:-8080}:80'
    networks: [frontend_net]
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO /dev/null http://127.0.0.1/ || exit 1']
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  frontend_net:
  backend_net:
    internal: true   # sin salida a Internet ni acceso desde el host

volumes:
  gs_pgdata:
```

`scripts/smoke.sh` (adaptado del recorrido que ejecuté contra tu backend; debe terminar en `SMOKE OK`)

```bash
#!/bin/bash
set -u
set -a; . ./.env.docker; set +a
B="http://localhost:${WEB_PORT:-8080}"
fail=0
check() { if [ "$2" = "$3" ]; then echo "OK   $1"; else echo "FAIL $1 (esperado $2, obtenido $3)"; fail=1; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }

check 'web sirve /login.html'         200 "$(code $B/login.html)"
check 'ruta limpia /inventario'       200 "$(code $B/inventario)"
check 'API sin token rechazada'       401 "$(code $B/api/inventory)"
check 'demo admin/admin123 rechazado' 401 "$(code -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')"
check 'health vía proxy' '{"ok":true,"mode":"supabase"}' "$(curl -s --max-time 10 $B/api/health)"

TOKEN=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"'"$ADMIN_INITIAL_PASSWORD"'"}' | grep -oE '"token":"[^"]+"' | cut -d'"' -f4)
check 'login admin devuelve token' 1 "$([ ${#TOKEN} -gt 100 ] && echo 1 || echo 0)"
AUTH="Authorization: Bearer $TOKEN"
check 'inventario autenticado'        200 "$(code -H "$AUTH" $B/api/inventory)"
check 'dashboard autenticado'         200 "$(code -H "$AUTH" $B/api/dashboard)"
check 'auditoría (solo admin)'        200 "$(code -H "$AUTH" $B/api/audit)"
check 'venta sin stock suficiente'    400 "$(code -X POST $B/api/sales -H "$AUTH" -H 'Content-Type: application/json' -d '{"customerId":1,"payment":"EFECTIVO","items":[{"productId":1,"quantity":999,"price":1}]}')"

[ $fail -eq 0 ] && echo 'SMOKE OK' || { echo 'SMOKE CON FALLOS'; exit 1; }
```

**Comandos exactos**

```bash
# 2) Arranque limpio desde cero
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps

# 3) Aislamiento: solo web debe responder desde el host
curl -s -o /dev/null -w 'api:%{http_code} ' --max-time 3 http://localhost:3000/api/health; curl -s -o /dev/null -w 'postgrest:%{http_code}' --max-time 3 http://localhost:3001/roles; echo
docker compose --env-file .env.docker exec web wget -qO- -T 3 http://postgrest:3000/

# 4) Humo
bash scripts/smoke.sh

# 5) Resiliencia y persistencia
docker compose --env-file .env.docker restart api
sleep 15; bash scripts/smoke.sh
docker compose --env-file .env.docker stop postgrest
curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:8080/api/health; echo
docker compose --env-file .env.docker start postgrest
sleep 5; bash scripts/smoke.sh
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d
bash scripts/smoke.sh

# 6) Backup y restauración (usa Git Bash/WSL: PowerShell corrompe la salida binaria con >)
mkdir -p backups
docker compose --env-file .env.docker exec -T db pg_dump -U gs_owner -d gamingsolutions -Fc > backups/gs_test.dump
docker compose --env-file .env.docker exec -T db psql -U gs_owner -d postgres -c 'create database gs_restore_test'
docker compose --env-file .env.docker exec -T db pg_restore -U gs_owner -d gs_restore_test --no-owner < backups/gs_test.dump
docker compose --env-file .env.docker exec db psql -U gs_owner -d gs_restore_test -At -c 'select count(*) from productos'
docker compose --env-file .env.docker exec -T db psql -U gs_owner -d postgres -c 'drop database gs_restore_test'
```

**Criterios de validación (aceptación final)**

- `ps` muestra los 4 servicios **healthy/running**, y la columna de puertos solo lista `web` (`0.0.0.0:8080->80`).
- Aislamiento: `api:000 postgrest:000` (sin respuesta) desde el host, y `wget` desde `web` hacia `postgrest` falla con `bad address`: el frontend **no puede** saltarse al backend ni a la BD.
- `smoke.sh` imprime `SMOKE OK` (10 comprobaciones) tras el arranque limpio, tras reiniciar `api`, tras detener/arrancar `postgrest` y tras `down`/`up`.
- Con `postgrest` detenido, `/api/health` responde `502`, y se recupera solo al arrancarlo.
- Tras `down` (sin `-v`) los datos persisten: el conteo de productos sigue en 3 y el login del admin sigue funcionando.
- El backup restaura 3 productos en `gs_restore_test`, y la BD temporal se elimina.
- `git status` no muestra `.env`, `.env.docker` ni `backups/`; ninguna imagen contiene secretos (`docker compose --env-file .env.docker exec api ls -a /app`).

**Higiene del repositorio y reversa**

1. Crea `.env.docker.example` con las mismas claves de `gen-env.js` pero **sin valores**, y haz commit solo de ese.
2. Escribe `README_DOCKER.md` con: generar secretos, `up -d --build`, URL `http://localhost:8080`, usuario `admin` (clave en `.env.docker`), `down`/`down -v`, backup.
3. Opcional: mueve `@capacitor/*` a `devDependencies` y ejecuta `npm install --package-lock-only` (no se usan en el servidor; ahorra \~1.6 MB en la imagen).
4. Opcional, solo desarrollo: `docker-compose.override.yml` (Compose lo fusiona solo) para recarga en caliente:

```yaml
services:
  api:
    command: ['node', '--watch', 'src/server.js']
    volumes:
      - ./src:/app/src:ro
  web:
    volumes:
      - ./public:/usr/share/nginx/html:ro
```

5. **Reversa:** el parche del Día 2 es opt-in, así que `npm start` con tu `.env` original (Supabase nube) sigue funcionando igual. Para deshacer todo: `docker compose --env-file .env.docker down -v` y `git checkout main`.

---

## Anexos

### A. Resumen del plan

| Día | Entregable | Prueba clave |
| --- | --- | --- |
| 1 | Contenedor `db` con roles, esquema, datos y admin real | 16 tablas; semilla `3 / 4 / 3 / 3 / 1 / 3`; persistencia |
| 2 | `postgrest` + parche del cliente | `401` sin token; RPC rechaza stock insuficiente con `400` |
| 3 | Imagen `api` no-root, sin secretos | Login, venta y descuento de stock; `401` con modo demo |
| 4 | Imagen `web` (nginx) con proxy `/api` | Recorrido completo en navegador sin CORS |
| 5 | Redes aisladas, `smoke.sh`, backup | `SMOKE OK` tras reinicios; solo `:8080` expuesto |

### B. Referencia rápida

```bash
docker compose --env-file .env.docker up -d --build      # levantar todo
docker compose --env-file .env.docker ps                 # estado y salud
docker compose --env-file .env.docker logs -f api        # logs de un servicio
docker compose --env-file .env.docker exec db psql -U gs_owner -d gamingsolutions   # consola SQL
docker compose --env-file .env.docker down               # apagar conservando datos
docker compose --env-file .env.docker down -v            # apagar y BORRAR datos (reinicializa)
```

### C. Riesgos que quedan y siguientes pasos

- **`initdb` solo corre una vez.** Para cambios de esquema futuros usa una herramienta de migraciones (Flyway, Sqitch o dbmate) en lugar de editar los scripts de `db/init`.
- **Seguridad del panel:** el esquema y el flujo de login siguen siendo los de tu proyecto; revisa roles y contraseñas antes de exponer algo fuera de tu máquina. Para HTTPS usa un proxy delante de `web` (Caddy o Traefik).
- **Sin ejecutar aquí:** `Dockerfile`s y `docker-compose.yml` (no había Docker). Las versiones de imagen (`postgres:16-alpine`, `postgrest:v12.2.3`, `node:22-alpine`, `nginx:stable-alpine`) conviene fijarlas por *digest* cuando todo pase.
- **Opcional a futuro:** reemplazar PostgREST por acceso directo con `pg` eliminaría un contenedor, pero implica reescribir `supabase-api.js` y repetir las pruebas de regresión.
