# Guía de Instalación en Oracle APEX y Catálogo de Endpoints ORDS

Este documento contiene las instrucciones paso a paso para desplegar la base de datos en **Oracle APEX** y la lista completa de **Endpoints REST (ORDS)** requeridos por el Panel Administrativo de **Gaming Solutions**.

---

## 1. Orden de Ejecución de Scripts SQL

Carga y ejecuta los archivos en tu Workspace de APEX en el menú **SQL Workshop > SQL Scripts**:

1. **`sql/01_schema.sql`**: Define el esquema relacional (`PRODUCTOS`, `CERTIFICADOS_GS`, `PRODUCTOS_DETALLE_LAPTOP`, `PRODUCTOS_DETALLE_RETRO`, `CLIENTES`, `PROVEEDORES`, `VENTAS`, `COMPRAS`, `ROLES`, `USUARIOS`, `CUPONES_DESCUENTO` y la vista `CONSOLAS`).
2. **`sql/02_auditoria.sql`**: Triggers PL/SQL y la tabla `BITACORA_AUDITORIA` con auditoría JSON.
3. **`sql/03_seed.sql`**: Datos de prueba iniciales con consolas Next-Gen, laptops gamer, retro restauros y certificados `#GS-2201` a `#GS-2208`.
4. **`sql/04_ords_rest_endpoints.sql`**: Publicación automática de endpoints ORDS en PL/SQL.

---

## 2. Catálogo de Endpoints REST (ORDS)

| Método | Ruta | Descripción | Payload de Entrada / Parámetros |
| :--- | :--- | :--- | :--- |
| **GET** | `/gaming/productos/` | Obtiene el catálogo de productos con certificados #GS y métricas de inspección. | N/A |
| **POST** | `/gaming/productos/` | Crea un producto nuevo y emite su certificado GS. | `{ "name": "...", "brand": "...", "type": "NEXT_GEN\|LAPTOP\|RETRO", "price": 499.99, "stock": 5 }` |
| **PUT** | `/gaming/productos/:id` | Actualiza precio de venta y stock. | `{ "price": 449.99, "stock": 8 }` |
| **DELETE**| `/gaming/productos/:id` | Da de baja lógica un producto (`ACTIVO = 'N'`). | N/A |
| **GET** | `/gaming/dashboard/` | Métricas consolidadas para las tarjetas superiores. | N/A |
| **GET** | `/gaming/clientes/` | Lista de clientes para selectores de venta. | N/A |
| **GET** | `/gaming/proveedores/` | Lista de proveedores para selectores de compra. | N/A |
| **POST** | `/gaming/ventas/` | Registra una venta en efectivo o transferencia y descuenta stock. | `{ "customerId": 1, "payment": "EFECTIVO", "total": 499.99, "productId": 1, "quantity": 1 }` |
| **POST** | `/gaming/compras/` | Registra compra a proveedor e incrementa stock. | `{ "providerId": 1, "productId": 2, "quantity": 5, "cost": 290.00 }` |
| **GET** | `/gaming/auditoria/` | Historial de cambios auditados en JSON. | N/A |

---

## 3. Ejemplo de Uso con Curl / Postman

### Consultar Inventario Certificado
```bash
curl -X GET "https://oracleapex.com/ords/willi_gs/gaming/productos/" \
     -H "Accept: application/json"
```

### Registrar Nuevo Producto con Certificación #GS
```bash
curl -X POST "https://oracleapex.com/ords/willi_gs/gaming/productos/" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "PlayStation 5 Pro",
           "brand": "Sony",
           "model": "CFI-7000",
           "type": "NEXT_GEN",
           "price": 699.99,
           "cost": 600.00,
           "stock": 3,
           "hw_pct": 100,
           "aesthetic_pct": 100,
           "thermal_pct": 99
         }'
```

### Registrar Venta en Efectivo
```bash
curl -X POST "https://oracleapex.com/ords/willi_gs/gaming/ventas/" \
     -H "Content-Type: application/json" \
     -d '{
           "customerId": 1,
           "payment": "EFECTIVO",
           "productId": 1,
           "quantity": 1,
           "price": 499.99,
           "notes": "Venta en tienda presencial"
         }'
```
