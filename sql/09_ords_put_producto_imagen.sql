-- Actualización reentrante del handler PUT de productos.
-- Ejecutar después de 08_ords_crud_endpoints.sql cuando se agregue IMAGEN_URL.
DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'productos/:id/',
    p_method => 'PUT',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'BEGIN
      UPDATE PRODUCTOS
         SET NOMBRE = NVL(:nombre, NOMBRE),
             PRECIO_VENTA = NVL(:precio_venta, PRECIO_VENTA),
             PRECIO_COMPRA = NVL(:precio_compra, PRECIO_COMPRA),
             STOCK = NVL(:stock, STOCK),
             IMAGEN_URL = NVL(:imagen_url, IMAGEN_URL),
             TIEMPO_GARANTIA_MESES = NVL(:tiempo_garantia_meses, TIEMPO_GARANTIA_MESES)
       WHERE ID_PRODUCTO = :id;
      IF SQL%ROWCOUNT = 0 THEN
        :status := 404;
        HTP.P(''{"error":"Producto no encontrado"}'');
      ELSE
        HTP.P(''{"id":'' || :id || '',"message":"Producto actualizado"}'');
      END IF;
    END;'
  );
  COMMIT;
END;
/
