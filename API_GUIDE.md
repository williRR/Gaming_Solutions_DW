# Guia de API para el frontend

Esta guia describe la API local de Express que debe consumir un frontend. El navegador no debe llamar directamente a Oracle APEX/ORDS.

## Flujo y configuracion

```text
Frontend -> API Express (/api/...) -> Oracle APEX ORDS -> Base de datos
```

En desarrollo, el servidor suele estar disponible en `http://localhost:3000`. La interfaz debe usar rutas relativas, por ejemplo `/api/inventory`, para funcionar en el mismo origen que Express.

Inicia el servidor con `npm start`. Para trabajar sin Oracle, inicia con `DEMO_MODE=true`; en Windows PowerShell:

```powershell
$env:DEMO_MODE = 'true'
npm start
```

En modo demo las rutas no llaman ORDS. Los datos viven en memoria y algunas rutas devuelven listas vacias o respuestas simplificadas. En modo ORDS, Express hace las llamadas a APEX, incluye `Accept: application/json` y el `User-Agent` configurado por `ORDS_USER_AGENT`. No se requiere que el frontend conozca la URL de ORDS ni sus headers.

En producción, `ORDS_INVENTORY_URL` debe apuntar a un ORDS público con HTTPS. Si se usa el pool Oracle para autenticar contra `USUARIOS`, `ORACLE_CONNECT_STRING` también debe ser enrutable desde Vercel; una IP privada como `192.168.1.50:1521` nunca funcionará desde Vercel. Un fallo de conexión durante el login responde `503` con:

```json
{
  "ok": false,
  "code": "AUTH_DB_UNAVAILABLE",
  "error": "El servicio de autenticación no está disponible. Intenta nuevamente más tarde."
}
```

Todas las rutas que reciben un cuerpo esperan JSON (`Content-Type: application/json`). Los errores usan normalmente `{ "error": "..." }`. Las respuestas de ORDS que no se normalizan se devuelven con la estructura que entrega el workspace APEX.

## Rutas de lectura

| Metodo y ruta local | Que devuelve | ORDS utilizado |
|---|---|---|
| `GET /api/health` | Estado y modo (`demo` u `ords`). | Verifica la lectura de productos. |
| `GET /api/dashboard` | `{ mode, inventory, sales, metrics }`. | `/dashboard/`, `/productos/` y `/ventas/consulta/`. |
| `GET /api/inventory` | Lista de productos activos normalizados. | `/productos/`. |
| `GET /api/inventory/:id` | Detalle normalizado de un producto. | `/productos/:id/`. |
| `GET /api/providers` | Lista de proveedores. | `/proveedores/`. |
| `GET /api/categories` | Lista de categorias. | `/categorias/`. |
| `GET /api/clients` | Clientes, incluidos los datos de contacto disponibles. | `/clientes/`. |
| `GET /api/sales` | Lista de ventas. | `/ventas/consulta/`. |
| `GET /api/sales/:id` | Detalle de una venta. | `/ventas/consulta/:id/`. |
| `GET /api/audit` | Eventos de auditoria. | `/auditoria/`. |
| `GET /api/catalogs` | `{ customers, providers, inventory }` para los selectores existentes. | `/catalogos/`, `/proveedores/` y `/productos/`. |

Los listados ORDS aceptan una respuesta tipo arreglo o una respuesta con `items`; Express extrae la coleccion. Los productos se normalizan a propiedades como `id`, `name`, `price`, `stock`, `certificate`, `hwPct`, `aestheticPct`, `thermalPct` y `warrantyMonths`. Los otros listados se devuelven como los entrega ORDS.

`/api/catalogs` usa `/catalogos/` para los datos basicos de clientes (`id`, `name`); usa `/api/clients` cuando el frontend necesita consultar el endpoint separado de clientes con contacto.

## Rutas de escritura

### Crear cliente

`POST /api/clients`

```json
{
  "name": "Luis Vargas",
  "phone": "+51 999 888 777",
  "email": "luis.vargas@example.com",
  "address": "Av. Principal 123, Lima"
}
```

`name` es obligatorio. Express envia esos campos a ORDS `/clientes/` y devuelve su respuesta con estado `201`.

### Crear producto

`POST /api/inventory`

```json
{
  "name": "PlayStation 5 Pro 2TB",
  "brand": "Sony",
  "model": "CFI-7000",
  "type": "NEXT_GEN",
  "price": 699.99,
  "cost": 580.00,
  "stock": 4
}
```

