# Gaming Solutions en Docker — guía de uso

Esta guía explica **qué se construyó**, **por qué**, y **cómo encender, usar y apagar** los contenedores.

## 1. Qué es esto (en simple)

Antes, la app dependía de servicios externos (Oracle ORDS, luego Supabase en la nube). Ahora todo corre **en tu propia máquina**, en 4 contenedores que se comunican entre sí:

```
Navegador ──► web (nginx) ──► api (Node/Express) ──► postgrest ──► db (PostgreSQL)
              :8080/8081       src/server.js          API REST        datos + usuarios
```

| Contenedor | Qué hace | Por qué existe |
|---|---|---|
| `gs-db` | PostgreSQL 16 con el esquema (`sql/10_supabase_schema.sql`), datos semilla y usuario admin | Reemplaza a Supabase/Oracle. Los datos viven en el volumen `gs_pgdata` |
| `gs-postgrest` | Convierte la base en una API REST con los mismos endpoints que Supabase | El backend usa `@supabase/supabase-js`, que "habla" con PostgREST; así **no se reescribió el código** |
| `gs-api` | Tu backend Node (`src/`): login, inventario, ventas, compras, auditoría | Es la lógica de negocio; corre como usuario no-root y sin secretos dentro de la imagen |
| `gs-web` | nginx: sirve `public/` y reenvía `/api` al backend | Un solo origen para el navegador (sin problemas de CORS) y único punto expuesto |

**Seguridad de red:** hay dos redes. `backend_net` es *interna* (db, postgrest y api; sin acceso desde tu PC ni a Internet). `frontend_net` conecta `web` con `api`. Solo `web` publica un puerto al host. Por eso desde tu PC no puedes llegar directo a la base ni a PostgREST: es intencional.

## 2. Requisitos

1. **Docker Desktop abierto** (icono de la ballena estable/"Engine running"). Si está cerrado, ningún comando funciona.
2. Node.js (solo para generar claves y correr pruebas).
3. Un puerto libre para la web (por defecto `8080`; si está ocupado, cambia `WEB_PORT` en `.env.docker`).

## 3. Primera vez (una sola vez)

```powershell
npm run docker:env                                   # genera .env.docker con claves aleatorias (no se sube a git)
docker compose --env-file .env.docker up -d --build  # construye imágenes y arranca todo
docker compose --env-file .env.docker ps             # espera a ver "healthy" en db, api y web
```

Abre **http://localhost:8080** (o el `WEB_PORT` que tengas). Usuario: `admin`; contraseña: valor de `ADMIN_INITIAL_PASSWORD` dentro de `.env.docker`.

> `.env.docker` contiene todos los secretos. **Nunca** lo subas a git (ya está en `.gitignore`). `.env.docker.example` es la plantilla sin valores.

## 4. Uso diario

| Quiero… | Comando |
|---|---|
| **Encender** (conserva datos) | `docker compose --env-file .env.docker up -d` |
| **Apagar** (conserva datos) | `docker compose --env-file .env.docker down` |
| Ver estado y salud | `docker compose --env-file .env.docker ps` |
| Ver logs en vivo de un servicio | `docker compose --env-file .env.docker logs -f api` |
| Reiniciar solo el backend | `docker compose --env-file .env.docker restart api` |
| Parar/arrancar un solo servicio | `docker compose --env-file .env.docker stop postgrest` / `start postgrest` |
| Reconstruir tras cambiar código en `src/` o `public/` | `docker compose --env-file .env.docker up -d --build` |
| Consola SQL | `docker compose --env-file .env.docker exec db psql -U <POSTGRES_USER> -d <POSTGRES_DB>` |
| Probar que todo funciona | `npm run docker:smoke` (debe terminar en `SMOKE OK`) |

(`POSTGRES_USER` y `POSTGRES_DB` están en `.env.docker`.)

Los contenedores tienen `restart: unless-stopped`: si Docker Desktop se abre, se levantan solos, salvo que los hayas apagado con `down`.

