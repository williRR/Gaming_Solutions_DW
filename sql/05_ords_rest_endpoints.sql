-- ==============================================================================
-- Gaming Solutions: Endpoints REST adicionales para ORDS
-- Ejecutar DESPUES de 01_schema.sql, 02_auditoria.sql, 03_seed.sql y
-- 04_ords_rest_endpoints.sql.
--
-- Este script amplia el modulo "gaming" existente. No redefine los endpoints
-- publicados en 04_ords_rest_endpoints.sql.
-- ==============================================================================

DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  -- ============================================================================
  -- PROVEEDORES
  -- GET /gaming/proveedores/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'proveedores/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'proveedores/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT ID_PROVEEDOR AS "id",
                           NOMBRE AS "name",
                           TIPO_PROVEEDOR AS "type",
                           TELEFONO AS "phone",
                           EMAIL AS "email",
                           DIRECCION AS "address"
                      FROM PROVEEDORES
                     ORDER BY NOMBRE'
  );

  -- ============================================================================
  -- CATEGORIAS
  -- GET /gaming/categorias/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'categorias/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'categorias/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT ID_CATEGORIA AS "id",
                           NOMBRE AS "name",
                           DESCRIPCION AS "description",
                           GARANTIA_MESES_DEFECTO AS "defaultWarrantyMonths",
                           SLUG AS "slug"
                      FROM CATEGORIAS
                     ORDER BY NOMBRE'
  );

  -- ============================================================================
  -- CLIENTES
  -- GET /gaming/clientes/
  -- POST /gaming/clientes/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'clientes/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'clientes/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT ID_CLIENTE AS "id",
                           NOMBRE AS "name",
                           TELEFONO AS "phone",
                           EMAIL AS "email",
                           DIRECCION AS "address",
                           FECHA_REGISTRO AS "registeredAt"
                      FROM CLIENTES
                     ORDER BY NOMBRE'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'clientes/',
    p_method      => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source     => 'DECLARE
                       l_id_cliente NUMBER;
                     BEGIN
                       IF :name IS NULL THEN
                         RAISE_APPLICATION_ERROR(-20001, ''El nombre del cliente es obligatorio'');
                       END IF;

                       INSERT INTO CLIENTES (NOMBRE, TELEFONO, EMAIL, DIRECCION)
                       VALUES (:name, :phone, :email, :address)
                       RETURNING ID_CLIENTE INTO l_id_cliente;

                       :status := 201;
                       HTP.P(''{"id": '' || l_id_cliente ||
                             '', "message": "Cliente creado exitosamente"}'');
                     END;'
  );

  -- ============================================================================
  -- DETALLE DE PRODUCTO
  -- GET /gaming/productos/:id/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT p.ID_PRODUCTO AS "id",
                           p.SKU AS "sku",
                           p.NOMBRE AS "name",
                           p.MARCA AS "brand",
                           p.MODELO AS "model",
                           p.TIPO_HARDWARE AS "type",
                           c.ID_CATEGORIA AS "categoryId",
                           c.NOMBRE AS "category",
                           p.ID_PROVEEDOR AS "providerId",
                           pr.NOMBRE AS "provider",
                           p.PRECIO_VENTA AS "price",
                           p.PRECIO_COMPRA AS "cost",
                           p.STOCK AS "stock",
                           p.DESCRIPCION AS "description",
                           p.ACTIVO AS "active",
                           cert.CODIGO_CERTIFICADO AS "certificate",
                           cert.HARDWARE_ORIGINAL_PCT AS "hwPct",
                           cert.ESTADO_ESTETICO_PCT AS "aestheticPct",
                           cert.RENDIMIENTO_TERMICO_PCT AS "thermalPct",
                           cert.PUNTOS_REVISADOS AS "pointsReviewed",
                           cert.MESES_GARANTIA AS "warrantyMonths",
                           cert.DETALLE_INSPECCION AS "inspectionDetail",
                           lap.PROCESADOR AS "processor",
                           lap.GPU AS "gpu",
                           lap.RAM_GB AS "ramGb",
                           lap.ALMACENAMIENTO_GB AS "storageGb",
                           lap.SALUD_BATERIA_PCT AS "batteryHealthPct",
                           retro.CONDICION_ESTETICA_10 AS "aestheticCondition",
                           retro.INCLUYE_CAJA AS "includesBox",
                           retro.INCLUYE_MANUAL AS "includesManual",
                           retro.ESTADO_FUNCIONAL AS "functionalStatus"
                      FROM PRODUCTOS p
                      JOIN CATEGORIAS c ON c.ID_CATEGORIA = p.ID_CATEGORIA
                 LEFT JOIN PROVEEDORES pr ON pr.ID_PROVEEDOR = p.ID_PROVEEDOR
                 LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
                 LEFT JOIN PRODUCTOS_DETALLE_LAPTOP lap ON lap.ID_PRODUCTO = p.ID_PRODUCTO
                 LEFT JOIN PRODUCTOS_DETALLE_RETRO retro ON retro.ID_PRODUCTO = p.ID_PRODUCTO
                     WHERE p.ID_PRODUCTO = :id'
  );

  -- ============================================================================
  -- ACTUALIZACION Y BAJA LOGICA DE PRODUCTOS
  -- PATCH /gaming/productos/:id/
  -- DELETE /gaming/productos/:id/
  -- ============================================================================
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/',
    p_method      => 'PATCH',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source     => 'DECLARE
                       l_rows NUMBER;
                     BEGIN
                       UPDATE PRODUCTOS
                          SET NOMBRE = NVL(:name, NOMBRE),
                              PRECIO_VENTA = NVL(:price, PRECIO_VENTA),
                              PRECIO_COMPRA = NVL(:cost, PRECIO_COMPRA),
                              STOCK = NVL(:stock, STOCK),
                              DESCRIPCION = NVL(:description, DESCRIPCION),
                              ID_PROVEEDOR = NVL(:providerId, ID_PROVEEDOR)
                        WHERE ID_PRODUCTO = :id;

                       l_rows := SQL%ROWCOUNT;
                       IF l_rows = 0 THEN
                         :status := 404;
                         HTP.P(''{"error": "Producto no encontrado"}'');
                       ELSE
                         HTP.P(''{"id": '' || :id ||
                               '', "message": "Producto actualizado"}'');
                       END IF;
                     END;'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/',
    p_method      => 'DELETE',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source     => 'DECLARE
                       l_rows NUMBER;
                     BEGIN
                       UPDATE PRODUCTOS
                          SET ACTIVO = ''N''
                        WHERE ID_PRODUCTO = :id;

                       l_rows := SQL%ROWCOUNT;
                       IF l_rows = 0 THEN
                         :status := 404;
                         HTP.P(''{"error": "Producto no encontrado"}'');
                       ELSE
                         HTP.P(''{"id": '' || :id ||
                               '', "message": "Producto desactivado"}'');
                       END IF;
                     END;'
  );

  -- ============================================================================
  -- CERTIFICADO GS
  -- PATCH /gaming/productos/:id/certificado/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/certificado/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/certificado/',
    p_method      => 'PATCH',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source     => 'DECLARE
                       l_rows NUMBER;
                     BEGIN
                       UPDATE CERTIFICADOS_GS
                          SET HARDWARE_ORIGINAL_PCT = NVL(:hwPct, HARDWARE_ORIGINAL_PCT),
                              ESTADO_ESTETICO_PCT = NVL(:aestheticPct, ESTADO_ESTETICO_PCT),
                              RENDIMIENTO_TERMICO_PCT = NVL(:thermalPct, RENDIMIENTO_TERMICO_PCT),
                              PUNTOS_REVISADOS = NVL(:pointsReviewed, PUNTOS_REVISADOS),
                              MESES_GARANTIA = NVL(:warrantyMonths, MESES_GARANTIA),
                              DETALLE_INSPECCION = NVL(:inspectionDetail, DETALLE_INSPECCION),
                              TECNICO_RESPONSABLE = NVL(:technician, TECNICO_RESPONSABLE)
                        WHERE ID_PRODUCTO = :id;

                       l_rows := SQL%ROWCOUNT;
                       IF l_rows = 0 THEN
                         :status := 404;
                         HTP.P(''{"error": "Certificado no encontrado"}'');
                       ELSE
                         HTP.P(''{"productId": '' || :id ||
                               '', "message": "Certificado actualizado"}'');
                       END IF;
                     END;'
  );

  -- ============================================================================
  -- COMPRAS
  -- POST /gaming/compras/
  -- Este endpoint recibe una sola linea por solicitud, igual que el formulario
  -- actual del panel. Puede repetirse para una compra con varias lineas.
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'compras/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'compras/',
    p_method      => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source     => 'DECLARE
                       l_id_compra NUMBER;
                     BEGIN
                       IF :providerId IS NULL OR :productId IS NULL OR :quantity IS NULL OR :cost IS NULL THEN
                         RAISE_APPLICATION_ERROR(-20002, ''Proveedor, producto, cantidad y costo son obligatorios'');
                       END IF;
                       IF :quantity <= 0 OR :cost < 0 THEN
                         RAISE_APPLICATION_ERROR(-20003, ''Cantidad o costo invalido'');
                       END IF;

                       INSERT INTO COMPRAS (ID_PROVEEDOR, TOTAL_COMPRA, OBSERVACIONES)
                       VALUES (:providerId, :quantity * :cost, :notes)
                       RETURNING ID_COMPRA INTO l_id_compra;

                       UPDATE PRODUCTOS
                          SET STOCK = STOCK + :quantity,
                              PRECIO_COMPRA = :cost
                        WHERE ID_PRODUCTO = :productId;

                       IF SQL%ROWCOUNT = 0 THEN
                         RAISE_APPLICATION_ERROR(-20004, ''Producto no encontrado'');
                       END IF;

                       INSERT INTO COMPRAS_DETALLE
                         (ID_COMPRA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO)
                       VALUES
                         (l_id_compra, :productId, :quantity, :cost);

                       :status := 201;
                       HTP.P(''{"id": '' || l_id_compra ||
                             '', "total": '' || (:quantity * :cost) ||
                             '', "message": "Compra registrada y stock actualizado"}'');
                     END;'
  );

  -- ============================================================================
  -- VENTAS DE CONSULTA
  -- GET /gaming/ventas/consulta/
  -- GET /gaming/ventas/consulta/:id/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'ventas/consulta/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'ventas/consulta/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT v.ID_VENTA AS "id",
                           c.NOMBRE AS "customer",
                           TO_CHAR(v.FECHA_VENTA, ''YYYY-MM-DD'') AS "date",
                           v.METODO_PAGO AS "payment",
                           v.TOTAL_VENTA AS "total",
                           v.ESTADO_VENTA AS "status",
                           v.USUARIO_REGISTRO AS "registeredBy",
                           v.NOTAS_VENTA AS "notes"
                      FROM VENTAS v
                      JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
                     ORDER BY v.FECHA_VENTA DESC'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'ventas/consulta/:id/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'ventas/consulta/:id/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT v.ID_VENTA AS "saleId",
                           c.NOMBRE AS "customer",
                           v.FECHA_VENTA AS "date",
                           v.METODO_PAGO AS "payment",
                           v.TOTAL_VENTA AS "total",
                           v.ESTADO_VENTA AS "status",
                           p.ID_PRODUCTO AS "productId",
                           p.NOMBRE AS "product",
                           d.CANTIDAD AS "quantity",
                           d.PRECIO_UNITARIO AS "unitPrice",
                           d.SUBTOTAL AS "subtotal"
                      FROM VENTAS v
                      JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
                      JOIN VENTAS_DETALLE d ON d.ID_VENTA = v.ID_VENTA
                      JOIN PRODUCTOS p ON p.ID_PRODUCTO = d.ID_PRODUCTO
                     WHERE v.ID_VENTA = :id'
  );

  -- ============================================================================
  -- AUDITORIA
  -- GET /gaming/auditoria/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'auditoria/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'auditoria/',
    p_method      => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source     => 'SELECT ID_AUDITORIA AS "id",
                           TABLA_AFECTADA AS "table",
                           ID_REGISTRO AS "recordId",
                           OPERACION AS "operation",
                           USUARIO_BD AS "dbUser",
                           FECHA_EVENTO AS "timestamp",
                           VALORES_ANTERIORES AS "oldValues",
                           VALORES_NUEVOS AS "newValues"
                      FROM BITACORA_AUDITORIA
                     ORDER BY FECHA_EVENTO DESC
                     FETCH FIRST 50 ROWS ONLY'
  );

  COMMIT;
END;
/
