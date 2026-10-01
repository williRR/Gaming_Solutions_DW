# Gaming Solutions | Panel de Administración e Inventario Certificado #GS

Sistema de gestión administrativa y control de inventarios para **Gaming Solutions**. Permite administrar el catálogo de hardware gamer (Consolas Next-Gen, Laptops Gamer de alto rendimiento y Retro Restorations recapacitadas), gestionar certificados de inspección técnica **#GS**, registrar ventas presenciales (efectivo/transferencia), compras a proveedores y supervisar métricas en tiempo real.

---

## 1. Guía de Instalación de Base de Datos en Oracle APEX

En Oracle APEX abre **SQL Workshop > SQL Scripts > Upload** y ejecuta los scripts ubicados en la carpeta `sql/` en este orden estricto:

1. **`sql/01_schema.sql`**: Crea las tablas `ROLES`, `USUARIOS`, `CATEGORIAS`, `PROVEEDORES`, `CLIENTES`, `PRODUCTOS`, `CERTIFICADOS_GS`, `PRODUCTOS_DETALLE_LAPTOP`, `PRODUCTOS_DETALLE_RETRO`, `PRODUCTOS_FOTOS`, `COMPRAS`, `COMPRAS_DETALLE`, `VENTAS`, `VENTAS_DETALLE`, `CUPONES_DESCUENTO`, vista `CONSOLAS` e índices de rendimiento.
2. **`sql/02_auditoria.sql`**: Crea la tabla `BITACORA_AUDITORIA` y los triggers PL/SQL de seguimiento automatizado en JSON.
3. **`sql/03_seed.sql`**: Inserta datos de prueba de productos (PS5, Xbox Series X, Switch OLED, Laptops ROG/MSI, SNES, GBC, Genesis) con sus certificaciones `#GS-2201` a `#GS-2208`, clientes, proveedores y ventas.
4. **`sql/04_ords_rest_endpoints.sql`**: Publica automáticamente los Endpoints REST en Oracle ORDS.
5. **Opcional: `sql/05_ords_crud_extensions.sql`**: agrega rutas adicionales para categorías, actualización/baja lógica de productos y proveedores. No es necesario para el contrato listado en la sección 3; ejecútalo solo si el equipo decide publicar también esas extensiones.

---

## 2. CRUD de productos y categorías

El panel usa rutas locales de Express. Para probar los formularios sin escribir en Oracle:

```powershell
$env:DEMO_MODE = "true"
npm start
```

Abre `http://localhost:3000`. En demo, altas, ediciones y bajas solo viven en memoria y se pierden al detener el servidor.

Con `DEMO_MODE=false`, Express reenvía a ORDS los métodos documentados en la sección 3. El recurso de categorías no forma parte de ese contrato: el CRUD de categorías queda disponible en demo o al conectarse directamente a Oracle, pero se oculta en modo ORDS.

| Recurso ORDS | Operaciones documentadas |
| --- | --- |
| `productos/` | `GET`, `POST` |
| `productos/:id` | `PUT`, `DELETE` |
| `dashboard/` | `GET` |
| `clientes/` | `GET` |
| `proveedores/` | `GET` |
| `ventas/` | `POST` |
| `compras/` | `POST` |
| `auditoria/` | `GET` |

Las actualizaciones de producto solo envían `price` y `stock`. La creación usa el payload del README (`name`, `brand`, `model`, `type`, `price`, `cost`, `stock`, `description`, `hw_pct`, `aesthetic_pct`, `thermal_pct`); ORDS determina la categoría a partir del tipo. Ventas y compras se traducen al payload plano con un producto por operación.

Configura `ORDS_BASE_URL` y las variables `ORDS_*_RESOURCE` en `.env`. Si el equipo decide usar rutas adicionales, revisa también `sql/05_ords_crud_extensions.sql`. Consulta [GUIA_INTEGRACION_ORDS.md](GUIA_INTEGRACION_ORDS.md) para instrucciones de configuración y para saber dónde cambiar las rutas. El script SQL debe ejecutarse y comprobarse en el workspace Oracle del equipo: no se valida automáticamente desde Node.js.

---

## 3. Catálogo Completo de Endpoints REST (ORDS)

A continuación se detalla la lista de todos los Endpoints REST requeridos para la operación del panel administrativo.

Base URL estándar de ORDS:
`https://oracleapex.com/ords/willi_gs/gaming/`

---

### A. Productos e Inventario (Catálogo & Certificados #GS)

