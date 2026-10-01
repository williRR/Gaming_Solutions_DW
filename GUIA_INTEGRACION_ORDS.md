# Guía para desarrolladores: integración con Oracle ORDS

Esta guía explica cómo ejecutar y extender el panel de Gaming Solutions y qué parte del contrato REST corresponde a los scripts SQL del repositorio. Está separada del README principal para que un compañero pueda incorporarse sin tener que inferir la arquitectura leyendo todo el código.

## 1. Arquitectura

```text
Navegador (public/)
        |
        | solicita /api/...
        v
Express (src/server.js)
        |
        | HTTP/JSON hacia ORDS
        v
Oracle REST Data Services
        |
        v
Esquema Oracle (PRODUCTOS, CATEGORIAS, CLIENTES, ...)
```

El navegador no consulta Oracle directamente. En modo normal, Express envía las solicitudes al ORDS configurado. En modo demo, Express responde con arreglos locales en memoria y no modifica la base de datos.

## 2. Preparar el proyecto localmente

Requiere una versión de Node.js que soporte `fetch` y `AbortSignal.timeout` (Node 18 o posterior).

```powershell
npm install
$env:DEMO_MODE = "true"
npm start
```

Visita `http://localhost:3000`. Los datos creados, modificados o eliminados en modo demo desaparecen al detener el proceso. Para detenerlo, usa `Ctrl+C`.

Para configurar ORDS, crea `.env` en la raíz a partir de `.env.example` y usa la URL del endpoint de productos como referencia:

```env
PORT=3000
DEMO_MODE=false
ORDS_INVENTORY_URL=https://<host>/ords/<esquema>/gaming/productos/
```

La URL base se deriva de `ORDS_INVENTORY_URL`; Express forma desde ella las rutas `dashboard/`, `catalogos/`, `proveedores/`, `ventas/` y las rutas de producto/categoría. No guardes credenciales en el repositorio. El archivo `.env` está ignorado por Git.

## 3. ORDS existente y extensión del repositorio

`sql/04_ords_rest_endpoints.sql` es el script base entregado por el equipo. Define:

| Ruta ORDS | Método | Uso |
| --- | --- | --- |
| `productos/` | `GET` | Productos activos y certificado #GS |
| `productos/` | `POST` | Crea producto y certificado |
| `dashboard/` | `GET` | Métricas |
| `catalogos/` | `GET` | Clientes |
| `ventas/` | `POST` | Registra una venta de un producto |

El script base no define categorías, cambios/bajas de producto, proveedores ni compras. Para cubrir el CRUD solicitado y el formulario de compras, este repositorio agrega `sql/05_ords_crud_extensions.sql`:

| Ruta ORDS | Método | Origen |
| --- | --- | --- |
| `productos/` | `GET`, `POST` | `04`; redefinidos por `05` para incluir `category_id` y aceptar `categoryId` |
| `productos/:id` | `PUT`, `DELETE` | Agregados en `05` |
| `categorias/` | `GET`, `POST` | Agregados en `05` |
| `categorias/:id` | `PUT`, `DELETE` | Agregados en `05` |
| `proveedores/` | `GET` | Agregado en `05` |
| `ventas/` | `POST` | `04`; redefinido en `05` para validar stock antes de insertar |

La ruta de compra `compras/` no está publicada por estos scripts. Por eso la API local responde `501 Not Implemented` para registrar compras en modo ORDS; no simula una compra exitosa.

### Aplicar la extensión ORDS

Si las tablas y el módulo ORDS del script `04` ya están creados, no vuelvas a crear el esquema ni a cargar el seed. En SQL Workshop ejecuta `sql/05_ords_crud_extensions.sql` en el mismo workspace/esquema después del script `04`. La extensión redefine algunos handlers existentes; verifica los resultados en REST Workshop o enviando solicitudes a las rutas.

Si aún no existe el esquema, primero sigue el orden de instalación indicado en `README.md` (scripts `01` a `04`) y luego ejecuta `05`. El script 05 no crea tablas ni habilita por sí solo el esquema ORDS.

## 4. API local que consume la interfaz

Estas son las rutas de Express. La interfaz de `public/app.js` las llama en el mismo origen:

