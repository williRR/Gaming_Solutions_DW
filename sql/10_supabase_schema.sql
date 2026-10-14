-- ==============================================================================
-- Gaming Solutions: Esquema PostgreSQL para Supabase (migración desde Oracle/ORDS)
-- Ejecutar completo en Supabase > SQL Editor. Es re-ejecutable (IF NOT EXISTS / OR REPLACE).
-- El backend usa SUPABASE_SERVICE_ROLE_KEY, por lo que RLS queda activo y sin políticas
-- públicas: la anon key NO puede leer ni escribir ninguna tabla.
-- ==============================================================================

-- 1. ROLES Y USUARIOS DEL PANEL
CREATE TABLE IF NOT EXISTS roles (
  id_rol       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_rol   varchar(50) NOT NULL UNIQUE,
  descripcion  varchar(200)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_rol          bigint NOT NULL REFERENCES roles(id_rol),
  username        varchar(50)  NOT NULL UNIQUE,
  email           varchar(100) NOT NULL UNIQUE,
  nombre_completo varchar(150) NOT NULL,
  clave_hash      varchar(256),
  fecha_registro  timestamptz NOT NULL DEFAULT now(),
  activo          char(1) NOT NULL DEFAULT 'S' CHECK (activo IN ('S','N'))
);