#### 1. `GET /gaming/productos/`
- **Descripción**: Obtiene la lista completa de productos activos con sus Certificados #GS y métricas de inspección técnica.
- **Método**: `GET`
- **Maneja ORDS (Query)**:
  ```sql
  SELECT 
    p.ID_PRODUCTO AS "id",
    p.NOMBRE AS "name",
    p.MARCA AS "brand",
    p.MODELO AS "model",
    p.TIPO_HARDWARE AS "type",
    c.NOMBRE AS "category",
    p.PRECIO_VENTA AS "price",
    p.PRECIO_COMPRA AS "cost",
    p.STOCK AS "stock",
    CASE 
      WHEN p.STOCK = 0 THEN 'Agotado' 
      WHEN p.STOCK <= 3 THEN 'Stock bajo' 
      ELSE 'Disponible' 
    END AS "status",
    cert.CODIGO_CERTIFICADO AS "certificate",
    cert.HARDWARE_ORIGINAL_PCT AS "hw_pct",
    cert.ESTADO_ESTETICO_PCT AS "aesthetic_pct",
    cert.RENDIMIENTO_TERMICO_PCT AS "thermal_pct",
    cert.MESES_GARANTIA AS "warranty_months"
  FROM PRODUCTOS p
  JOIN CATEGORIAS c ON c.ID_CATEGORIA = p.ID_CATEGORIA
  LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
  WHERE p.ACTIVO = 'S'
  ORDER BY p.FECHA_INGRESO DESC
  ```
- **Respuesta JSON**:
  ```json
  {
    "items": [
      {
        "id": 1,
        "name": "PlayStation 5 Slim Digital Edition",
        "brand": "Sony",
        "model": "CFI-2015",
        "type": "NEXT_GEN",
        "category": "Consolas Next-Gen",
        "price": 499.99,
        "cost": 420.00,
        "stock": 8,
        "status": "Disponible",
        "certificate": "#GS-2201",
        "hw_pct": 100,
        "aesthetic_pct": 96,
        "thermal_pct": 98,
        "warranty_months": 12
      }
    ]
  }
  ```

---

#### 2. `POST /gaming/productos/`
- **Descripción**: Registra un nuevo producto de hardware e inserta automáticamente su Certificado de Inspección #GS.
- **Método**: `POST`
- **Cuerpo de la Petición (JSON)**:
  ```json
  {
    "name": "Laptop Lenovo Legion Pro 5",
    "brand": "Lenovo",
    "model": "16IRX8",
    "type": "LAPTOP",
    "price": 1399.99,
    "cost": 1100.00,
    "stock": 3,
    "description": "Intel i7-13700HX, RTX 4060, 16GB RAM, 1TB SSD",
    "hw_pct": 100,
    "aesthetic_pct": 98,
    "thermal_pct": 96
  }
  ```
- **Respuesta JSON (HTTP 201 Created)**:
  ```json
  {
    "id": 9,
    "certificate": "#GS-2209",
    "message": "Producto y certificado creados exitosamente"
  }
  ```

---

#### 3. `PUT /gaming/productos/:id`
- **Descripción**: Actualiza el precio de venta y el nivel de stock de un producto.
- **Método**: `PUT` o `PATCH`
- **Cuerpo de la Petición (JSON)**:
  ```json
  {
    "price": 1349.99,
    "stock": 5
  }
  ```

---

#### 4. `DELETE /gaming/productos/:id`
- **Descripción**: Desactiva un producto del catálogo (baja lógica `ACTIVO = 'N'`).
- **Método**: `DELETE`

---

### B. Métricas del Dashboard

#### 5. `GET /gaming/dashboard/`
- **Descripción**: Retorna los totales consolidados para las tarjetas superiores del panel.
- **Método**: `GET`
- **Respuesta JSON**:
  ```json
  {
    "mode": "ords",
    "metrics": {
      "inventory": 29,
      "lowStock": 4,
      "monthlySales": 13840.50,
      "customers": 86
    }
  }
  ```

---

### C. Catálogos Auxiliares

#### 6. `GET /gaming/clientes/`
- **Descripción**: Lista de clientes registrados para llenar el combo en el formulario de ventas.
- **Método**: `GET`
- **Query SQL**:
  ```sql
  SELECT ID_CLIENTE AS "id", NOMBRE AS "name", EMAIL AS "email", TELEFONO AS "phone" FROM CLIENTES ORDER BY NOMBRE;
  ```

---

#### 7. `GET /gaming/proveedores/`
- **Descripción**: Lista de proveedores registrados para compras.
- **Método**: `GET`
- **Query SQL**:
  ```sql
  SELECT ID_PROVEEDOR AS "id", NOMBRE AS "name", TIPO_PROVEEDOR AS "type" FROM PROVEEDORES ORDER BY NOMBRE;
  ```

