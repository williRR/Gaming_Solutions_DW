# Gaming Solutions — Bitácora de desarrollo

Panel administrativo para **Gaming Solutions**, orientado a inventario de hardware gamer, certificados de inspección #GS, ventas, compras y operación móvil.

Este documento funciona como bitácora técnica y guía de puesta en marcha de las **tres fases implementadas**. Describe qué se cambió, qué archivos participan, cómo probarlo y qué falta antes de llevar el sistema a producción.

---

## 1. Resumen del estado actual

El proyecto cuenta con un MVP operativo basado en:

- **Backend:** Node.js, Express y `node-oracledb`.
- **Base de datos:** Oracle Database mediante conexión directa u Oracle APEX/ORDS.
- **Frontend:** HTML, CSS y JavaScript vanilla.
- **Autenticación:** JWT con expiración de 8 horas.
- **Autorización:** roles `Administrador`, `Ventas` y `Almacen`.
- **Transacciones:** ventas y compras multi-línea con actualización de inventario.
- **Modo DEMO:** permite probar la aplicación sin Oracle.
- **Móvil:** Capacitor, navegación inferior, pull-to-refresh y escaneo QR.

> **Estado comercial:** funcional para demostración y validación operativa. Antes de venderlo como producto terminado deben completarse endurecimiento de seguridad, persistencia de idempotencia, pruebas automatizadas, despliegue y requisitos fiscales de la empresa.

---

## 2. Arquitectura general

```text
                    +----------------------+
                    |  Navegador / PWA      |
                    |  App Android Capacitor|
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    | Node.js + Express    |
                    | JWT + RBAC           |
                    | Rutas web y móviles  |
                    +-----+-----------+----+
                          |           |
                          v           v
                   Oracle ORDS   Oracle Database
                   / APEX        node-oracledb
```

### Modos de ejecución

1. **DEMO:** `DEMO_MODE=true`. Utiliza datos en memoria y no requiere Oracle.
2. **ORDS:** el backend consume los endpoints REST publicados en Oracle APEX.
3. **Oracle directo:** Node utiliza `node-oracledb` y un pool de conexiones.

El navegador siempre debe comunicarse con el backend Node. No se deben exponer credenciales Oracle ni operaciones administrativas directamente al frontend.

---

## 3. Fase 1 — Seguridad, autenticación y roles

### Objetivo

Evitar que las rutas de inventario, ventas, compras y auditoría queden expuestas sin sesión, y adaptar la interfaz según el rol del usuario.

### Cambios realizados

#### Backend

Se creó [`src/middleware/auth.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/middleware/auth.js>), que incluye:

- Generación de JWT.
- Expiración de token de 8 horas.
- Payload:

```json
{
  "id_usuario": 1,
  "nombre": "Carlos Mendoza - Admin Master",
  "rol": "Administrador"
}
```

- Middleware `authenticateToken`.
- Middleware `requireRole`.
- Verificación de contraseñas con bcrypt.
- Normalización de roles históricos de la base de datos:
  - `Administrador General` → `Administrador`.
  - `Vendedor / Cajero` → `Ventas`.
  - `Técnico Certificador` → `Almacen`.
- Endpoint `GET /api/auth/me`.

Se integró la autenticación en [`src/server.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/server.js>).

Todas las rutas `/api/*` requieren JWT excepto:

- `POST /api/auth/login`.
- `GET /api/health`.

Para las operaciones Oracle se establece `DBMS_SESSION.CLIENT_IDENTIFIER` con el `id_usuario`, de forma que la auditoría pueda identificar al operador.

#### Frontend

Se añadieron:

- [`public/login.html`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/login.html>).
- [`public/js/auth.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/auth.js>).
- [`public/js/rbac-ui.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/rbac-ui.js>).

La sesión frontend:

- Guarda el JWT en `localStorage`.
- Guarda el usuario y rol.
- Adjunta `Authorization: Bearer <token>` automáticamente.
- Redirige a `/login.html` cuando recibe `401` o `403`.
- Permite cerrar sesión desde el encabezado.
- Oculta controles que el rol no puede utilizar.

