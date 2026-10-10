-- Endpoints REST adicionales para Oracle APEX/ORDS.
-- Ejecutar después de 04_ords_rest_endpoints.sql y 07_alter_database.sql.
DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'gaming', p_pattern => 'clientes/');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'clientes/', p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT ID_CLIENTE "id", NOMBRE "name", TELEFONO "phone", EMAIL "email", DIRECCION "address", NIT "nit", DPI "dpi" FROM CLIENTES ORDER BY NOMBRE');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'clientes/', p_method => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL, p_source => 'DECLARE l_id NUMBER; BEGIN
      INSERT INTO CLIENTES(NOMBRE,TELEFONO,EMAIL,DIRECCION,NIT,DPI) VALUES(:name,:phone,:email,:address,:nit,:dpi)
      RETURNING ID_CLIENTE INTO l_id; COMMIT; :status:=201; HTP.P(''{"id":''||l_id||'',"name":"''||REPLACE(:name,''"'',''\\"'')||''"}''); END;');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'gaming', p_pattern => 'proveedores/');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'proveedores/', p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT ID_PROVEEDOR "id", NOMBRE "name", TIPO_PROVEEDOR "type", TELEFONO "phone", EMAIL "email", DIRECCION "address", NIT "nit" FROM PROVEEDORES ORDER BY NOMBRE');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'proveedores/', p_method => 'POST',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL, p_source => 'DECLARE l_id NUMBER; BEGIN
      INSERT INTO PROVEEDORES(NOMBRE,TIPO_PROVEEDOR,TELEFONO,EMAIL,DIRECCION,NIT) VALUES(:name,NVL(:type,''PARTICULAR''),:phone,:email,:address,:nit)
      RETURNING ID_PROVEEDOR INTO l_id; COMMIT; :status:=201; HTP.P(''{"id":''||l_id||'',"name":"''||REPLACE(:name,''"'',''\\"'')||''"}''); END;');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'gaming', p_pattern => 'productos/:id/');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'productos/:id/', p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT p.ID_PRODUCTO "id",p.NOMBRE "name",p.MARCA "brand",p.MODELO "model",p.TIPO_HARDWARE "type",p.TIPO_PRODUCTO "productType",p.PRECIO_VENTA "price",p.PRECIO_COMPRA "cost",p.STOCK "stock",p.IMAGEN_URL "imageUrl",p.TIEMPO_GARANTIA_MESES "warrantyMonths",c.CODIGO_CERTIFICADO "certificate",c.HARDWARE_ORIGINAL_PCT "hwPct",c.ESTADO_ESTETICO_PCT "aestheticPct",c.RENDIMIENTO_TERMICO_PCT "thermalPct" FROM PRODUCTOS p LEFT JOIN CERTIFICADOS_GS c ON c.ID_PRODUCTO=p.ID_PRODUCTO WHERE p.ID_PRODUCTO=:id AND p.ACTIVO=''S''');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'productos/:id/', p_method => 'PUT',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL, p_source => 'BEGIN
      UPDATE PRODUCTOS SET NOMBRE=NVL(:nombre,NVL(:name,NOMBRE)),PRECIO_VENTA=NVL(:precio_venta,NVL(:price,PRECIO_VENTA)),PRECIO_COMPRA=NVL(:precio_compra,NVL(:cost,PRECIO_COMPRA)),STOCK=NVL(:stock,STOCK),IMAGEN_URL=NVL(:imagen_url,NVL(:imageUrl,IMAGEN_URL)),TIPO_PRODUCTO=NVL(:productType,TIPO_PRODUCTO),TIEMPO_GARANTIA_MESES=NVL(:tiempo_garantia_meses,NVL(:warrantyMonths,TIEMPO_GARANTIA_MESES)) WHERE ID_PRODUCTO=:id;
      IF SQL%ROWCOUNT=0 THEN :status:=404; HTP.P(''{"error":"Producto no encontrado"}''); ELSE COMMIT; HTP.P(''{"id":''||:id||'',"message":"Producto actualizado"}''); END IF; END;');
  ORDS.DEFINE_TEMPLATE(p_module_name => 'gaming', p_pattern => 'ventas/consulta/');
  ORDS.DEFINE_HANDLER(p_module_name => 'gaming', p_pattern => 'ventas/consulta/', p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_COLLECTION_FEED,
    p_source => 'SELECT v.ID_VENTA "id", c.NOMBRE "customer",
      TO_CHAR(v.FECHA_VENTA, ''YYYY-MM-DD'') "date", v.METODO_PAGO "payment",
      v.TOTAL_VENTA "total", v.ESTADO_VENTA "status"
      FROM VENTAS v JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
      ORDER BY v.FECHA_VENTA DESC');
  COMMIT;
END;
/

-- Resumen operativo consumido por /api/summary y /api/dashboard.
DECLARE
  PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'gaming', p_pattern => 'dashboard/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'gaming',
    p_pattern => 'dashboard/',
    p_method => 'GET',
    p_source_type => ORDS.SOURCE_TYPE_PLSQL,
    p_source => 'DECLARE
      l_clientes NUMBER;
      l_stock NUMBER;
      l_ventas NUMBER;
    BEGIN
      SELECT
        (SELECT COUNT(*) FROM CLIENTES),
        (SELECT NVL(SUM(STOCK), 0) FROM PRODUCTOS WHERE ACTIVO = ''S''),
        (SELECT NVL(SUM(TOTAL_VENTA), 0) FROM VENTAS
          WHERE FECHA_VENTA >= TRUNC(SYSDATE, ''MM''))
      INTO l_clientes, l_stock, l_ventas
      FROM DUAL;
      HTP.P(''{"mode":"ords","metrics":{"inventory":'' || l_stock ||
        '',''customers'':'' || l_clientes || '',''monthlySales'':'' ||
        l_ventas || '',''lowStock'':0}}'');
    END;'
  );
  COMMIT;
END;
/