---

### D. Operaciones de Ventas y Compras (Efectivo / Transferencia)

#### 8. `POST /gaming/ventas/`
- **Descripción**: Registra una venta en efectivo o transferencia, descuenta el stock atómicamente e inserta la línea de detalle.
- **Método**: `POST`
- **Cuerpo de la Petición (JSON)**:
  ```json
  {
    "customerId": 1,
    "payment": "EFECTIVO",
    "total": 499.99,
    "productId": 1,
    "quantity": 1,
    "price": 499.99,
    "notes": "Entrega en tienda con comprobante"
  }
  ```
- **Respuesta JSON (HTTP 201 Created)**:
  ```json
  {
    "id": 1050,
    "message": "Venta registrada con éxito"
  }
  ```

---

#### 9. `POST /gaming/compras/`
- **Descripción**: Registra una compra a proveedor, aumentando el stock disponible del producto.
- **Método**: `POST`
- **Cuerpo de la Petición (JSON)**:
  ```json
  {
    "providerId": 1,
    "productId": 4,
    "quantity": 2,
    "cost": 1250.00
  }
  ```

---

### E. Auditoría del Sistema

#### 10. `GET /gaming/auditoria/`
- **Descripción**: Consulta los últimos eventos registrados en la bitácora de auditoría.
- **Método**: `GET`
- **Query SQL**:
  ```sql
  SELECT 
    ID_AUDITORIA AS "id",
    TABLA_AFECTADA AS "table",
    OPERACION AS "operation",
    USUARIO_BD AS "db_user",
    TO_CHAR(FECHA_EVENTO, 'YYYY-MM-DD HH24:MI:SS') AS "timestamp",
    VALORES_ANTERIORES AS "old_values",
    VALORES_NUEVOS AS "new_values"
  FROM BITACORA_AUDITORIA
  ORDER BY FECHA_EVENTO DESC
  FETCH FIRST 50 ROWS ONLY;
  ```

---

## 3. Instrucciones de Configuración en Oracle APEX (Paso a Paso)

Existen dos opciones para dejar habilitados estos endpoints en tu cuenta de Oracle APEX:

### Opción 1: Ejecución Automática por Script PL/SQL (Recomendado)
1. Entra a **SQL Workshop > SQL Scripts**.
2. Ejecuta el archivo [`sql/04_ords_rest_endpoints.sql`](file:///c:/Users/user/OneDrive/Desktop/Uni/8vo%20ciclo/desarrollo%20web/Proyecto%20fase%202/sql/04_ords_rest_endpoints.sql).
3. Este script invoca los paquetes `ORDS.ENABLE_SCHEMA`, `ORDS.DEFINE_MODULE`, `ORDS.DEFINE_TEMPLATE` y `ORDS.DEFINE_HANDLER` creando todos los endpoints indicados arriba.

### Opción 2: Configuración Visual desde la Interfaz de APEX
1. Ve a **SQL Workshop > REST Data Services**.
2. Si la esquina indica *Schema Not Enabled*, haz clic en **Register Schema / Enable Schema**. Define como alias de URL: `gaming`.
3. Haz clic en **Modules > Create Module**:
   - **Module Name**: `gaming`
   - **Base Path**: `gaming/`
   - **Is Published**: Yes.
4. Dentro del módulo `gaming`, crea una plantilla **Resource Template**:
   - **URI Pattern**: `productos/`
5. Crea los **Handlers** para la plantilla `productos/`:
   - **GET**: Source Type: `Collection Feed`. Pega la consulta SQL del Endpoint 1.
   - **POST**: Source Type: `PL/SQL`. Pega el bloque de código PL/SQL del Endpoint 2.

---

## 4. Conexión con el Servidor Node.js

Para conectar tu servidor Node.js local con los Endpoints ORDS en Oracle Cloud:

1. Edita tu archivo `.env` en la raíz del proyecto:
   ```env
   PORT=3000
   DEMO_MODE=false
   ORDS_BASE_URL=https://<tu-instancia-apex>.oraclecloud.com/ords/<tu_esquema>/gaming/
   ORDS_PRODUCTS_RESOURCE=productos/
   ORDS_CUSTOMERS_RESOURCE=clientes/
   ```
   Si el endpoint real de clientes está publicado como `catalogos/`, configura `ORDS_CUSTOMERS_RESOURCE=catalogos/`.
2. Inicia el servidor:
   ```bash
   npm start
   ```
3. Abre tu navegador en [http://localhost:3000](http://localhost:3000) para operar el panel.
