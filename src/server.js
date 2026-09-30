require('dotenv').config();

const path = require('node:path');
const express = require('express');
const oracledb = require('oracledb');

const app = express();
const port = Number(process.env.PORT || 3000);
const apiVersion = '2026.09.28-apex-ords';
const demoMode = process.env.DEMO_MODE === 'true';
const ordsInventoryUrl = process.env.ORDS_INVENTORY_URL || 'https://oracleapex.com/ords/willi_gs/gaming/productos/';
const ordsBaseUrl = ordsInventoryUrl.replace(/(productos|consolas)\/?$/, '');

const hasOracleCredentials = Boolean(
  process.env.ORACLE_USER &&
  process.env.ORACLE_PASSWORD &&
  process.env.ORACLE_PASSWORD !== 'replace-me' &&
  process.env.ORACLE_CONNECT_STRING
);

const oracleUnavailableMessage = 'Configura las variables de conexión Oracle o activa DEMO_MODE=true.';

const poolPromise = demoMode || ordsInventoryUrl || !hasOracleCredentials ? null : oracledb.createPool({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
  poolMax: Number(process.env.ORACLE_POOL_MAX || 5),
  poolIncrement: Number(process.env.ORACLE_POOL_INCREMENT || 1)
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Inventario Demo con Certificación #GS e Inspección Técnica
const demoInventory = [
  { id: 1, categoryId: 1, name: 'PlayStation 5 Slim Digital', brand: 'Sony', model: 'CFI-2015', type: 'NEXT_GEN', price: 499.99, cost: 420.00, stock: 8, status: 'Disponible', certificate: '#GS-2201', hwPct: 100, aestheticPct: 96, thermalPct: 98, warrantyMonths: 12 },
  { id: 2, categoryId: 1, name: 'Nintendo Switch OLED White', brand: 'Nintendo', model: 'HEG-001', type: 'NEXT_GEN', price: 349.99, cost: 290.00, stock: 5, status: 'Disponible', certificate: '#GS-2202', hwPct: 100, aestheticPct: 98, thermalPct: 97, warrantyMonths: 12 },
  { id: 3, categoryId: 1, name: 'Xbox Series X 1TB Black', brand: 'Microsoft', model: 'RRT-00010', type: 'NEXT_GEN', price: 479.99, cost: 400.00, stock: 3, status: 'Stock bajo', certificate: '#GS-2203', hwPct: 100, aestheticPct: 94, thermalPct: 96, warrantyMonths: 12 },
  { id: 4, categoryId: 2, name: 'ASUS ROG Strix G16 RTX 4070', brand: 'ASUS', model: 'G614JI', type: 'LAPTOP', price: 1499.99, cost: 1250.00, stock: 4, status: 'Disponible', certificate: '#GS-2204', hwPct: 100, aestheticPct: 95, thermalPct: 95, warrantyMonths: 18 },
  { id: 5, categoryId: 2, name: 'MSI Raider GE78 HX i9 RTX 4080', brand: 'MSI', model: 'GE78-HX', type: 'LAPTOP', price: 2199.99, cost: 1850.00, stock: 2, status: 'Stock bajo', certificate: '#GS-2205', hwPct: 100, aestheticPct: 99, thermalPct: 99, warrantyMonths: 18 },
  { id: 6, categoryId: 3, name: 'Super Nintendo SNES Recapacitada', brand: 'Nintendo', model: 'SNS-001', type: 'RETRO', price: 189.99, cost: 100.00, stock: 2, status: 'Stock bajo', certificate: '#GS-2206', hwPct: 95, aestheticPct: 92, thermalPct: 96, warrantyMonths: 6 },
  { id: 7, categoryId: 3, name: 'Game Boy Color Atomic Purple', brand: 'Nintendo', model: 'CGB-001', type: 'RETRO', price: 129.99, cost: 60.00, stock: 0, status: 'Agotado', certificate: '#GS-2207', hwPct: 90, aestheticPct: 88, thermalPct: 94, warrantyMonths: 6 },
  { id: 8, categoryId: 3, name: 'Sega Genesis Model 1 HD', brand: 'Sega', model: 'MK-1601', type: 'RETRO', price: 159.99, cost: 75.00, stock: 4, status: 'Disponible', certificate: '#GS-2208', hwPct: 100, aestheticPct: 93, thermalPct: 97, warrantyMonths: 6 }
];

const demoCategories = [
  { id: 1, name: 'Consolas Next-Gen', description: 'Consolas modernas verificadas', slug: 'consolas-next-gen', warrantyMonths: 12 },
  { id: 2, name: 'Laptops Gamer', description: 'Equipos gamer con pruebas térmicas', slug: 'laptops-gamer', warrantyMonths: 18 },
  { id: 3, name: 'Retro Restoration', description: 'Consolas retro restauradas', slug: 'retro-restoration', warrantyMonths: 6 }
];

const demoSales = [
  { id: 1048, customer: 'María González', date: '2026-09-28', total: 849.98, payment: 'TARJETA', status: 'COMPLETADA', notes: 'Boleta emitida presencial' },
  { id: 1047, customer: 'Carlos Ramírez', date: '2026-09-27', total: 189.99, payment: 'EFECTIVO', status: 'COMPLETADA', notes: 'Pago contra entrega en tienda' },
  { id: 1046, customer: 'Ana Torres', date: '2026-09-26', total: 1499.99, payment: 'TRANSFERENCIA', status: 'COMPLETADA', notes: 'Transferencia confirmada en laboratorio' }
];

const demoCustomers = [
  { id: 1, name: 'María González' },
  { id: 2, name: 'Carlos Ramírez' },
  { id: 3, name: 'Ana Torres' }
];

const demoProviders = [
  { id: 1, name: 'Distribuciones Next Level S.A.C.' },
  { id: 2, name: 'Jorge Mendoza (Coleccionista)' }
];

async function withConnection(work) {
  const pool = await poolPromise;
  const connection = await pool.getConnection();
  try { return await work(connection); } finally { await connection.close(); }
}

async function query(sql, binds = {}) {
  return withConnection(async (connection) => {
    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  });
}

async function transaction(work) {
  const pool = await poolPromise;
  const connection = await pool.getConnection();
  try {
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.close(); }
}

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} es obligatorio`);
  return value;
}

function normalizeOrdsItem(item) {
  const value = (names, fallback = null) => {
    const key = names.find(name => item[name] !== undefined);
    return key ? item[key] : fallback;
  };
  const stock = Number(value(['stock', 'STOCK'], 0));
  const id = Number(value(['id', 'ID_PRODUCTO', 'id_producto', 'ID_CONSOLA', 'id_consola']));
  return {
    id,
    categoryId: Number(value(['categoryId', 'category_id', 'ID_CATEGORIA', 'id_categoria'], 0)),
    category: value(['category', 'CATEGORIA', 'categoria'], ''),
    name: value(['name', 'NOMBRE', 'nombre'], 'Sin nombre'),
    brand: value(['brand', 'MARCA', 'marca'], ''),
    model: value(['model', 'MODELO', 'modelo'], ''),
    type: value(['type', 'TIPO_HARDWARE', 'tipo_hardware', 'TIPO', 'tipo'], 'NEXT_GEN'),
    price: Number(value(['price', 'PRECIO_VENTA', 'precio_venta'], 0)),
    cost: Number(value(['cost', 'PRECIO_COMPRA', 'precio_compra'], 0)),
    stock,
    status: stock === 0 ? 'Agotado' : stock <= 3 ? 'Stock bajo' : 'Disponible',
    certificate: value(['certificate', 'CODIGO_CERTIFICADO', 'codigo_certificado'], `#GS-${2200 + id}`),
    hwPct: Number(value(['hw_pct', 'HARDWARE_ORIGINAL_PCT', 'hardware_original_pct'], 100)),
    aestheticPct: Number(value(['aesthetic_pct', 'ESTADO_ESTETICO_PCT', 'estado_estetico_pct'], 95)),
    thermalPct: Number(value(['thermal_pct', 'RENDIMIENTO_TERMICO_PCT', 'rendimiento_termico_pct'], 98)),
    warrantyMonths: Number(value(['warranty_months', 'MESES_GARANTIA', 'meses_garantia'], 12))
  };
}