## 5. Datos: qué se conserva y qué se borra

- `down` → apaga y **conserva** los datos (volumen `gs_pgdata`).
- `down -v` → apaga y **BORRA** los datos. Al volver a `up`, se reinicializa desde `sql/` con los datos semilla.
- Los scripts de `db/init/` **solo se ejecutan con volumen vacío**. Si cambias el esquema o `sql/datos.sql`, necesitas `down -v` (pierdes los datos actuales).
- `npm run docker:reset` = `down -v` + **regenera todas las claves** (cambia la contraseña del admin). Úsalo solo para empezar totalmente de cero.

## 6. Backup y restauración

```powershell
$e='--env-file','.env.docker'
# Backup (se genera dentro del contenedor y se copia, para no corromper el binario con PowerShell)
docker compose @e exec -T db sh -c "pg_dump -U <POSTGRES_USER> -d <POSTGRES_DB> -Fc -f /tmp/gs.dump"
docker compose @e cp db:/tmp/gs.dump backups/gs_AAAAMMDD.dump
```

Para restaurar a una base temporal y verificar: crea la base (`create database gs_restore_test`), copia el archivo al contenedor (`docker compose @e cp backups/gs_AAAAMMDD.dump db:/tmp/gs.dump`) y ejecuta `pg_restore -U <usuario> -d gs_restore_test --no-owner /tmp/gs.dump`. La carpeta `backups/` no se versiona.

## 7. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| `error during connect ... docker_engine` | Docker Desktop está cerrado. Ábrelo y espera a que diga "Engine running" |
| `port is already allocated` | Otro programa usa el puerto. Cambia `WEB_PORT` en `.env.docker` y haz `up -d` |
| Login admin falla tras `docker:reset` | La clave cambió: lee la nueva `ADMIN_INITIAL_PASSWORD` en `.env.docker` |
| `/api/health` da 502 | `postgrest` o `db` caídos; `docker compose ... ps` y `logs postgrest`. Se recupera solo al volver |
| No puedo conectarme a la BD desde DBeaver | Es a propósito (red interna). Usa `exec db psql ...` |
| Cambié `sql/` y no se aplica | Los scripts de init solo corren con volumen vacío: `down -v` y `up -d --build` |

## 8. Qué se hizo, día por día

1. **Día 1 – Base de datos:** imagen Postgres con roles (`anon`, `authenticated`, `authenticator`, `service_role`), esquema de 16 tablas, datos semilla, correcciones (SKU único) y usuario `admin` con contraseña real hasheada (bcrypt).
2. **Día 2 – PostgREST:** capa REST sobre la base; el cliente del backend recibió un parche *opcional* (`POSTGREST_LOCAL=true`) que quita el prefijo `/rest/v1/` propio de Supabase. Con tu `.env` de Supabase en la nube sigue funcionando igual.
3. **Día 3 – API:** imagen Node multi-etapa (solo dependencias de producción, usuario no-root, sin `.env` dentro).
4. **Día 4 – Web:** nginx con rutas limpias (`/inventario`, `/ventas`…), proxy `/api` y *healthcheck*.
5. **Día 5 – Aislamiento y pruebas:** se quitaron los puertos de depuración, se crearon las dos redes, se añadió `npm run docker:smoke` y se probó: arranque desde cero, reinicio de api, caída/recuperación de postgrest, persistencia tras `down`/`up` y backup/restauración.

## 9. Reversa

La app sigue funcionando sin Docker (`npm start` con tu `.env` de Supabase en la nube). Para quitar todo lo de Docker: `docker compose --env-file .env.docker down -v` y volver a la rama anterior.

## 10. Limitaciones

- La app Android/Capacitor sigue apuntando a Vercel, no a este stack.
- Para exponerlo fuera de tu máquina hace falta HTTPS (proxy como Caddy/Traefik delante de `web`) y revisar contraseñas.
- Los README antiguos y `sql/04–09` (ORDS) están obsoletos.
