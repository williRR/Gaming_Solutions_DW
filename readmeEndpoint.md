# Endpoints adicionales de Gaming Solutions

Este documento describe los endpoints publicados por
[`sql/05_ords_rest_endpoints.sql`](./sql/05_ords_rest_endpoints.sql).

## Requisitos y ejecución

Ejecuta los scripts en este orden:

1. `sql/01_schema.sql`
2. `sql/02_auditoria.sql`
3. `sql/03_seed.sql`
4. `sql/04_ords_rest_endpoints.sql`
5. `sql/05_ords_rest_endpoints.sql`

El archivo 05 es incremental: presupone que el módulo ORDS `gaming` ya existe
porque fue creado por el archivo 04. No ejecutes el archivo 05 antes del 04.

## URL base

Reemplaza `<alias>` por el alias ORDS de tu esquema:

```text
https://<servidor>/ords/<alias>/gaming/
```

Ejemplo:

```text
https://oracleapex.com/ords/willi_gs/gaming/
```

Si tu instancia exige autenticación, agrega el mecanismo configurado en ORDS
(por ejemplo, `Authorization: Bearer <token>`).

## Endpoints publicados en el archivo 05

| Método | Ruta | Uso |
|---|---|---|
| GET | `/proveedores/` | Lista proveedores para el formulario de compras |
| GET | `/categorias/` | Lista categorías y garantía predeterminada |
| GET | `/clientes/` | Lista clientes con sus datos de contacto |
| POST | `/clientes/` | Registra un cliente |
| GET | `/productos/:id/` | Consulta el producto y sus datos GS |
| PATCH | `/productos/:id/` | Actualiza datos básicos del producto |
| DELETE | `/productos/:id/` | Desactiva el producto (`ACTIVO = 'N'`) |
| PATCH | `/productos/:id/certificado/` | Actualiza la inspección GS |
| POST | `/compras/` | Registra una compra y aumenta stock |
| GET | `/ventas/consulta/` | Lista ventas recientes |
| GET | `/ventas/consulta/:id/` | Consulta una venta y sus líneas |
| GET | `/auditoria/` | Consulta los últimos 50 eventos de auditoría |

Los endpoints ya existentes en el archivo 04 permanecen sin cambios:

- `GET /productos/`
- `POST /productos/`
- `GET /dashboard/`
- `GET /catalogos/`
- `POST /ventas/`

## Ejemplos de peticiones

### Listar proveedores

```http
GET https://<servidor>/ords/<alias>/gaming/proveedores/
```

Respuesta:

```json
{
  "items": [
    {
      "id": 1,
      "name": "Distribuciones Next Level S.A.C.",
      "type": "EMPRESA",
      "phone": "+51 987 654 321",
      "email": "ventas@nextlevel.pe",
      "address": "Av. Argentina 1420, Lima"
    }
  ]
}
```

### Registrar un cliente

```http
POST https://<servidor>/ords/<alias>/gaming/clientes/
Content-Type: application/json
```

```json
{
  "name": "Luis Vargas",
  "phone": "+51 999 888 777",
  "email": "luis@example.com",
  "address": "Av. Principal 123"
}
```

### Consultar el detalle de un producto

```http
GET https://<servidor>/ords/<alias>/gaming/productos/4/
```

La respuesta incluye datos generales, categoría, proveedor, certificado,
especificaciones de laptop o retro y estado activo.

### Actualizar un producto

```http
PATCH https://<servidor>/ords/<alias>/gaming/productos/4/
Content-Type: application/json
```

```json
{
  "name": "ASUS ROG Strix G16 RTX 4070 actualizado",
  "price": 1449.99,
  "stock": 5,
  "description": "Precio y stock actualizados",
  "providerId": 1
}
```

Solo los campos enviados se actualizan. Los campos omitidos conservan su valor.

### Desactivar un producto

```http
DELETE https://<servidor>/ords/<alias>/gaming/productos/4/
```

La operación es una baja lógica: no elimina el registro ni sus relaciones
históricas; establece `PRODUCTOS.ACTIVO` en `N`.

### Actualizar un certificado GS

```http
PATCH https://<servidor>/ords/<alias>/gaming/productos/4/certificado/
Content-Type: application/json
```

```json
{
  "hwPct": 100,
  "aestheticPct": 96,
  "thermalPct": 98,
  "pointsReviewed": 40,
  "warrantyMonths": 18,
  "inspectionDetail": "Prueba térmica y stress test aprobados",
  "technician": "Laboratorio Gaming Solutions"
}
```

### Registrar una compra

El endpoint recibe una línea de compra, que coincide con el formulario actual
del panel. Para una compra con varias líneas se puede invocar varias veces o
crear posteriormente un endpoint de lote.

```http
POST https://<servidor>/ords/<alias>/gaming/compras/
Content-Type: application/json
```

```json
{
  "providerId": 1,
  "productId": 4,
  "quantity": 2,
  "cost": 1250.00,
  "notes": "Reabastecimiento de laptops gamer"
}
```

El endpoint inserta en `COMPRAS` y `COMPRAS_DETALLE`, actualiza
`PRODUCTOS.STOCK` y `PRODUCTOS.PRECIO_COMPRA`, y confirma todo en una misma
transacción.

Respuesta `201 Created`:

```json
{
  "id": 12,
  "total": 2500,
  "message": "Compra registrada y stock actualizado"
}
```

### Consultar ventas

```http
GET https://<servidor>/ords/<alias>/gaming/ventas/consulta/
GET https://<servidor>/ords/<alias>/gaming/ventas/consulta/1050/
```

La primera ruta lista ventas. La segunda devuelve las líneas de la venta
indicada, incluyendo producto, cantidad, precio unitario y subtotal.

### Consultar auditoría

```http
GET https://<servidor>/ords/<alias>/gaming/auditoria/
```

Devuelve como máximo los 50 eventos más recientes de
`BITACORA_AUDITORIA`. Requiere que `sql/02_auditoria.sql` haya sido ejecutado.

## Notas de integración con Node.js

El frontend actual consume rutas locales como `/api/catalogs`,
`/api/purchases` y `/api/sales`. El archivo 05 publica ORDS, pero no cambia esas
rutas locales. Para usar estos endpoints desde el panel, `src/server.js` debe
seguir actuando como adaptador o el frontend debe cambiar sus URLs a la URL
base de ORDS.

Para el formulario de compras, el cuerpo que envía Node debe conservar el
formato de una sola línea:

```json
{
  "providerId": 1,
  "productId": 4,
  "quantity": 2,
  "cost": 1250
}
```

No se incluyó autenticación propia en este script. La protección debe
configurarse en ORDS/APEX y, para el certificado y la auditoría, debe
restringirse el acceso según los roles del proyecto.