| Ruta local | Operación |
| --- | --- |
| `GET /api/dashboard` | Lee inventario y, en ORDS, obtiene métricas de `dashboard/` |
| `GET /api/inventory` | Lista productos |
| `POST /api/inventory` | Crea producto y certificado |
| `PUT /api/inventory/:id` | Cambia precio y stock |
| `DELETE /api/inventory/:id` | Baja lógica del producto |
| `GET /api/categories` | Lista categorías |
| `POST /api/categories` | Crea categoría |
| `PATCH /api/categories/:id` | Modifica categoría; Express lo traduce a `PUT` ORDS |
| `DELETE /api/categories/:id` | Elimina categoría si no tiene productos relacionados |
| `GET /api/catalogs` | Carga clientes, proveedores e inventario para formularios |
| `POST /api/sales` | Traduce la venta del formulario al payload plano de ORDS |

Para categorías, `DELETE` contesta `409` si hay productos vinculados. Para productos, `DELETE` cambia `ACTIVO` a `N`, preservando las ventas y demás relaciones.

## 5. JSON de escritura

### Crear producto

```json
{
  "name": "Laptop Lenovo Legion Pro 5",
  "brand": "Lenovo",
  "model": "16IRX8",
  "type": "LAPTOP",
  "categoryId": 2,
  "price": 1399.99,
  "cost": 1100,
  "stock": 3,
  "description": "Intel i7, RTX 4060",
  "hw_pct": 100,
  "aesthetic_pct": 98,
  "thermal_pct": 96
}
```

`categoryId` fue añadido por el script 05 para que el usuario pueda elegir la categoría en el formulario. Si no se envía, el handler intenta asociar una categoría por el slug convencional de `NEXT_GEN`, `LAPTOP` o `RETRO`. El certificado se genera en ORDS.

### Editar producto

```json
{ "price": 1349.99, "stock": 5 }
```

Se actualizan solo el precio y el stock, tal como define el contrato del README. El formulario deshabilita los demás campos al editar para no dar a entender que ORDS los guarda.

### Crear o editar categoría

```json
{
  "name": "Laptops Gamer",
  "description": "Equipos con pruebas térmicas",
  "slug": "laptops-gamer",
  "warrantyMonths": 18
}
```

El `slug` debe ser único; la tabla Oracle contiene una restricción única. El ID se genera automáticamente en Oracle.

### Registrar venta

La interfaz local agrupa el producto en un arreglo; Express lo adapta al handler del script, que recibe un solo producto:

```json
{
  "customerId": 1,
  "payment": "EFECTIVO",
  "total": 499.99,
  "productId": 1,
  "quantity": 1,
  "price": 499.99,
  "notes": "Venta en tienda"
}
```

El script 05 actualiza el stock y rechaza la operación si no hay suficiente existencia.

## 6. Límites conocidos y decisiones

- El script 05 es una extensión añadida en el repositorio; no se ejecuta automáticamente al iniciar Node.js. Debe aplicarse al ORDS del equipo.
- Los cambios SQL/PLSQL no se pueden validar localmente sin acceso al workspace Oracle. `npm run check` solo valida sintaxis de JavaScript; en Oracle también hay que ejecutar el script y probar sus handlers.
- El dashboard devuelve ventas mensuales consolidadas, pero la lista visual de últimas ventas todavía usa datos de demostración: `04` no publica un endpoint para listar ventas.
- El CRUD expuesto por este panel no gestiona campos de usuario/rol, imágenes, detalles específicos de laptop/retro ni certificados de forma individual.
- La creación de producto asigna la categoría seleccionada; el endpoint `PUT` documentado solo cambia precio y stock, no permite cambiar la categoría del producto existente.
- No se configuró autenticación en los scripts de ORDS. Para un entorno público o de producción, el administrador debe proteger las rutas y restringir el acceso.
- El script de compras no existe aún, así que las compras reales no están habilitadas.

## 7. Comprobaciones antes de integrar otro módulo

1. Confirma el host y alias de esquema ORDS con el administrador; coloca la URL real en `.env`.
2. Comprueba `GET /productos/`, `GET /dashboard/` y `GET /catalogos/`.
3. Ejecuta `05` en el mismo esquema y comprueba `GET /categorias/` y `GET /proveedores/`.
4. Crea registros de prueba y usa sus IDs al probar `PUT` y `DELETE`. No pruebes la baja de productos reales sin aprobación.
5. Inicia el servidor con `DEMO_MODE=false` y valida desde el panel que los cambios vuelvan a leerse desde ORDS.
6. Ante un error, inspecciona la respuesta HTTP de ORDS: Express conserva el estado HTTP y el texto devuelto por el servidor remoto en las operaciones de escritura.