### Permisos por rol

| Módulo/acción | Administrador | Ventas | Almacen |
|---|---:|---:|---:|
| Dashboard | Sí | Sí | Sí |
| Consultar inventario | Sí | Sí | Sí |
| Crear/editar productos | Sí | No | Sí |
| Actualizar certificados | Sí | No | Sí |
| Registrar ventas | Sí | Sí | No |
| Consultar clientes | Sí | Sí | No |
| Registrar compras | Sí | No | Sí |
| Ver costos de compra | Sí | No | Sí |
| Auditoría | Sí | No | No |
| Baja lógica de productos | Sí | No | No |

El control visual no reemplaza la autorización del backend. Un usuario sin permiso recibe `403` aunque intente llamar la ruta manualmente.

### Usuarios DEMO

Disponibles con `DEMO_MODE=true`:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `ventas` | `ventas123` | Ventas |
| `almacen` | `almacen123` | Almacen |

Estas credenciales son únicamente para demostración.

---

## 4. Fase 2 — Operación comercial y transacciones

### Objetivo

Permitir registrar ventas y compras con múltiples productos, actualizar inventario de forma consistente y evitar duplicados por reintentos.

### Rutas modulares

Se crearon:

- [`src/routes/sales.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/routes/sales.js>).
- [`src/routes/purchases.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/routes/purchases.js>).

Se montaron en [`src/server.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/server.js>) sin eliminar las rutas existentes.

### Ventas multi-línea

Endpoint:

```http
POST /api/sales
Authorization: Bearer <token>
Idempotency-Key: venta-demo-001
Content-Type: application/json
```

Payload:

```json
{
  "customerId": 1,
  "payment": "EFECTIVO",
  "items": [
    {
      "id_producto": 1,
      "cantidad": 1,
      "precio_unitario": 499.99
    },
    {
      "id_producto": 2,
      "cantidad": 2,
      "precio_unitario": 349.99
    }
  ],
  "notes": "Venta de mostrador"
}
```

Proceso Oracle:

1. Valida cliente, método de pago y líneas.
2. Agrupa productos repetidos.
3. Bloquea las filas con `SELECT ... FOR UPDATE`.
4. Comprueba que todos los productos tengan stock.
5. Inserta la cabecera en `VENTAS`.
6. Inserta las líneas en `VENTAS_DETALLE`.
7. Descuenta el stock en `PRODUCTOS`.
8. Confirma todo con `COMMIT`.
9. Ejecuta `ROLLBACK` si alguna operación falla.

Si un producto no existe o no tiene stock suficiente, responde HTTP `400` y no deja una venta parcial.

### Compras multi-línea

Endpoint:

```http
POST /api/purchases
Authorization: Bearer <token>
Idempotency-Key: compra-demo-001
Content-Type: application/json
```

Payload:

```json
{
  "providerId": 1,
  "items": [
    {
      "id_producto": 4,
      "cantidad": 2,
      "precio_compra": 1250.00
    },
    {
      "id_producto": 6,
      "cantidad": 5,
      "precio_compra": 95.00
    }
  ],
  "notes": "Reposición semanal"
}
```

Proceso Oracle:

1. Valida proveedor y líneas.
2. Inserta la cabecera en `COMPRAS`.
3. Inserta las líneas en `COMPRAS_DETALLE`.
4. Aumenta el stock en `PRODUCTOS`.
5. Actualiza el precio de compra.
6. Confirma todo en una transacción.

### Idempotencia

Las ventas y compras aceptan el encabezado:

```http
Idempotency-Key: operacion-unica-001
```

Una repetición de la misma clave para el mismo usuario devuelve el resultado anterior y no vuelve a modificar el stock.

Actualmente la clave se almacena en memoria del proceso Node. Para producción multi-instancia se debe crear una tabla Oracle con una restricción `UNIQUE`.

### Interfaz de venta

Se añadió [`public/js/sales.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/sales.js>), que incluye:

- Carrito de compras.
- Selección de productos.
- Cantidades.
- Validación contra el stock disponible.
- Subtotales.
- Total en tiempo real.
- Eliminación de líneas.
- Envío multi-línea.
- Idempotencia en el navegador.

### Certificados e impresión

Se añadió [`public/js/certificates.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/certificates.js>):

- Muestra datos del certificado #GS.
- Permite imprimir una ficha.
- Incluye métricas de hardware, estado estético, rendimiento térmico, garantía y técnico responsable.

---

## 5. Fase 3 — Aplicación móvil y sincronización

### Objetivo

Reutilizar el panel web en una aplicación móvil Capacitor, respetando autenticación, roles y operaciones existentes.

### API móvil

Se creó [`src/routes/mobile.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/src/routes/mobile.js>).

#### Dashboard móvil

```http
GET /api/mobile/dashboard
Authorization: Bearer <token>
```

Devuelve una respuesta compacta con:

- Stock total.
- Productos con stock bajo.
- Ventas recientes.
- Inventario resumido.
- Estado de cada producto.

#### Escáner móvil

```http
GET /api/mobile/scan/%23GS-2201
Authorization: Bearer <token>
```

Acepta:

- ID del producto.
- SKU.
- Código del certificado #GS.

El endpoint retorna la ficha del producto o `404` si no existe.

Ambas rutas aplican JWT y permiten consultar a los tres roles operativos.

### Configuración Capacitor

Se añadió [`capacitor.config.json`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/capacitor.config.json>).

Dependencias instaladas:

- `@capacitor/core`.
- `@capacitor/android`.
- `@capacitor/status-bar`.
- `@capacitor/splash-screen`.
- `@capacitor/cli`.

Configuración actual:

- Aplicación: `Gaming Solutions Admin`.
- Identificador: `pe.gamingsolutions.admin`.
- Carpeta web: `public`.
- URL de desarrollo: `http://localhost:3000`.
- Status bar y splash screen configurados.

### Inicialización móvil

Desde la raíz del proyecto:

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

Para un teléfono físico, `localhost` apunta al teléfono y no al computador. En desarrollo se debe cambiar `server.url` por la IP local accesible:

```json
{
  "server": {
    "url": "http://192.168.1.100:3000",
    "cleartext": true,
    "androidScheme": "http"
  }
}
```

En producción utilizar HTTPS y desactivar `cleartext`:

```json
{
  "server": {
    "url": "https://admin.gamingsolutions.pe",
    "cleartext": false,
    "androidScheme": "https"
  }
}
```

Después de cambiar la URL:

```bash
npx cap sync android
```

No se debe ejecutar `npx cap add android` más de una vez para el mismo proyecto.

### Fase 4 — Dashboard administrativo y vistas de gestión

En la rama `PanelAdmin` se incorporó una actualización visual del dashboard con:

- KPI de inventario, ventas, stock bajo y clientes.
- Indicador de rendimiento operativo y actividad reciente.
- Acciones rápidas para registrar productos, ventas y compras.
- Tablas de inventario, clientes, ventas y auditoría con diseño responsive.
- Indicadores visuales de inspección y estado de certificados #GS.
- Navegación móvil y modales para ingresar y editar registros.

Archivos principales:

- [`public/index.html`](public/index.html)
- [`public/styles.css`](public/styles.css)
- [`public/inventory.html`](public/inventory.html)
- [`public/clients.html`](public/clients.html)
- [`public/operations.html`](public/operations.html)
- [`public/audit.html`](public/audit.html)
- [`public/module.js`](public/module.js)
- [`public/inventory.js`](public/inventory.js)
- [`public/operations.js`](public/operations.js)

#### Validación

- `npm run check`: valida la sintaxis de `src/server.js`.
- `DEMO_MODE=true npm start`: inicia la aplicación con datos simulados.
- HTTP local: `GET /` responde con estado `200` y el dashboard esperado.
- `GET /api/health`: responde con `200` y modo `demo`.
- `POST /api/auth/login`: autentica usuarios de demostración.
- `GET /api/dashboard` y `GET /api/inventory`: devuelven ocho productos de prueba.

