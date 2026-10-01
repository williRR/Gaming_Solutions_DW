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

Para configurar ORDS, crea `.env` en la raíz a partir de `.env.example` y configura la base del módulo y los nombres de recursos:

```env
PORT=3000
DEMO_MODE=false
ORDS_BASE_URL=https://<host>/ords/<esquema>/gaming/
ORDS_PRODUCTS_RESOURCE=productos/
ORDS_DASHBOARD_RESOURCE=dashboard/
ORDS_CUSTOMERS_RESOURCE=clientes/
ORDS_PROVIDERS_RESOURCE=proveedores/
ORDS_SALES_RESOURCE=ventas/
ORDS_PURCHASES_RESOURCE=compras/
ORDS_AUDIT_RESOURCE=auditoria/
```

Reinicia Node después de cambiar el `.env`. Los nombres de recursos se pueden cambiar aquí sin modificar `public/`; solo cambia también el valor correspondiente si el administrador renombra una ruta. Como compatibilidad, todavía se acepta `ORDS_INVENTORY_URL` con la URL completa antigua del endpoint de productos. No guardes credenciales en el repositorio. El archivo `.env` está ignorado por Git.

## 3. ORDS existente y extensión del repositorio

El contrato de la sección 3 de `README.md`, que la aplicación sigue por defecto, es:

| Ruta ORDS | Método | Uso |
| --- | --- | --- |
| `productos/` | `GET`, `POST` | Lista/crea productos |
| `productos/:id` | `PUT`, `DELETE` | Actualiza precio/stock; baja lógica |
| `dashboard/` | `GET` | Métricas |
| `clientes/` | `GET` | Lista clientes |
| `proveedores/` | `GET` | Lista proveedores |
| `ventas/` | `POST` | Registra una venta |
| `compras/` | `POST` | Registra una compra |
| `auditoria/` | `GET` | Lista eventos auditados |

Importante: el archivo actualmente presente en el repositorio, `sql/04_ords_rest_endpoints.sql`, no coincide completamente con ese contrato: define `catalogos/` en vez de `clientes/`, y no incluye PUT/DELETE de productos, proveedores, compras ni auditoría. El servidor usa por defecto las rutas descritas en el README; si el despliegue real se creó ejecutando solo el SQL 04, cambia `ORDS_CUSTOMERS_RESOURCE=catalogos/` y ten presente que las otras rutas faltantes devolverán 404 hasta publicarse.

El CRUD de categorías no aparece en el contrato README. En modo ORDS la interfaz oculta la administración de categorías y el servidor responde `501` a las rutas locales `/api/categories` en lugar de inventar rutas ORDS. La asociación de un producto se determina por el tipo recibido al crear, como en el handler descrito por el README.

`sql/05_ords_crud_extensions.sql` es un añadido opcional de este repositorio, no un endpoint que se haya confirmado desplegado en el ORDS de tu compañero. Solo debe ejecutarse si el equipo acuerda publicar esas rutas adicionales. Puede redefinir handlers existentes.

### Aplicar la extensión ORDS

No ejecutes scripts SQL para usar rutas que ya están publicadas por tu compañero. Si el equipo acuerda agregar rutas nuevas, primero revisa `sql/05_ords_crud_extensions.sql`, coordina con el responsable y ejecútalo solo en el esquema correcto. No recrees tablas ni vuelvas a cargar el seed para cambiar variables o rutas locales.

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
| `/api/categories...` | Solo demo/Oracle directo; no existe en el contrato ORDS del README |
| `GET /api/catalogs` | Carga clientes, proveedores e inventario para formularios |
| `POST /api/sales` | Traduce la venta del formulario al payload plano de ORDS |
| `POST /api/purchases` | Traduce la compra al payload plano de ORDS |
| `GET /api/audit` | Lee eventos de auditoría |

Las rutas locales de categorías solo aplican al modo demo o conexión Oracle directa. En modo ORDS, categoría no está soportada por el contrato enumerado en README. Para productos, `DELETE` pide una baja lógica remota.

## 5. JSON de escritura

### Crear producto

```json
{
  "name": "Laptop Lenovo Legion Pro 5",
  "brand": "Lenovo",
  "model": "16IRX8",
  "type": "LAPTOP",
  "price": 1399.99,
  "cost": 1100,
  "stock": 3,
  "description": "Intel i7, RTX 4060",
  "hw_pct": 100,
  "aesthetic_pct": 98,
  "thermal_pct": 96
}
```

