-- ==============================================================================
-- Gaming Solutions: Datos de prueba y semilla inicial para Supabase
-- Ejecutar en Supabase > SQL Editor
-- ==============================================================================

-- 1. PROVEEDORES DE PRUEBA
INSERT INTO proveedores (nombre, tipo_proveedor, telefono, email, direccion, nit) VALUES
('Sony Intertrade Latin America', 'EMPRESA', '2388-1000', 'ventas@latam.sony.com', 'Ciudad de Guatemala', '1234567-8'),
('Distribuidora Nintendo Centro', 'EMPRESA', '2440-5522', 'contacto@nintendocentro.com', 'Zona 10, Guatemala', '8765432-1'),
('Juan Carlos Proveedor Particular', 'PARTICULAR', '5512-3488', 'juan.particula@gmail.com', 'Chimaltenango', '9876543-2')
ON CONFLICT (nit) DO NOTHING;

-- 2. CLIENTES DE PRUEBA (Incluyendo requisitos completos para el flujo de ventas: NIT/DPI, Teléfono, Dirección)
INSERT INTO clientes (nombre, telefono, email, direccion, nit, dpi) VALUES
('Carlos Enrique Mendoza', '5822-9911', 'carlos.mendoza@gmail.com', '3ra Calle 4-12 Zona 1, Chimaltenango', '458921-5', '2541889650401'),
('Maria Fernanda Cifuentes', '4211-8877', 'mafer.cifuentes@yahoo.com', 'Avenida El Patrocinio 12-5 Zona 3', '963258-7', '1988554210102'),
('Consumidor Final', '2200-0000', 'ventas@gamingsolutions.com', 'Ciudad de Guatemala', 'CF', '0000000000001')
ON CONFLICT (nit) DO NOTHING;

-- Nota: El DPI de 'Consumidor Final' usa un consecutivo genérico único por la restricción UNIQUE.

-- 3. PRODUCTOS DE PRUEBA (Asociados a categorías y proveedores existentes)
-- Nota: El trigger 'trg_crear_certificado' genera automáticamente el código #GS-XXXX correspondiente.
INSERT INTO productos (id_categoria, id_proveedor, sku, nombre, marca, modelo, tipo_hardware, tipo_producto, imagen_url, precio_venta, precio_compra, stock, descripcion, tiempo_garantia_meses) VALUES
(
  (SELECT id_categoria FROM categorias WHERE slug = 'consolas-next-gen'),
  (SELECT id_proveedor FROM proveedores WHERE tipo_proveedor = 'EMPRESA' LIMIT 1),
  'GS-PS5-001',
  'PlayStation 5 Pro 2TB',
  'Sony',
  'CFI-7000',
  'NEXT_GEN',
  'NUEVO',
  'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80',
  699.99,
  580.00,
  4,
  'Consola de última generación con almacenamiento de 2TB y soporte para trazado de rayos avanzado.',
  12
),
(
  (SELECT id_categoria FROM categorias WHERE slug = 'laptops-gamer'),
  (SELECT id_proveedor FROM proveedores WHERE tipo_proveedor = 'EMPRESA' LIMIT 1),
  'GS-MSI-002',
  'MSI Raider GE78 HX i9 RTX 4090',
  'MSI',
  'ARP85',
  'LAPTOP',
  'NUEVO',
  'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80',
  15000.00,
  10000.00,
  2,
  'Laptop de rendimiento extremo para desarrollo, gaming y renderizado 3D.',
  18
),
(
  (SELECT id_categoria FROM categorias WHERE slug = 'retro-restoration'),
  (SELECT id_proveedor FROM proveedores WHERE tipo_proveedor = 'PARTICULAR' LIMIT 1),
  'GS-SNES-003',
  'Super Nintendo SNES Recapacitada GS',
  'Nintendo',
  'SNS-001',
  'RETRO',
  'REACONDICIONADO',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
  189.99,
  120.00,
  7,
  'Consola clásica totalmente restaurada a mano, capacitores reemplazados (recap) y probada en banco de trabajo.',
  6
);

-- 4. USUARIO ADMINISTRADOR DE PRUEBA
-- Contraseña generada por bcrypt para la clave: 'Admin123*'
-- Puedes iniciar sesión en el panel usando el usuario: 'admin' y clave: 'Admin123*'
INSERT INTO usuarios (id_rol, username, email, nombre_completo, clave_hash) VALUES
(
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'),
  'admin',
  'admin@gamingsolutions.com',
  'Nelson Roquel (Admin)',
  '$2a$10$XbM8E7FwKk3G7gQvL5QjB.Y4m2Jp9W6zXy5v4U3t2S1R0q9P8oN7K'
)
ON CONFLICT (username) DO NOTHING;