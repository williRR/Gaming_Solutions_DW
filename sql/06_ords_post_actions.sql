-- ==============================================================================
-- Gaming Solutions: Rutas POST compatibles con proxies/WAF
-- Ejecutar DESPUES de 05_ords_rest_endpoints.sql.
--
-- Estas rutas reemplazan, para clientes que no permiten PATCH o DELETE:
--   PATCH  /gaming/productos/:id/
--   PATCH  /gaming/productos/:id/certificado/
--   DELETE /gaming/productos/:id/
--
-- El modulo "gaming" debe existir previamente.
-- ==============================================================================

DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  -- ============================================================================
  -- POST /gaming/productos/:id/actualizar/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/actualizar/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/actualizar/',
    p_method      => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source      => 'DECLARE
                       l_rows NUMBER;
                     BEGIN
                       IF :price IS NOT NULL AND :price < 0 THEN
                         RAISE_APPLICATION_ERROR(-20010, ''El precio no puede ser negativo'');
                       END IF;

                       IF :cost IS NOT NULL AND :cost < 0 THEN
                         RAISE_APPLICATION_ERROR(-20011, ''El costo no puede ser negativo'');
                       END IF;

                       IF :stock IS NOT NULL AND :stock < 0 THEN
                         RAISE_APPLICATION_ERROR(-20012, ''El stock no puede ser negativo'');
                       END IF;

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
                               '', "message": "Producto actualizado exitosamente"}'');
                       END IF;
                     END;'
  );

  -- ============================================================================
  -- POST /gaming/productos/:id/desactivar/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/desactivar/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/desactivar/',
    p_method      => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source      => 'DECLARE
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
                               '', "message": "Producto desactivado exitosamente"}'');
                       END IF;
                     END;'
  );

  -- ============================================================================
  -- POST /gaming/productos/:id/certificado/actualizar/
  -- ============================================================================
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/certificado/actualizar/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern     => 'productos/:id/certificado/actualizar/',
    p_method      => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source      => 'DECLARE
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
                               '', "message": "Certificado actualizado exitosamente"}'');
                       END IF;
                     END;'
  );

  COMMIT;
END;
/