#### Integración pendiente

La interfaz administrativa está conectada a los módulos y APIs. La landing pública aún no existe como una página independiente; la ruta `/landing.html` actualmente devuelve el dashboard del administrador y requiere una implementación separada de `public/landing.html` y una API pública de catálogo.

### Navegación móvil

Se añadió [`public/js/mobile-nav.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/mobile-nav.js>).

Incluye:

- Barra inferior para pantallas menores a 900px.
- Barra visible dentro de Capacitor.
- Pestañas filtradas según el rol.
- Pull-to-refresh.
- Manejo del botón Atrás de Android.
- Cierre de modales con el botón Atrás.
- Salida de la aplicación cuando no existe historial.

Pestañas:

| Rol | Pestañas |
|---|---|
| Administrador | Resumen, Inventario, Ventas, Compras, Auditoría |
| Ventas | Resumen, Inventario, Ventas |
| Almacen | Resumen, Inventario, Compras |

### Escaneo QR

Se añadió [`public/js/qr-scanner.js`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/public/js/qr-scanner.js>).

Características:

- Cámara trasera.
- Lectura de códigos QR con `html5-qrcode`.
- Consulta automática de producto.
- Búsqueda manual como alternativa.
- Detención de cámara al cerrar.
- Apertura del detalle del producto.

Actualmente `html5-qrcode` se carga desde CDN. Para una app offline se recomienda descargar la librería y servirla localmente desde `public/vendor/`.

---

## 6. Base de datos Oracle y ORDS

Ejecutar los scripts en este orden:

1. [`sql/01_schema.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/01_schema.sql>)
   - Tablas, relaciones, restricciones, índices y vista `CONSOLAS`.
2. [`sql/02_auditoria.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/02_auditoria.sql>)
   - `BITACORA_AUDITORIA` y triggers.
3. [`sql/03_seed.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/03_seed.sql>)
   - Datos de demostración.
4. [`sql/04_ords_rest_endpoints.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/04_ords_rest_endpoints.sql>)
   - Módulo base `gaming`, productos, dashboard, catálogos y ventas.
5. [`sql/05_ords_rest_endpoints.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/05_ords_rest_endpoints.sql>)
   - Proveedores, categorías, clientes, compras, auditoría y consultas.
6. [`sql/06_ords_post_actions.sql`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/sql/06_ords_post_actions.sql>)
   - Alternativas `POST` para instalaciones donde el WAF bloquea `PATCH` o `DELETE`.

Base URL esperada:

```text
https://<instancia>/ords/<esquema>/gaming/
```

Pruebas directas:

- [`api_tests.http`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/api_tests.http>)
- [`ords_endpoints.http`](<C:/Users/user/OneDrive/Desktop/Uni/8vo ciclo/desarrollo web/Proyecto fase 2/ords_endpoints.http>)

---

## 7. Instalación completa desde cero

### Requisitos

- Node.js 18 o superior.
- Oracle APEX con ORDS o Oracle Database.
- Oracle Instant Client para conexión directa en Windows.
- Android Studio solo si se construirá la app Android.

### Backend DEMO

```powershell
npm install
Copy-Item .env.example .env
$env:DEMO_MODE="true"
$env:PORT="3000"
npm start
```

Abrir:

```text
http://localhost:3000/login.html
```

### Backend con ORDS/Oracle

Copiar `.env.example` a `.env` y completar:

```env
PORT=3000
DEMO_MODE=false
JWT_SECRET=una-clave-aleatoria-larga
ORDS_INVENTORY_URL=https://<instancia>/ords/<esquema>/gaming/productos/
ORACLE_USER=gaming_solutions
ORACLE_PASSWORD=<secreto>
ORACLE_CONNECT_STRING=<host>:<puerto>/<servicio>
ORACLE_POOL_MIN=1
ORACLE_POOL_MAX=5
ORACLE_POOL_INCREMENT=1
```

