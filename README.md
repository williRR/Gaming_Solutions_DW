# Gaming Solutions

Panel administrativo para compras, ventas e inventario de consolas. Incluye Oracle Database, Node.js/Express y una interfaz web de back-office.

## 1. Base de datos

1. En Oracle APEX abre **SQL Workshop > SQL Scripts > Upload**.
2. Ejecuta `sql/01_schema.sql`.
3. Ejecuta `sql/02_auditoria.sql`.
4. Ejecuta `sql/03_seed.sql` para los datos de prueba.

El modelo incluye `PROVEEDORES`, `CLIENTES`, `CONSOLAS`, `CONSOLAS_RETRO_DETALLE`, `CONSOLAS_FOTOS`, compras, ventas y `BITACORA_AUDITORIA`. La auditoría registra INSERT/UPDATE/DELETE sobre `CONSOLAS` y `VENTAS` con usuario Oracle, fecha, valores anteriores y nuevos en JSON CLOB.

## 2. Node.js

Requiere Node.js 18+ y acceso de red a Oracle. Copia `.env.example` a `.env` y configura el usuario, contraseña y connect string. Después:

```powershell
npm install
npm run dev
```

Abre `http://localhost:3000`. Para revisar el diseño sin Oracle:

```powershell
$env:DEMO_MODE='true'; npm start
```

El endpoint principal es `GET /api/dashboard`; el endpoint de inventario es `GET /api/inventory`; `GET /api/health` comprueba conectividad.

También puedes usar el recurso ORDS que compartiste configurando `ORDS_INVENTORY_URL` en `.env`:

```env
ORDS_INVENTORY_URL=https://oracleapex.com/ords/luism/gaming/consolas/
```

El panel interpreta la respuesta ORDS `{ "items": [], "hasMore": false }` y normaliza columnas Oracle en mayúsculas o alias en minúsculas. La URL actualmente devuelve cero filas y funciona como lectura. Para guardar desde el panel necesitas publicar en ORDS handlers `POST`, `PUT` y `DELETE`, o configurar también las credenciales Oracle para que Node use `node-oracledb`.

## 3. APEX y ORDS

Para un back-office 100% APEX, crea desde **App Builder > Create > New Application** estas páginas: Dashboard, Interactive Report + Form para `CONSOLAS`, Interactive Report + Form para `CLIENTES`, Interactive Report + Form para `PROVEEDORES`, Master-Detail para `COMPRAS` y `VENTAS`, y un Interactive Report de solo lectura para `BITACORA_AUDITORIA`. Usa Select Lists para `TIPO`, `ESTADO_FUNCIONAL`, `METODO_PAGO` y `ESTADO_VENTA`; valida que el stock no sea negativo.

Para conectar Node.js en Oracle Cloud, usa una conexión privada/VPN o allowlist de IP y el connect string del Autonomous Database. Con ADB normalmente se descarga el wallet desde **Database Actions > Download Wallet**, se configura `TNS_ADMIN` en el servidor Node y se usa como `ORACLE_CONNECT_STRING` un alias del `tnsnames.ora`. Alternativamente, publica procedimientos REST con ORDS y consume sus endpoints desde Node; no expongas el puerto Oracle directamente a internet.

## 4. APEX REST opcional

ORDS debe ejecutarse junto a la base o en una red privada. Protege los módulos con OAuth2 o la autenticación de APEX, usa HTTPS y limita los privilegios del usuario de aplicación. Node.js puede consumir ORDS con `fetch`, pero para consultas internas directas `node-oracledb` ofrece menos capas y mantiene el control transaccional.