-- 2. CATÁLOGOS
CREATE TABLE IF NOT EXISTS categorias (
  id_categoria           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre                 varchar(100) NOT NULL,
  descripcion            varchar(300),
  garantia_meses_defecto smallint NOT NULL DEFAULT 12,
  slug                   varchar(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS proveedores (
  id_proveedor    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          varchar(150) NOT NULL,
  tipo_proveedor  varchar(20) NOT NULL DEFAULT 'PARTICULAR' CHECK (tipo_proveedor IN ('EMPRESA','PARTICULAR')),
  telefono        varchar(30),
  email           varchar(100),
  direccion       varchar(250),
  nit             varchar(30) UNIQUE,
  fecha_registro  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          varchar(150) NOT NULL,
  telefono        varchar(30),
  email           varchar(100),
  direccion       varchar(250),
  nit             varchar(30) UNIQUE,
  dpi             varchar(30) UNIQUE,
  fecha_registro  timestamptz NOT NULL DEFAULT now()
);

-- 3. PRODUCTOS (la imagen es solo una URL; nunca se guardan BLOB)
CREATE TABLE IF NOT EXISTS productos (
  id_producto            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_categoria           bigint NOT NULL REFERENCES categorias(id_categoria),
  id_proveedor           bigint REFERENCES proveedores(id_proveedor),
  sku                    varchar(50),
  nombre                 varchar(150) NOT NULL,
  marca                  varchar(80)  NOT NULL DEFAULT '',
  modelo                 varchar(80)  NOT NULL DEFAULT '',
  tipo_hardware          varchar(20)  NOT NULL DEFAULT 'NEXT_GEN' CHECK (tipo_hardware IN ('NEXT_GEN','LAPTOP','RETRO','ACCESORIO')),
  tipo_producto          varchar(20)  NOT NULL DEFAULT 'NUEVO' CHECK (tipo_producto IN ('NUEVO','USADO','REACONDICIONADO')),
  imagen_url             varchar(500),
  precio_venta           numeric(10,2) NOT NULL CHECK (precio_venta >= 0),
  precio_compra          numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio_compra >= 0),
  stock                  integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  descripcion            text,
  tiempo_garantia_meses  smallint CHECK (tiempo_garantia_meses BETWEEN 0 AND 120),
  fecha_ingreso          timestamptz NOT NULL DEFAULT now(),
  activo                 char(1) NOT NULL DEFAULT 'S' CHECK (activo IN ('S','N'))
);

CREATE TABLE IF NOT EXISTS certificados_gs (
  id_certificado           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto              bigint NOT NULL UNIQUE REFERENCES productos(id_producto) ON DELETE CASCADE,
  codigo_certificado       varchar(30) NOT NULL UNIQUE,
  hardware_original_pct    smallint NOT NULL DEFAULT 100 CHECK (hardware_original_pct BETWEEN 0 AND 100),
  estado_estetico_pct      smallint NOT NULL DEFAULT 95  CHECK (estado_estetico_pct BETWEEN 0 AND 100),
  rendimiento_termico_pct  smallint NOT NULL DEFAULT 98  CHECK (rendimiento_termico_pct BETWEEN 0 AND 100),
  puntos_revisados         smallint NOT NULL DEFAULT 30  CHECK (puntos_revisados >= 0),
  meses_garantia           smallint NOT NULL DEFAULT 12  CHECK (meses_garantia >= 0),
  detalle_inspeccion       text,
  fecha_inspeccion         timestamptz NOT NULL DEFAULT now(),
  tecnico_responsable      varchar(100) NOT NULL DEFAULT 'Laboratorio Gaming Solutions'
);

CREATE TABLE IF NOT EXISTS productos_detalle_retro (
  id_producto            bigint PRIMARY KEY REFERENCES productos(id_producto) ON DELETE CASCADE,
  condicion_estetica_10  smallint NOT NULL DEFAULT 8 CHECK (condicion_estetica_10 BETWEEN 1 AND 10),
  incluye_caja           char(1) NOT NULL DEFAULT 'N' CHECK (incluye_caja IN ('S','N')),
  incluye_manual         char(1) NOT NULL DEFAULT 'N' CHECK (incluye_manual IN ('S','N')),
  estado_funcional       varchar(30) NOT NULL DEFAULT 'RESTAURO_TOTAL',
  recap_realizado        char(1) NOT NULL DEFAULT 'S' CHECK (recap_realizado IN ('S','N')),
  observaciones          varchar(1000)
);

CREATE TABLE IF NOT EXISTS productos_detalle_laptop (
  id_producto            bigint PRIMARY KEY REFERENCES productos(id_producto) ON DELETE CASCADE,
  procesador             varchar(100) NOT NULL,
  gpu                    varchar(100) NOT NULL,
  ram_gb                 smallint NOT NULL,
  almacenamiento_gb      integer NOT NULL,
  salud_bateria_pct      smallint NOT NULL DEFAULT 100 CHECK (salud_bateria_pct BETWEEN 0 AND 100),
  test_termico_aprobado  char(1) NOT NULL DEFAULT 'S' CHECK (test_termico_aprobado IN ('S','N')),
  observaciones          varchar(1000)
);

CREATE TABLE IF NOT EXISTS productos_fotos (
  id_foto       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto   bigint NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
  url_foto      varchar(500) NOT NULL,
  es_principal  char(1) NOT NULL DEFAULT 'N' CHECK (es_principal IN ('S','N')),
  fecha_carga   timestamptz NOT NULL DEFAULT now()
);

-- 4. COMPRAS Y VENTAS
CREATE TABLE IF NOT EXISTS compras (
  id_compra         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_proveedor      bigint NOT NULL REFERENCES proveedores(id_proveedor),
  fecha_compra      timestamptz NOT NULL DEFAULT now(),
  total_compra      numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_compra >= 0),
  observaciones     varchar(1000),
  usuario_registro  varchar(50) NOT NULL DEFAULT 'sistema'
);

