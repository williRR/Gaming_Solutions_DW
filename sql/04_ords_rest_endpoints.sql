-- ==============================================================================
-- Gaming Solutions: Publicación de Endpoints REST en Oracle APEX vía ORDS
-- Ejecutar en SQL Workshop -> SQL Commands o SQL Scripts en Oracle APEX
-- ==============================================================================

DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  -- El esquema debe estar habilitado previamente por APEX o por el administrador de ORDS.
  -- ORDS.ENABLE_SCHEMA requiere privilegios administrativos y no se ejecuta desde
  -- un esquema normal de APEX.

  -- 1. Definir el Módulo REST "gaming"
  ORDS.DEFINE_MODULE(
    p_module_name    => 'gaming',
    p_base_path      => 'gaming/',
    p_items_per_page => 100,
    p_status         => 'PUBLISHED',
    p_comments       => 'API REST de Administración para Gaming Solutions'
  );

  -- ============================================================================
  -- TEMPLATE: /gaming/productos/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'gaming',
    p_pattern        => 'productos/'
  );

  -- GET /gaming/productos/ (Consulta de Inventario con Certificados #GS)
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'gaming',
    p_pattern        => 'productos/',
    p_method         => 'GET',
    p_source_type    => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source         => 'SELECT 
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
                             WHEN p.STOCK = 0 THEN ''Agotado'' 
                             WHEN p.STOCK <= 3 THEN ''Stock bajo'' 
                             ELSE ''Disponible'' 
                           END AS "status",
                           cert.CODIGO_CERTIFICADO AS "certificate",
                           cert.HARDWARE_ORIGINAL_PCT AS "hw_pct",
                           cert.ESTADO_ESTETICO_PCT AS "aesthetic_pct",
                           cert.RENDIMIENTO_TERMICO_PCT AS "thermal_pct",
                           cert.MESES_GARANTIA AS "warranty_months"
                         FROM PRODUCTOS p
                         JOIN CATEGORIAS c ON c.ID_CATEGORIA = p.ID_CATEGORIA
                         LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
                         WHERE p.ACTIVO = ''S''
                         ORDER BY p.FECHA_INGRESO DESC',
    p_items_per_page => 100
  );

  -- POST /gaming/productos/ (Creación de Producto con Inspección Técnica)
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'gaming',
    p_pattern        => 'productos/',
    p_method         => 'POST',
    p_source_type    => ORDS.SOURCE_TYPE_PLSQL,
    p_source         => 'DECLARE
                           l_id_cat NUMBER;
                           l_id_prod NUMBER;
                           l_codigo_cert VARCHAR2(30);
                           l_type VARCHAR2(20);
                         BEGIN
                           l_type := NVL(:type, ''NEXT_GEN'');
                           
                           -- Categoría por defecto
                           SELECT MIN(ID_CATEGORIA) INTO l_id_cat FROM CATEGORIAS
                           WHERE SLUG LIKE ''%'' || LOWER(l_type) || ''%'' OR ROWNUM = 1;

                           INSERT INTO PRODUCTOS (
                             ID_CATEGORIA, NOMBRE, MARCA, MODELO, TIPO_HARDWARE, 
                             PRECIO_VENTA, PRECIO_COMPRA, STOCK, DESCRIPCION
                           ) VALUES (
                             NVL(l_id_cat, 1), :name, :brand, :model, l_type,
                             :price, NVL(:cost, 0), :stock, :description
                           ) RETURNING ID_PRODUCTO INTO l_id_prod;

                           -- Generar Certificado GS automático
                           l_codigo_cert := ''#GS-'' || TO_CHAR(2200 + l_id_prod);
                           INSERT INTO CERTIFICADOS_GS (
                             ID_PRODUCTO, CODIGO_CERTIFICADO, HARDWARE_ORIGINAL_PCT, 
                             ESTADO_ESTETICO_PCT, RENDIMIENTO_TERMICO_PCT, MESES_GARANTIA
                           ) VALUES (
                             l_id_prod, l_codigo_cert, 
                             NVL(:hw_pct, 100), NVL(:aesthetic_pct, 95), NVL(:thermal_pct, 98),
                             CASE WHEN l_type = ''LAPTOP'' THEN 18 WHEN l_type = ''RETRO'' THEN 6 ELSE 12 END
                           );

                           COMMIT;
                           :status := 201;
                           HTP.P(''{"id": '' || l_id_prod || '', "certificate": "'' || l_codigo_cert || ''", "message": "Producto y certificado creados exitosamente"}'');
                         END;'
  );

  -- ============================================================================
  -- TEMPLATE: /gaming/dashboard/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'gaming',
    p_pattern        => 'dashboard/'
  );

  -- GET /gaming/dashboard/ (Métricas del Panel de Control)
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'gaming',
    p_pattern        => 'dashboard/',
    p_method         => 'GET',
    p_source_type    => ORDS.SOURCE_TYPE_PLSQL,
    p_source         => 'DECLARE
                           l_inv NUMBER;
                           l_low NUMBER;
                           l_sales NUMBER;
                           l_cust NUMBER;
                         BEGIN
                           SELECT NVL(SUM(STOCK), 0) INTO l_inv FROM PRODUCTOS WHERE ACTIVO = ''S'';
                           SELECT COUNT(*) INTO l_low FROM PRODUCTOS WHERE ACTIVO = ''S'' AND STOCK BETWEEN 1 AND 3;
                           SELECT NVL(SUM(TOTAL_VENTA), 0) INTO l_sales FROM VENTAS WHERE ESTADO_VENTA = ''COMPLETADA'' AND FECHA_VENTA >= TRUNC(SYSDATE, ''MM'');
                           SELECT COUNT(*) INTO l_cust FROM CLIENTES;

                           HTP.P(''{"mode": "ords", "metrics": {"inventory": '' || l_inv || '', "lowStock": '' || l_low || '', "monthlySales": '' || l_sales || '', "customers": '' || l_cust || ''}}'');
                         END;'
  );

  -- ============================================================================
  -- TEMPLATE: /gaming/catalogos/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'gaming',
    p_pattern        => 'catalogos/'
  );

  -- GET /gaming/catalogos/ (Listas de Soporte para Formularios)
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'gaming',
    p_pattern        => 'catalogos/',
    p_method         => 'GET',
    p_source_type    => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source         => 'SELECT ID_CLIENTE AS "id", NOMBRE AS "name" FROM CLIENTES ORDER BY NOMBRE'
  );

  -- ============================================================================
  -- TEMPLATE: /gaming/ventas/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name    => 'gaming',
    p_pattern        => 'ventas/'
  );

  -- POST /gaming/ventas/ (Registro de Venta en Efectivo / Transferencia)
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'gaming',
    p_pattern        => 'ventas/',
    p_method         => 'POST',
    p_source_type    => ORDS.SOURCE_TYPE_PLSQL,
    p_source         => 'DECLARE
                           l_id_venta NUMBER;
                         BEGIN
                           INSERT INTO VENTAS (ID_CLIENTE, METODO_PAGO, TOTAL_VENTA, NOTAS_VENTA)
                           VALUES (:customerId, NVL(:payment, ''EFECTIVO''), :total, :notes)
                           RETURNING ID_VENTA INTO l_id_venta;

                           IF :productId IS NOT NULL THEN
                             UPDATE PRODUCTOS SET STOCK = STOCK - NVL(:quantity, 1) 
                             WHERE ID_PRODUCTO = :productId AND STOCK >= NVL(:quantity, 1);
                             
                             INSERT INTO VENTAS_DETALLE (ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO)
                             VALUES (l_id_venta, :productId, NVL(:quantity, 1), :price);
                           END IF;

                           COMMIT;
                           :status := 201;
                           HTP.P(''{"id": '' || l_id_venta || '', "message": "Venta registrada con éxito"}'');
                         END;'
  );

  COMMIT;
END;
/
