-- datos.sql usa ON CONFLICT (sku) y el backend ya traduce el error 23505 como "NIT, DPI o SKU duplicado".
ALTER TABLE productos ADD CONSTRAINT uq_productos_sku UNIQUE (sku);