`name` es obligatorio. `type` admite los valores de hardware que maneja el formulario, por ejemplo `NEXT_GEN`, `LAPTOP` y `RETRO`. ORDS genera el certificado GS. En exito, Express devuelve el resultado de ORDS con estado `201`.

Nota de estado actual: el handler captura tambien los fallos de ORDS como `400`; las demas rutas proxy de escritura usan `502` para fallos remotos.

### Actualizar producto

`PATCH /api/inventory/:id`

```json
{
  "name": "Producto actualizado desde ORDS",
  "price": 489.99,
  "stock": 10,
  "cost": 400.00,
  "description": "Datos actualizados",
  "providerId": 1
}
```

El ID debe ser entero positivo. Express envia el cuerpo a ORDS `POST /productos/:id/actualizar/`. Los campos enviados por ORDS pueden ser parciales; precio, stock y costo deben ser no negativos si se incluyen.

### Desactivar producto (baja logica)

`DELETE /api/inventory/:id`

No requiere cuerpo. Express lo traduce a ORDS `POST /productos/:id/desactivar/` con `{}`. ORDS conserva el registro y lo marca inactivo.

### Actualizar certificado GS

`PATCH /api/inventory/:id/certificate`

```json
{
  "hwPct": 100,
  "aestheticPct": 96,
  "thermalPct": 98,
  "pointsReviewed": 40,
  "warrantyMonths": 12,
  "inspectionDetail": "Prueba termica y revision visual aprobadas",
  "technician": "Laboratorio Gaming Solutions"
}
```

Los porcentajes deben estar entre 0 y 100; los puntos revisados y meses de garantia deben ser enteros no negativos. Express envia el payload a ORDS `POST /productos/:id/certificado/actualizar/`.

### Registrar venta

`POST /api/sales`

```json
{
  "customerId": 1,
  "payment": "TRANSFERENCIA",
  "items": [
    { "productId": 2, "quantity": 1, "price": 349.99 }
  ],
  "notes": "Entrega en tienda"
}
```

La API local recibe `items`, pero el endpoint ORDS solo acepta una linea. Express valida que haya exactamente un elemento, calcula `total` y envia a ORDS `/ventas/` los campos planos `customerId`, `payment`, `total`, `productId`, `quantity`, `price` y `notes`. `items` con mas de un elemento se rechaza.

### Registrar compra

`POST /api/purchases`

```json
{
  "providerId": 1,
  "items": [
    { "productId": 61, "quantity": 2, "cost": 290.00 }
  ],
  "notes": "Reabastecimiento"
}
```

La API local recibe el articulo dentro de `items`, pero ORDS `/compras/` espera una sola linea plana. Express exige exactamente un articulo en modo ORDS y envia `providerId`, `productId`, `quantity`, `cost` y `notes` al nivel raiz. No enviar varios articulos en una solicitud.

## Ejemplo para consumir desde JavaScript

```js
async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}

const products = await apiRequest('/api/inventory');
const created = await apiRequest('/api/inventory', {
  method: 'POST',
  body: JSON.stringify({ name: 'Consola de ejemplo', price: 250, stock: 1 })
});
```

## Errores y notas para integracion

- `400`: payload invalido, ID invalido o validacion local fallida.
- `404`: recurso inexistente en las rutas de detalle o demo.
- `501`: operacion no disponible en la rama o modo actual.
- `502`: fallo al consultar o modificar un recurso ORDS.
- `503`: la comprobacion de salud no pudo verificar ORDS.
- `GET /api/dashboard` requiere que respondan dashboard, productos y consulta de ventas; si cualquiera falla, el dashboard devuelve error en vez de completar con datos demo.
- Algunas rutas GET (`/api/categories`, `/api/audit`) devuelven `[]` en demo porque no hay catalogos de ejemplo para esas entidades.
- La baja demo elimina el elemento de la lista en memoria para simular la baja; en ORDS se solicita baja logica.
- La compra demo es un stub: devuelve `{ "id": 2001 }`, pero no registra la compra ni modifica el stock.
- Las operaciones POST/PATCH/DELETE se han probado en demo, no contra APEX. Antes de usarlas en produccion, confirmar que los handlers ORDS esten publicados y que acepten los payloads descritos.