CREATE TABLE IF NOT EXISTS compras_detalle (
  id_detalle_compra  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_compra          bigint NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
  id_producto        bigint NOT NULL REFERENCES productos(id_producto),
  cantidad           integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario    numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal           numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE IF NOT EXISTS ventas (
  id_venta          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente        bigint NOT NULL REFERENCES clientes(id_cliente),
  fecha_venta       timestamptz NOT NULL DEFAULT now(),
  metodo_pago       varchar(20) NOT NULL DEFAULT 'EFECTIVO' CHECK (metodo_pago IN ('EFECTIVO','TRANSFERENCIA','TARJETA','OTRO')),
  total_venta       numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_venta >= 0),
  estado_venta      varchar(20) NOT NULL DEFAULT 'COMPLETADA' CHECK (estado_venta IN ('COMPLETADA','ANULADA','PENDIENTE')),
  usuario_registro  varchar(50) NOT NULL DEFAULT 'sistema',
  notas_venta       varchar(500)
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
  id_detalle_venta  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta          bigint NOT NULL REFERENCES ventas(id_venta) ON DELETE CASCADE,
  id_producto       bigint NOT NULL REFERENCES productos(id_producto),
  cantidad          integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario   numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal          numeric(12,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE TABLE IF NOT EXISTS cupones_descuento (
  id_cupon              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                varchar(30) NOT NULL UNIQUE,
  porcentaje_descuento  numeric(5,2) DEFAULT 0,
  monto_descuento       numeric(10,2) DEFAULT 0,
  fecha_expiracion      date,
  activo                char(1) NOT NULL DEFAULT 'S' CHECK (activo IN ('S','N'))
);

-- 5. AUDITORÍA
CREATE TABLE IF NOT EXISTS bitacora_auditoria (
  id_auditoria        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabla_afectada      varchar(50) NOT NULL,
  id_registro         bigint,
  operacion           char(1) NOT NULL CHECK (operacion IN ('I','U','D')),
  usuario_bd          varchar(128) NOT NULL DEFAULT current_user,
  fecha_evento        timestamptz NOT NULL DEFAULT now(),
  valores_anteriores  jsonb,
  valores_nuevos      jsonb
);

CREATE OR REPLACE FUNCTION fn_aud_productos() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bitacora_auditoria (tabla_afectada, id_registro, operacion, valores_nuevos)
    VALUES ('PRODUCTOS', NEW.id_producto, 'I', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO bitacora_auditoria (tabla_afectada, id_registro, operacion, valores_anteriores, valores_nuevos)
    VALUES ('PRODUCTOS', NEW.id_producto, 'U', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO bitacora_auditoria (tabla_afectada, id_registro, operacion, valores_anteriores)
    VALUES ('PRODUCTOS', OLD.id_producto, 'D', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_aud_productos ON productos;
CREATE TRIGGER trg_aud_productos
AFTER INSERT OR UPDATE OR DELETE ON productos
FOR EACH ROW EXECUTE FUNCTION fn_aud_productos();

-- 6. CERTIFICADO #GS AUTOMÁTICO AL CREAR UN PRODUCTO
CREATE OR REPLACE FUNCTION fn_crear_certificado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO certificados_gs (id_producto, codigo_certificado, meses_garantia)
  VALUES (
    NEW.id_producto,
    '#GS-' || (2200 + NEW.id_producto),
    COALESCE(NEW.tiempo_garantia_meses,
      CASE NEW.tipo_hardware WHEN 'LAPTOP' THEN 18 WHEN 'RETRO' THEN 6 ELSE 12 END)
  )
  ON CONFLICT (id_producto) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_certificado ON productos;
CREATE TRIGGER trg_crear_certificado
AFTER INSERT ON productos
FOR EACH ROW EXECUTE FUNCTION fn_crear_certificado();

-- 7. ÍNDICES
CREATE INDEX IF NOT EXISTS ix_productos_categoria ON productos(id_categoria);
CREATE INDEX IF NOT EXISTS ix_productos_tipo ON productos(tipo_hardware);
CREATE INDEX IF NOT EXISTS ix_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS ix_ventas_fecha ON ventas(fecha_venta);
CREATE INDEX IF NOT EXISTS ix_ventas_cliente ON ventas(id_cliente);
CREATE INDEX IF NOT EXISTS ix_compras_fecha ON compras(fecha_compra);
CREATE INDEX IF NOT EXISTS ix_detventa_producto ON ventas_detalle(id_producto);
CREATE INDEX IF NOT EXISTS ix_detcompra_producto ON compras_detalle(id_producto);
CREATE INDEX IF NOT EXISTS ix_aud_fecha ON bitacora_auditoria(fecha_evento DESC);

-- 8. FUNCIONES TRANSACCIONALES (cada llamada RPC es una sola transacción)
-- p_items: [{"productId":1,"quantity":2,"price":499.99}]
CREATE OR REPLACE FUNCTION registrar_venta(
  p_id_cliente bigint, p_metodo_pago text, p_notas text, p_usuario text, p_items jsonb
) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  v_id_venta bigint;
  v_item jsonb;
  v_total numeric(10,2) := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un producto';
  END IF;

  INSERT INTO ventas (id_cliente, metodo_pago, notas_venta, usuario_registro)
  VALUES (p_id_cliente, p_metodo_pago, p_notas, COALESCE(p_usuario, 'sistema'))
  RETURNING id_venta INTO v_id_venta;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE productos
       SET stock = stock - (v_item->>'quantity')::int
     WHERE id_producto = (v_item->>'productId')::bigint
       AND activo = 'S'
       AND stock >= (v_item->>'quantity')::int;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto seleccionado';
    END IF;

    INSERT INTO ventas_detalle (id_venta, id_producto, cantidad, precio_unitario)
    VALUES (v_id_venta, (v_item->>'productId')::bigint, (v_item->>'quantity')::int, (v_item->>'price')::numeric);

    v_total := v_total + (v_item->>'quantity')::int * (v_item->>'price')::numeric;
  END LOOP;

  UPDATE ventas SET total_venta = v_total WHERE id_venta = v_id_venta;
  RETURN v_id_venta;
END;
$$;

-- p_items: [{"productId":1,"quantity":2,"cost":420.00}]
CREATE OR REPLACE FUNCTION registrar_compra(
  p_id_proveedor bigint, p_notas text, p_usuario text, p_items jsonb
) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  v_id_compra bigint;
  v_item jsonb;
  v_total numeric(10,2) := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un producto';
  END IF;

  INSERT INTO compras (id_proveedor, observaciones, usuario_registro)
  VALUES (p_id_proveedor, p_notas, COALESCE(p_usuario, 'sistema'))
  RETURNING id_compra INTO v_id_compra;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE productos
       SET stock = stock + (v_item->>'quantity')::int,
           precio_compra = (v_item->>'cost')::numeric
     WHERE id_producto = (v_item->>'productId')::bigint;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Producto no encontrado en la compra';
    END IF;

    INSERT INTO compras_detalle (id_compra, id_producto, cantidad, precio_unitario)
    VALUES (v_id_compra, (v_item->>'productId')::bigint, (v_item->>'quantity')::int, (v_item->>'cost')::numeric);

    v_total := v_total + (v_item->>'quantity')::int * (v_item->>'cost')::numeric;
  END LOOP;

  UPDATE compras SET total_compra = v_total WHERE id_compra = v_id_compra;
  RETURN v_id_compra;
END;
$$;

-- 9. SEGURIDAD: RLS activo sin políticas = solo la service role puede acceder.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles','usuarios','categorias','proveedores','clientes','productos',
    'certificados_gs','productos_detalle_retro','productos_detalle_laptop','productos_fotos',
    'compras','compras_detalle','ventas','ventas_detalle','cupones_descuento','bitacora_auditoria']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION registrar_venta(bigint, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION registrar_compra(bigint, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- 10. DATOS INICIALES
INSERT INTO roles (nombre_rol, descripcion) VALUES
  ('Administrador', 'Control total de inventario, ventas y usuarios'),
  ('Ventas', 'Registro de ventas y atención al cliente'),
  ('Almacen', 'Inventario, compras y certificados de inspección')
ON CONFLICT (nombre_rol) DO NOTHING;

INSERT INTO categorias (nombre, descripcion, garantia_meses_defecto, slug) VALUES
  ('Consolas Next-Gen', 'Consolas selladas y de reventa verificada', 12, 'consolas-next-gen'),
  ('Laptops Gamer', 'Equipos de alto rendimiento con pruebas térmicas', 18, 'laptops-gamer'),
  ('Retro Restoration', 'Consolas retro restauradas a mano', 6, 'retro-restoration'),
  ('Accesorios', 'Controles, cables y periféricos', 12, 'accesorios')
ON CONFLICT (slug) DO NOTHING;

-- Para crear un usuario del panel con contraseña, genera el hash bcrypt localmente:
--   node -e "console.log(require('bcryptjs').hashSync('TuClaveSegura', 10))"
-- y luego:
--   INSERT INTO usuarios (id_rol, username, email, nombre_completo, clave_hash)
--   VALUES ((SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'),
--           'admin', 'admin@gamingsolutions.com', 'Administrador', '<hash_bcrypt>');