El frontend no envía `categoryId` al ORDS; el handler decide la categoría según el tipo. El certificado se genera en ORDS.

### Editar producto

```json
{ "price": 1349.99, "stock": 5 }
```

Se actualizan solo el precio y el stock, tal como define el contrato del README. El formulario deshabilita los demás campos al editar para no dar a entender que ORDS los guarda.

### Categoría en modo demo/direct Oracle

```json
{
  "name": "Laptops Gamer",
  "description": "Equipos con pruebas térmicas",
  "slug": "laptops-gamer",
  "warrantyMonths": 18
}
```

El CRUD de categorías de la página solo se habilita en demo o conexión Oracle directa, no en el modo ORDS descrito en este contrato. En modo ORDS, el usuario indica tipo de hardware y el endpoint decide la categoría.

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

El servidor envía esa forma al endpoint `POST /compras/`. La validez de la actualización del stock y la respuesta dependen del handler desplegado por el equipo.

## 6. Cambiar nombres de endpoints

El lugar recomendado es el `.env` local, no `public/app.js`:

| Variable | Recurso controlado |
| --- | --- |
| `ORDS_BASE_URL` | Host, alias del esquema y módulo, por ejemplo `.../gaming/` |
| `ORDS_PRODUCTS_RESOURCE` | Lista, creación, actualización y baja de productos |
| `ORDS_DASHBOARD_RESOURCE` | Métricas |
| `ORDS_CUSTOMERS_RESOURCE` | Clientes; usa `catalogos/` si ese es el nombre desplegado |
| `ORDS_PROVIDERS_RESOURCE` | Proveedores |
| `ORDS_SALES_RESOURCE` | Ventas |
| `ORDS_PURCHASES_RESOURCE` | Compras |
| `ORDS_AUDIT_RESOURCE` | Auditoría |

La lectura de la URL y estos defaults están centralizados al inicio de `src/server.js`, en `ordsResources`, `ordsBaseUrl` y `ordsResourceUrl()`. Solo habría que editar código allí si agregan un recurso nuevo o si el endpoint cambia el formato/payload, no simplemente porque cambie el nombre de ruta.

## 7. Límites conocidos y decisiones

- El script 05 es una extensión opcional añadida en el repositorio; no se ejecuta automáticamente al iniciar Node.js y no se debe suponer que esté desplegado.
- Los cambios SQL/PLSQL no se pueden validar localmente sin acceso al workspace Oracle. `npm run check` solo valida sintaxis de JavaScript; en Oracle también hay que ejecutar el script y probar sus handlers.
- El dashboard devuelve ventas mensuales consolidadas, pero la lista visual de últimas ventas todavía usa datos de demostración: `04` no publica un endpoint para listar ventas.
- El CRUD expuesto por este panel no gestiona campos de usuario/rol, imágenes, detalles específicos de laptop/retro ni certificados de forma individual.
- La creación de producto delega la selección de categoría al endpoint ORDS, según el tipo; el `PUT` documentado solo cambia precio y stock.
- No se configuró autenticación en los scripts de ORDS. Para un entorno público o de producción, el administrador debe proteger las rutas y restringir el acceso.
- La lista visual de ventas recientes continúa usando datos demo porque el catálogo no ofrece un `GET /ventas/`.

## 8. Comprobaciones antes de integrar otro módulo

1. Confirma el host y alias de esquema ORDS con el administrador; coloca la URL real en `.env`.
2. Comprueba `GET /productos/` y `GET /dashboard/`.
3. Comprueba `GET /clientes/`, `GET /proveedores/` y `GET /auditoria/`; ajusta sus variables de recurso si el despliegue usa otro nombre.
4. Prueba escrituras solo con registros de prueba y autorización. No pruebes la baja de productos reales sin aprobación.
5. Inicia el servidor con `DEMO_MODE=false` y valida desde el panel que los cambios vuelvan a leerse desde ORDS.
6. Ante un error, inspecciona la respuesta HTTP de ORDS: Express conserva el estado HTTP y el texto devuelto por el servidor remoto en las operaciones de escritura.