Si se necesita autenticación contra `USUARIOS`, deben estar configuradas las credenciales Oracle y los usuarios deben tener hashes bcrypt en `USUARIOS.CLAVE_HASH`.

Nunca subir `.env`, contraseñas, wallets, certificados ni credenciales al repositorio.

---

## 8. Rutas principales de la API

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicia sesión y genera JWT |
| `GET` | `/api/auth/me` | Verifica la sesión actual |
| `GET` | `/api/health` | Estado del backend y conexión |

### Inventario

| Método | Ruta |
|---|---|
| `GET` | `/api/inventory` |
| `GET` | `/api/inventory/:id` |
| `POST` | `/api/inventory` |
| `PATCH` | `/api/inventory/:id` |
| `PATCH` | `/api/inventory/:id/certificate` |
| `DELETE` | `/api/inventory/:id` |

### Operación comercial

| Método | Ruta |
|---|---|
| `GET` | `/api/sales` |
| `GET` | `/api/sales/:id` |
| `POST` | `/api/sales` |
| `POST` | `/api/purchases` |
| `GET` | `/api/clients` |
| `POST` | `/api/clients` |
| `GET` | `/api/providers` |
| `GET` | `/api/categories` |
| `GET` | `/api/catalogs` |

### Auditoría y móvil

| Método | Ruta |
|---|---|
| `GET` | `/api/audit` |
| `GET` | `/api/mobile/dashboard` |
| `GET` | `/api/mobile/scan/:qr_or_id` |

---

## 9. Validación y pruebas realizadas

Comando principal:

```bash
npm run check
```

También se validaron:

- Sintaxis de middleware JWT.
- Sintaxis de rutas de ventas, compras y móvil.
- Sintaxis de scripts frontend.
- Login DEMO.
- `/api/auth/me`.
- `401` sin token.
- `403` para acciones no permitidas.
- Venta multi-línea.
- Compra multi-línea.
- Reintento idempotente.
- `400` con stock insuficiente.
- Dashboard móvil.
- Búsqueda por certificado `#GS`.
- Navegación móvil filtrada por rol.
- Instalación con `npx cap doctor`.

El modo DEMO no persiste datos al reiniciar el proceso.

---

## 10. Estructura de archivos incorporados

```text
capacitor.config.json

src/
├── server.js
├── middleware/
│   └── auth.js
└── routes/
    ├── sales.js
    ├── purchases.js
    └── mobile.js

public/
├── index.html
├── login.html
├── app.js
├── styles.css
└── js/
    ├── auth.js
    ├── rbac-ui.js
    ├── sales.js
    ├── certificates.js
    ├── mobile-nav.js
    └── qr-scanner.js
```

---

## 11. Pendientes antes de producción

- Cambiar las credenciales DEMO.
- Configurar un `JWT_SECRET` aleatorio y seguro.
- Usar HTTPS en backend, ORDS y Capacitor.
- Persistir claves de idempotencia en Oracle.
- Implementar recuperación y rotación de contraseñas.
- Añadir rate limiting, CORS restringido y validación formal de payloads.
- Guardar logs centralizados sin exponer información sensible.
- Completar pruebas unitarias, integración y concurrencia.
- Añadir backups y probar restauración.
- Servir `html5-qrcode` localmente si se requiere operación offline.
- Definir comprobantes, impuestos, devoluciones y anulaciones según el país.
- Revisar permisos Oracle y configuración de ORDS en staging.
- Crear pipeline CI/CD y ambientes separados de desarrollo, staging y producción.
- Preparar manual de usuario, soporte, SLA y capacitación.

---

## 12. Licencia y entrega

Proyecto privado de Gaming Solutions. Antes de la entrega comercial se deben definir con la empresa:

- Propiedad del código.
- Licenciamiento.
- Hosting y dominio.
- Mantenimiento.
- Soporte.
- Tratamiento de datos personales.
- Alcance de las integraciones.
- Responsabilidades sobre Oracle APEX, ORDS y backups.
