-- ==============================================================================
-- Gaming Solutions: Extensiones CRUD REST para ORDS
-- Ejecutar una vez, despues de sql/04_ords_rest_endpoints.sql.
-- Este archivo actualiza el POST de productos y agrega las rutas que faltaban.
-- ==============================================================================

BEGIN
  -- El identificador de categoria es necesario para el formulario de edicion.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'productos/',
    p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT
                   p.ID_PRODUCTO AS "id",
                   p.ID_CATEGORIA AS "category_id",
                   p.NOMBRE AS "name",
                   p.MARCA AS "brand",
                   p.MODELO AS "model",
                   p.TIPO_HARDWARE AS "type",
                   c.NOMBRE AS "category",
                   p.PRECIO_VENTA AS "price",
                   p.PRECIO_COMPRA AS "cost",
                   p.STOCK AS "stock",
                   CASE WHEN p.STOCK = 0 THEN ''Agotado''
                        WHEN p.STOCK <= 3 THEN ''Stock bajo''
                        ELSE ''Disponible'' END AS "status",
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

  -- POST /gaming/productos/ acepta una categoria explicita y mantiene el
  -- comportamiento anterior cuando categoryId no se envia.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'productos/',
    p_method => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id_cat NUMBER;
                   l_id_prod NUMBER;
                   l_codigo_cert VARCHAR2(30);
                   l_type VARCHAR2(20);
                   l_slug VARCHAR2(100);
                 BEGIN
                   l_type := NVL(UPPER(:type), ''NEXT_GEN'');
                   IF :categoryId IS NOT NULL THEN
                     SELECT ID_CATEGORIA INTO l_id_cat
                       FROM CATEGORIAS WHERE ID_CATEGORIA = :categoryId;
                   ELSE
                     l_slug := CASE l_type
                       WHEN ''NEXT_GEN'' THEN ''consolas-next-gen''
                       WHEN ''LAPTOP'' THEN ''laptops-gamer''
                       WHEN ''RETRO'' THEN ''retro-restoration''
                       ELSE NULL
                     END;
                     IF l_slug IS NULL THEN
                       RAISE_APPLICATION_ERROR(-20001, ''Tipo de hardware sin categoria predeterminada.'');
                     END IF;
                     SELECT ID_CATEGORIA INTO l_id_cat
                       FROM CATEGORIAS WHERE SLUG = l_slug;
                   END IF;

                   INSERT INTO PRODUCTOS (
                     ID_CATEGORIA, NOMBRE, MARCA, MODELO, TIPO_HARDWARE,
                     PRECIO_VENTA, PRECIO_COMPRA, STOCK, DESCRIPCION
                   ) VALUES (
                     l_id_cat, :name, NVL(:brand, ''Gaming Solutions''),
                     NVL(:model, ''GS-CUSTOM''), l_type,
                     :price, NVL(:cost, 0), :stock, :description
                   ) RETURNING ID_PRODUCTO INTO l_id_prod;

                   l_codigo_cert := ''#GS-'' || TO_CHAR(2200 + l_id_prod);
                   INSERT INTO CERTIFICADOS_GS (
                     ID_PRODUCTO, CODIGO_CERTIFICADO, HARDWARE_ORIGINAL_PCT,
                     ESTADO_ESTETICO_PCT, RENDIMIENTO_TERMICO_PCT, MESES_GARANTIA
                   ) VALUES (
                     l_id_prod, l_codigo_cert, NVL(:hw_pct, 100),
                     NVL(:aesthetic_pct, 95), NVL(:thermal_pct, 98),
                     CASE WHEN l_type = ''LAPTOP'' THEN 18
                          WHEN l_type = ''RETRO'' THEN 6 ELSE 12 END
                   );

                   :status := 201;
                   HTP.P(''{"id":'' || l_id_prod ||
                         '',"certificate":"'' || l_codigo_cert ||
                         ''","message":"Producto y certificado creados exitosamente"}'');
                 END;'
  );

  -- PUT /gaming/productos/:id cambia unicamente precio y stock.
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern => 'productos/:id'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'productos/:id',
    p_method => 'PUT',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id NUMBER := TO_NUMBER(:id);
                 BEGIN
                   UPDATE PRODUCTOS
                      SET PRECIO_VENTA = :price,
                          STOCK = :stock
                    WHERE ID_PRODUCTO = l_id
                      AND ACTIVO = ''S'';
                   IF SQL%ROWCOUNT = 0 THEN
                     :status := 404;
                     HTP.P(''{"error":"Producto no encontrado"}'');
                   ELSE
                     HTP.P(''{"ok":true}'');
                   END IF;
                 END;'
  );

  -- DELETE /gaming/productos/:id es baja logica, no borra sus relaciones.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'productos/:id',
    p_method => 'DELETE',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id NUMBER := TO_NUMBER(:id);
                 BEGIN
                   UPDATE PRODUCTOS
                      SET ACTIVO = ''N''
                    WHERE ID_PRODUCTO = l_id
                      AND ACTIVO = ''S'';
                   IF SQL%ROWCOUNT = 0 THEN
                     :status := 404;
                     HTP.P(''{"error":"Producto no encontrado"}'');
                   ELSE
                     HTP.P(''{"ok":true}'');
                   END IF;
                 END;'
  );

  -- CRUD para categorias. DELETE se rechaza mientras existan productos asociados.
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern => 'categorias/'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'categorias/',
    p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT ID_CATEGORIA AS "id",
                        NOMBRE AS "name",
                        DESCRIPCION AS "description",
                        SLUG AS "slug",
                        GARANTIA_MESES_DEFECTO AS "warrantyMonths"
                   FROM CATEGORIAS
                  ORDER BY NOMBRE'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'categorias/',
    p_method => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id NUMBER;
                 BEGIN
                   INSERT INTO CATEGORIAS (
                     NOMBRE, DESCRIPCION, SLUG, GARANTIA_MESES_DEFECTO
                   ) VALUES (
                     :name, :description, LOWER(:slug), NVL(:warrantyMonths, 12)
                   ) RETURNING ID_CATEGORIA INTO l_id;
                   :status := 201;
                   HTP.P(''{"id":'' || l_id || ''}'');
                 END;'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern => 'categorias/:id'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'categorias/:id',
    p_method => 'PUT',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id NUMBER := TO_NUMBER(:id);
                 BEGIN
                   UPDATE CATEGORIAS
                      SET NOMBRE = :name,
                          DESCRIPCION = :description,
                          SLUG = LOWER(:slug),
                          GARANTIA_MESES_DEFECTO = :warrantyMonths
                    WHERE ID_CATEGORIA = l_id;
                   IF SQL%ROWCOUNT = 0 THEN
                     :status := 404;
                     HTP.P(''{"error":"Categoria no encontrada"}'');
                   ELSE
                     HTP.P(''{"ok":true}'');
                   END IF;
                 END;'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'categorias/:id',
    p_method => 'DELETE',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id NUMBER := TO_NUMBER(:id);
                   l_existe NUMBER;
                   l_productos NUMBER;
                 BEGIN
                   SELECT COUNT(*) INTO l_existe
                     FROM CATEGORIAS WHERE ID_CATEGORIA = l_id;
                   IF l_existe = 0 THEN
                     :status := 404;
                     HTP.P(''{"error":"Categoria no encontrada"}'');
                     RETURN;
                   END IF;

                   SELECT COUNT(*) INTO l_productos
                     FROM PRODUCTOS WHERE ID_CATEGORIA = l_id;
                   IF l_productos > 0 THEN
                     :status := 409;
                     HTP.P(''{"error":"No se puede eliminar una categoria con productos asociados"}'');
                     RETURN;
                   END IF;

                   DELETE FROM CATEGORIAS WHERE ID_CATEGORIA = l_id;
                   HTP.P(''{"ok":true}'');
                 END;'
  );

  -- GET /gaming/proveedores/ se agrega para los formularios existentes.
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern => 'proveedores/'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'proveedores/',
    p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT ID_PROVEEDOR AS "id",
                        NOMBRE AS "name",
                        TIPO_PROVEEDOR AS "type"
                   FROM PROVEEDORES
                  ORDER BY NOMBRE'
  );

  -- Reemplaza el POST de ventas para que stock insuficiente no registre una venta.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'ventas/',
    p_method => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
                   l_id_venta NUMBER;
                   l_cantidad NUMBER := NVL(:quantity, 1);
                   l_precio NUMBER := :price;
                   l_total NUMBER := NVL(:total, l_cantidad * l_precio);
                 BEGIN
                   IF l_cantidad <= 0 OR l_precio < 0 THEN
                     RAISE_APPLICATION_ERROR(-20003, ''Cantidad o precio de venta invalido.'');
                   END IF;

                   UPDATE PRODUCTOS
                      SET STOCK = STOCK - l_cantidad
                    WHERE ID_PRODUCTO = :productId
                      AND ACTIVO = ''S''
                      AND STOCK >= l_cantidad;
                   IF SQL%ROWCOUNT = 0 THEN
                     RAISE_APPLICATION_ERROR(-20002, ''Producto no disponible o stock insuficiente.'');
                   END IF;

                   INSERT INTO VENTAS (ID_CLIENTE, METODO_PAGO, TOTAL_VENTA, NOTAS_VENTA)
                   VALUES (:customerId, NVL(:payment, ''EFECTIVO''), l_total, :notes)
                   RETURNING ID_VENTA INTO l_id_venta;

                   INSERT INTO VENTAS_DETALLE (
                     ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO
                   ) VALUES (
                     l_id_venta, :productId, l_cantidad, l_precio
                   );

                   :status := 201;
                   HTP.P(''{"id":'' || l_id_venta || '',"message":"Venta registrada con exito"}'');
                 END;'
  );

  COMMIT;
END;
/