async function getOrdsInventory() {
  const payload = await getOrdsCollection(ordsInventoryUrl);
  const items = collectionItems(payload);
  return items.map(normalizeOrdsItem);
}

function collectionItems(payload) {
  return Array.isArray(payload) ? payload : payload.items || [];
}

async function requestOrdsResource(resource, method = 'GET', payload) {
  const response = await fetch(`${ordsBaseUrl}${resource}`, {
    method,
    headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(10000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`ORDS respondió HTTP ${response.status}: ${body || 'sin detalle'}`);
  return body ? JSON.parse(body) : { ok: true };
}

async function getOrdsCollection(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`ORDS respondió HTTP ${response.status}`);
  return response.json();
}

async function postOrdsResource(resource, payload) {
  const response = await fetch(`${ordsBaseUrl}${resource}/`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`ORDS respondió HTTP ${response.status}: ${body || 'sin detalle'}`);
  return body ? JSON.parse(body) : { ok: true };
}

// Health Status
app.get('/api/health', async (_req, res) => {
  if (demoMode) return res.json({ ok: true, mode: 'demo', apiVersion });
  if (ordsInventoryUrl) {
    try { await getOrdsInventory(); return res.json({ ok: true, mode: 'ords', endpoint: ordsInventoryUrl, apiVersion }); }
    catch (error) { return res.status(503).json({ ok: false, mode: 'ords', error: error.message }); }
  }
  if (!poolPromise) return res.status(503).json({ ok: false, mode: 'unconfigured', error: oracleUnavailableMessage });
  try { await query('SELECT 1 AS OK FROM DUAL'); res.json({ ok: true, mode: 'oracle' }); }
  catch (error) { res.status(503).json({ ok: false, mode: 'oracle', error: error.message }); }
});

// Dashboard Metrics & Overview
app.get('/api/dashboard', async (_req, res) => {
  if (demoMode) {
    return res.json({
      mode: 'demo',
      inventory: demoInventory,
      sales: demoSales,
      metrics: {
        inventory: demoInventory.reduce((total, item) => total + item.stock, 0),
        lowStock: demoInventory.filter(item => item.stock > 0 && item.stock <= 3).length,
        monthlySales: 13840.50,
        customers: 86
      }
    });
  }
  try {
    if (ordsInventoryUrl) {
      const inventory = await getOrdsInventory();
      return res.json({
        mode: 'ords',
        inventory,
        sales: demoSales,
        metrics: {
          inventory: inventory.reduce((total, item) => total + item.stock, 0),
          lowStock: inventory.filter(item => item.stock > 0 && item.stock <= 3).length,
          monthlySales: 13840.50,
          customers: 86
        }
      });
    }
    const [inventory, sales, metrics] = await Promise.all([
      query(`SELECT p.ID_PRODUCTO AS "id", p.NOMBRE AS "name", p.MARCA AS "brand", p.MODELO AS "model",
            p.TIPO_HARDWARE AS "type", p.PRECIO_VENTA AS "price", p.STOCK AS "stock",
            CASE WHEN p.STOCK = 0 THEN 'Agotado' WHEN p.STOCK <= 3 THEN 'Stock bajo' ELSE 'Disponible' END AS "status",
            cert.CODIGO_CERTIFICADO AS "certificate", cert.HARDWARE_ORIGINAL_PCT AS "hwPct",
            cert.ESTADO_ESTETICO_PCT AS "aestheticPct", cert.RENDIMIENTO_TERMICO_PCT AS "thermalPct"
             FROM PRODUCTOS p
             LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
             WHERE p.ACTIVO = 'S' ORDER BY p.FECHA_INGRESO DESC`),
      query(`SELECT v.ID_VENTA AS "id", c.NOMBRE AS "customer", TO_CHAR(v.FECHA_VENTA, 'YYYY-MM-DD') AS "date",
            v.TOTAL_VENTA AS "total", v.METODO_PAGO AS "payment", v.ESTADO_VENTA AS "status"
             FROM VENTAS v JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
             ORDER BY v.FECHA_VENTA DESC FETCH FIRST 5 ROWS ONLY`),
      query(`SELECT (SELECT NVL(SUM(STOCK),0) FROM PRODUCTOS WHERE ACTIVO = 'S') AS "inventory",
            (SELECT COUNT(*) FROM PRODUCTOS WHERE ACTIVO = 'S' AND STOCK BETWEEN 1 AND 3) AS "lowStock",
            (SELECT NVL(SUM(TOTAL_VENTA), 0) FROM VENTAS WHERE ESTADO_VENTA = 'COMPLETADA' AND FECHA_VENTA >= TRUNC(SYSDATE, 'MM')) AS "monthlySales",
            (SELECT COUNT(*) FROM CLIENTES) AS "customers" FROM DUAL`)
    ]);
    res.json({ inventory, sales, metrics: metrics[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// GET Catalog / Inventory
app.get('/api/inventory', async (_req, res) => {
  if (demoMode) return res.json(demoInventory);
  if (ordsInventoryUrl) {
    try { return res.json(await getOrdsInventory()); } catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try {
    const products = await query(`
      SELECT p.ID_PRODUCTO AS "id", p.NOMBRE AS "name", p.MARCA AS "brand", p.MODELO AS "model", 
             p.TIPO_HARDWARE AS "type", p.PRECIO_VENTA AS "price", p.PRECIO_COMPRA AS "cost", p.STOCK AS "stock",
             cert.CODIGO_CERTIFICADO AS "certificate", cert.HARDWARE_ORIGINAL_PCT AS "hwPct",
             cert.ESTADO_ESTETICO_PCT AS "aestheticPct", cert.RENDIMIENTO_TERMICO_PCT AS "thermalPct",
             cert.MESES_GARANTIA AS "warrantyMonths"
      FROM PRODUCTOS p
      LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
      WHERE p.ACTIVO = 'S' ORDER BY p.NOMBRE
    `);
    res.json(products);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/categories', async (_req, res) => {
  if (demoMode) return res.json(demoCategories);
  if (ordsInventoryUrl) {
    try {
      const categories = collectionItems(await requestOrdsResource('categorias/'));
      return res.json(categories.map(item => ({
        id: Number(item.id ?? item.ID_CATEGORIA ?? item.id_categoria),
        name: item.name ?? item.NOMBRE,
        description: item.description ?? item.DESCRIPCION ?? '',
        slug: item.slug ?? item.SLUG,
        warrantyMonths: Number(item.warrantyMonths ?? item.warranty_months ?? item.GARANTIA_MESES_DEFECTO ?? 12)
      })));
    } catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try {
    const categories = await query(`SELECT ID_CATEGORIA AS "id", NOMBRE AS "name", DESCRIPCION AS "description",
      SLUG AS "slug", GARANTIA_MESES_DEFECTO AS "warrantyMonths" FROM CATEGORIAS ORDER BY NOMBRE`);
    res.json(categories);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, description = '', slug, warrantyMonths } = req.body;
    required(name, 'Nombre');
    required(slug, 'Slug');
    if (!name.trim()) throw new Error('El nombre no puede estar vacío');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) throw new Error('El slug solo puede contener letras minúsculas, números y guiones');
    const warranty = Number(warrantyMonths);
    if (!Number.isInteger(warranty) || warranty < 0 || warranty > 99) throw new Error('La garantía debe ser un número entero entre 0 y 99');
    const category = { name: name.trim(), description: description.trim(), slug: slug.trim().toLowerCase(), warrantyMonths: warranty };
    if (demoMode) {
      if (demoCategories.some(item => item.slug === category.slug)) throw new Error('Ya existe una categoría con ese slug');
      const id = Math.max(0, ...demoCategories.map(item => item.id)) + 1;
      demoCategories.push({ id, ...category });
      return res.status(201).json({ id });
    }
    if (ordsInventoryUrl) return res.status(201).json(await requestOrdsResource('categorias/', 'POST', category));
    const result = await withConnection(connection => connection.execute(
      `INSERT INTO CATEGORIAS (NOMBRE, DESCRIPCION, SLUG, GARANTIA_MESES_DEFECTO)
       VALUES (:name, :description, :slug, :warrantyMonths) RETURNING ID_CATEGORIA INTO :id`,
      { ...category, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    ));
    res.status(201).json({ id: result.outBinds.id[0] });
  } catch (error) {
    res.status(error.message.includes('ORA-02292') ? 409 : 400).json({ error: error.message });
  }
});

app.patch('/api/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('ID de categoría inválido');
    const { name, description, slug, warrantyMonths } = req.body;
    required(name, 'Nombre');
    required(slug, 'Slug');
    if (!name.trim()) throw new Error('El nombre no puede estar vacío');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) throw new Error('El slug solo puede contener letras minúsculas, números y guiones');
    const warranty = Number(warrantyMonths);
    if (!Number.isInteger(warranty) || warranty < 0 || warranty > 99) throw new Error('La garantía debe ser un número entero entre 0 y 99');
    const category = { name: name.trim(), description: String(description || '').trim(), slug: slug.trim().toLowerCase(), warrantyMonths: warranty };
    if (demoMode) {
      const current = demoCategories.find(item => item.id === id);
      if (!current) return res.status(404).json({ error: 'Categoría no encontrada' });
      if (demoCategories.some(item => item.id !== id && item.slug === category.slug)) throw new Error('Ya existe una categoría con ese slug');
      Object.assign(current, category);
      return res.json({ ok: true });
    }
    if (ordsInventoryUrl) return res.json(await requestOrdsResource(`categorias/${id}/`, 'PUT', category));
    const result = await withConnection(connection => connection.execute(
      `UPDATE CATEGORIAS SET NOMBRE = :name, DESCRIPCION = :description, SLUG = :slug,
       GARANTIA_MESES_DEFECTO = :warrantyMonths WHERE ID_CATEGORIA = :id`,
      { ...category, id }
    ));
    if (!result.rowsAffected) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    res.status(error.message.includes('ORA-02292') ? 409 : 400).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('ID de categoría inválido');
    if (demoMode) {
      if (!demoCategories.some(item => item.id === id)) return res.status(404).json({ error: 'Categoría no encontrada' });
      if (demoInventory.some(item => item.categoryId === id)) {
        return res.status(409).json({ error: 'No se puede eliminar: hay productos asignados a esta categoría' });
      }
      demoCategories.splice(demoCategories.findIndex(item => item.id === id), 1);
      return res.json({ ok: true });
    }
    if (ordsInventoryUrl) return res.json(await requestOrdsResource(`categorias/${id}/`, 'DELETE'));
    const result = await withConnection(connection => connection.execute(
      'DELETE FROM CATEGORIAS WHERE ID_CATEGORIA = :id', { id }
    ));
    if (!result.rowsAffected) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ ok: true });
  } catch (error) {
    res.status(error.message.includes('ORA-02292') ? 409 : 400).json({ error: error.message });
  }
});

// Support Catalogs (Customers, Providers, Inventory Options)
app.get('/api/catalogs', async (_req, res) => {
  if (demoMode) return res.json({ customers: demoCustomers, providers: demoProviders, inventory: demoInventory.filter(item => item.stock > 0) });
  if (ordsInventoryUrl && !poolPromise) {
    try {
      const [customersResult, inventoryResult] = await Promise.allSettled([
        getOrdsCollection(`${ordsBaseUrl}clientes/`),
        getOrdsInventory()
      ]);
      const customers = customersResult.status === 'fulfilled' ? collectionItems(customersResult.value) : demoCustomers;
      const inventory = inventoryResult.status === 'fulfilled' ? inventoryResult.value : demoInventory;
      return res.json({ customers, providers: demoProviders, inventory });
    }
    catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try {
    const [customers, providers, inventory] = await Promise.all([
      query('SELECT ID_CLIENTE AS "id", NOMBRE AS "name" FROM CLIENTES ORDER BY NOMBRE'),
      query('SELECT ID_PROVEEDOR AS "id", NOMBRE AS "name" FROM PROVEEDORES ORDER BY NOMBRE'),
      query('SELECT ID_PRODUCTO AS "id", NOMBRE AS "name", STOCK AS "stock", PRECIO_VENTA AS "price" FROM PRODUCTOS WHERE ACTIVO = \'S\' ORDER BY NOMBRE')
    ]);
    res.json({ customers, providers, inventory });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// POST Create Product with GS Certificate
app.post('/api/inventory', async (req, res) => {
  try {
    const { name, brand, model, type, categoryId, price, cost, stock } = req.body;
    required(name, 'Nombre');
    if (!name.trim()) throw new Error('El nombre no puede estar vacío');
    const itemType = type || 'NEXT_GEN';
    const productCategoryId = Number(categoryId);
    if (!Number.isInteger(productCategoryId) || productCategoryId <= 0) throw new Error('Selecciona una categoría válida');
    if (!['NEXT_GEN', 'LAPTOP', 'RETRO', 'ACCESORIO'].includes(itemType)) throw new Error('Tipo de hardware inválido');
    if (!Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      throw new Error('El precio debe ser positivo y el stock un entero no negativo');
    }
    if (!Number.isFinite(Number(cost || 0)) || Number(cost || 0) < 0) throw new Error('El costo debe ser un número no negativo');

    if (demoMode) {
      if (!demoCategories.some(item => item.id === productCategoryId)) throw new Error('La categoría seleccionada no existe');
      const id = Math.max(...demoInventory.map(item => item.id)) + 1;
      const certificate = `#GS-${2200 + id}`;
      const newItem = {
        id, categoryId: productCategoryId, name: name.trim(), brand: brand || 'Gaming Solutions', model: model || 'GS-CUSTOM',
        type: itemType, price: Number(price), cost: Number(cost || 0), stock: Number(stock),
        status: Number(stock) === 0 ? 'Agotado' : 'Disponible',
        certificate, hwPct: 100, aestheticPct: 95, thermalPct: 98, warrantyMonths: itemType === 'LAPTOP' ? 18 : itemType === 'RETRO' ? 6 : 12
      };
      demoInventory.unshift(newItem);
      return res.status(201).json({ id, certificate });
    }
    if (ordsInventoryUrl && !poolPromise) {
      const result = await requestOrdsResource('productos/', 'POST', {
        name, brand, model, type: itemType, categoryId: productCategoryId,
        price: Number(price), cost: cost ? Number(cost) : 0, stock: Number(stock)
      });
      return res.status(201).json(result);
    }
    const id = await transaction(async connection => {
      const result = await connection.execute(
        `INSERT INTO PRODUCTOS (ID_CATEGORIA, NOMBRE, MARCA, MODELO, TIPO_HARDWARE, PRECIO_VENTA, PRECIO_COMPRA, STOCK)
         VALUES (:categoryId, :name, :brand, :model, :type, :price, :cost, :stock) RETURNING ID_PRODUCTO INTO :id`,
        {
          categoryId: productCategoryId, name, brand: brand || '', model: model || '', type: itemType,
          price: Number(price), cost: cost ? Number(cost) : 0, stock: Number(stock),
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );
      const productId = result.outBinds.id[0];
      const certCode = `#GS-${2200 + productId}`;
      await connection.execute(
        `INSERT INTO CERTIFICADOS_GS (ID_PRODUCTO, CODIGO_CERTIFICADO, HARDWARE_ORIGINAL_PCT, ESTADO_ESTETICO_PCT, RENDIMIENTO_TERMICO_PCT, MESES_GARANTIA)
         VALUES (:productId, :certCode, 100, 95, 98, :warranty)`,
        { productId, certCode, warranty: itemType === 'LAPTOP' ? 18 : itemType === 'RETRO' ? 6 : 12 }
      );
      return productId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

async function updateProduct(req, res) {
  try {
    const id = Number(req.params.id);
    const { name, brand, model, type, categoryId, price, cost, stock } = req.body;
    if (!Number.isInteger(id) || id <= 0) throw new Error('ID de producto inválido');
    required(name, 'Nombre');
    const productCategoryId = Number(categoryId);
    if (!Number.isInteger(productCategoryId) || productCategoryId <= 0) throw new Error('Selecciona una categoría válida');
    if (!['NEXT_GEN', 'LAPTOP', 'RETRO', 'ACCESORIO'].includes(type)) throw new Error('Tipo de hardware inválido');
    if (!Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
      throw new Error('El precio debe ser positivo y el stock un entero no negativo');
    }
    if (!Number.isFinite(Number(cost || 0)) || Number(cost || 0) < 0) throw new Error('El costo debe ser un número no negativo');
    const product = {
      name: name.trim(), brand: String(brand || '').trim(), model: String(model || '').trim(),
      type, categoryId: productCategoryId, price: Number(price), cost: Number(cost || 0), stock: Number(stock)
    };
    if (demoMode) {
      const item = demoInventory.find(entry => entry.id === id);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
      if (!demoCategories.some(item => item.id === productCategoryId)) throw new Error('La categoría seleccionada no existe');
      Object.assign(item, product);
      return res.json({ ok: true });
    }
    if (ordsInventoryUrl) return res.json(await requestOrdsResource(`productos/${id}/`, 'PUT', product));
    const result = await withConnection(connection => connection.execute(
      `UPDATE PRODUCTOS SET ID_CATEGORIA = :categoryId, NOMBRE = :name, MARCA = :brand, MODELO = :model,
       TIPO_HARDWARE = :type, PRECIO_VENTA = :price, PRECIO_COMPRA = :cost, STOCK = :stock WHERE ID_PRODUCTO = :id`,
      { ...product, id }
    ));
    if (!result.rowsAffected) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
}

app.put('/api/inventory/:id', updateProduct);
app.patch('/api/inventory/:id', updateProduct);

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new Error('ID de producto inválido');
    if (demoMode) {
      const index = demoInventory.findIndex(item => item.id === id);
      if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
      demoInventory.splice(index, 1);
      return res.json({ ok: true });
    }
    if (ordsInventoryUrl) return res.json(await requestOrdsResource(`productos/${id}/`, 'DELETE'));
    const result = await withConnection(connection => connection.execute(
      `UPDATE PRODUCTOS SET ACTIVO = 'N' WHERE ID_PRODUCTO = :id`, { id }
    ));
    if (!result.rowsAffected) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// POST Register Cash / Manual Sale
app.post('/api/sales', async (req, res) => {
  try {
    const { customerId, payment, items } = req.body;
    required(customerId, 'Cliente'); required(payment, 'Método de pago');
    if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto');
    if (demoMode) {
      const newId = 1049 + demoSales.length;
      demoSales.unshift({
        id: newId,
        customer: demoCustomers.find(c => c.id === Number(customerId))?.name || 'Cliente Registrar',
        date: new Date().toISOString().slice(0, 10),
        total: items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0),
        payment,
        status: 'COMPLETADA'
      });
      return res.status(201).json({ id: newId });
    }
    if (ordsInventoryUrl && !poolPromise) return res.status(201).json(await postOrdsResource('ventas', { customerId: Number(customerId), payment, items }));
    if (!poolPromise) return res.status(501).json({ error: 'Configura la conexión Oracle para registrar ventas.' });
    
    const id = await transaction(async connection => {
      const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
      const header = await connection.execute(
        `INSERT INTO VENTAS (ID_CLIENTE, METODO_PAGO, TOTAL_VENTA) VALUES (:customerId, :payment, :total) RETURNING ID_VENTA INTO :id`,
        { customerId: Number(customerId), payment, total, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      const saleId = header.outBinds.id[0];
      for (const item of items) {
        const stock = await connection.execute(
          `UPDATE PRODUCTOS SET STOCK = STOCK - :quantity WHERE ID_PRODUCTO = :productId AND STOCK >= :quantity`,
          { quantity: Number(item.quantity), productId: Number(item.productId) }
        );
        if (!stock.rowsAffected) throw new Error('Stock insuficiente para el producto seleccionado');
        await connection.execute(
          `INSERT INTO VENTAS_DETALLE (ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO) VALUES (:saleId, :productId, :quantity, :price)`,
          { saleId, productId: Number(item.productId), quantity: Number(item.quantity), price: Number(item.price) }
        );
      }
      return saleId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// POST Register Purchase from Supplier
app.post('/api/purchases', async (req, res) => {
  try {
    const { providerId, items } = req.body;
    required(providerId, 'Proveedor');
    if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto');
    if (demoMode) return res.status(201).json({ id: 2001 });
    if (ordsInventoryUrl && !poolPromise) return res.status(201).json(await postOrdsResource('compras', { providerId: Number(providerId), items }));
    if (!poolPromise) return res.status(501).json({ error: 'Configura la conexión Oracle para registrar compras.' });
    
    const id = await transaction(async connection => {
      const total = items.reduce((sum, item) => sum + Number(item.cost) * Number(item.quantity), 0);
      const header = await connection.execute(
        `INSERT INTO COMPRAS (ID_PROVEEDOR, TOTAL_COMPRA) VALUES (:providerId, :total) RETURNING ID_COMPRA INTO :id`,
        { providerId: Number(providerId), total, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      const purchaseId = header.outBinds.id[0];
      for (const item of items) {
        await connection.execute(
          `UPDATE PRODUCTOS SET STOCK = STOCK + :quantity, PRECIO_COMPRA = :cost WHERE ID_PRODUCTO = :productId`,
          { quantity: Number(item.quantity), cost: Number(item.cost), productId: Number(item.productId) }
        );
        await connection.execute(
          `INSERT INTO COMPRAS_DETALLE (ID_COMPRA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO) VALUES (:purchaseId, :productId, :quantity, :cost)`,
          { purchaseId, productId: Number(item.productId), quantity: Number(item.quantity), cost: Number(item.cost) }
        );
      }
      return purchaseId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const runtimeMode = demoMode ? 'demo' : ordsInventoryUrl ? 'ORDS' : hasOracleCredentials ? 'Oracle' : 'sin base de datos';
app.listen(port, () => console.log(`Gaming Solutions listo en http://localhost:${port} (${runtimeMode})`));
