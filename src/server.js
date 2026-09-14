require('dotenv').config();

const path = require('node:path');
const express = require('express');
const oracledb = require('oracledb');

const app = express();
const port = Number(process.env.PORT || 3000);
const apiVersion = '2026.09.12-ords';
const demoMode = process.env.DEMO_MODE === 'true';
const ordsInventoryUrl = process.env.ORDS_INVENTORY_URL || 'https://oracleapex.com/ords/luism/gaming/consolas/';
const ordsBaseUrl = ordsInventoryUrl.replace(/consolas\/?$/, '');
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

const demoInventory = [
  { id: 1, name: 'PlayStation 5 Slim', brand: 'Sony', model: 'CFI-2015', type: 'NUEVA', price: 499.99, stock: 8, status: 'Disponible' },
  { id: 2, name: 'Nintendo Switch OLED', brand: 'Nintendo', model: 'HEG-001', type: 'NUEVA', price: 349.99, stock: 5, status: 'Disponible' },
  { id: 3, name: 'Xbox Series X', brand: 'Microsoft', model: 'RRT-00010', type: 'NUEVA', price: 479.99, stock: 3, status: 'Stock bajo' },
  { id: 4, name: 'Super Nintendo SNES', brand: 'Nintendo', model: 'SNS-001', type: 'RETRO', price: 189.99, stock: 2, status: 'Stock bajo' },
  { id: 5, name: 'Game Boy Color', brand: 'Nintendo', model: 'CGB-001', type: 'RETRO', price: 129.99, stock: 0, status: 'Agotado' },
  { id: 6, name: 'Sega Genesis', brand: 'Sega', model: 'MK-1601', type: 'RETRO', price: 159.99, stock: 4, status: 'Disponible' }
];

const demoSales = [
  { id: 1048, customer: 'María González', date: '2026-09-11', total: 849.98, payment: 'TARJETA', status: 'COMPLETADA' },
  { id: 1047, customer: 'Carlos Ramírez', date: '2026-09-10', total: 189.99, payment: 'EFECTIVO', status: 'COMPLETADA' },
  { id: 1046, customer: 'Ana Torres', date: '2026-09-09', total: 349.99, payment: 'TRANSFERENCIA', status: 'COMPLETADA' }
];

const demoCustomers = [{ id: 1, name: 'María González' }, { id: 2, name: 'Carlos Ramírez' }];
const demoProviders = [{ id: 1, name: 'Distribuciones Next Level' }, { id: 2, name: 'Jorge Mendoza' }];

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
  return { id: Number(value(['id', 'ID_CONSOLA', 'id_consola'])), name: value(['name', 'NOMBRE', 'nombre'], 'Sin nombre'), brand: value(['brand', 'MARCA', 'marca'], ''), model: value(['model', 'MODELO', 'modelo'], ''), type: value(['type', 'TIPO', 'tipo'], 'NUEVA'), price: Number(value(['price', 'PRECIO_VENTA', 'precio_venta'], 0)), stock, status: stock === 0 ? 'Agotado' : stock <= 3 ? 'Stock bajo' : 'Disponible' };
}

async function getOrdsInventory() {
  const payload = await getOrdsCollection(ordsInventoryUrl);
  const items = collectionItems(payload);
  return items.map(normalizeOrdsItem);
}

function collectionItems(payload) {
  return Array.isArray(payload) ? payload : payload.items || [];
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

app.get('/api/dashboard', async (_req, res) => {
  if (demoMode) {
    return res.json({ mode: 'demo', inventory: demoInventory, sales: demoSales, metrics: { inventory: 24, lowStock: 3, monthlySales: 13840.5, customers: 86 } });
  }
  try {
    if (ordsInventoryUrl) {
      const inventory = await getOrdsInventory();
      return res.json({ mode: 'ords', inventory, sales: [], metrics: { inventory: inventory.reduce((total, item) => total + item.stock, 0), lowStock: inventory.filter(item => item.stock > 0 && item.stock <= 3).length, monthlySales: 0, customers: 0 } });
    }
    const [inventory, sales, metrics] = await Promise.all([
      query(`SELECT c.ID_CONSOLA AS "id", c.NOMBRE AS "name", c.MARCA AS "brand", c.MODELO AS "model",
            c.TIPO AS "type", c.PRECIO_VENTA AS "price", c.STOCK AS "stock",
            CASE WHEN c.STOCK = 0 THEN 'Agotado' WHEN c.STOCK <= 3 THEN 'Stock bajo' ELSE 'Disponible' END AS "status"
             FROM CONSOLAS c WHERE c.ACTIVO = 'S' ORDER BY c.FECHA_INGRESO DESC`),
      query(`SELECT v.ID_VENTA AS "id", c.NOMBRE AS "customer", TO_CHAR(v.FECHA_VENTA, 'YYYY-MM-DD') AS "date",
            v.TOTAL_VENTA AS "total", v.METODO_PAGO AS "payment", v.ESTADO_VENTA AS "status"
             FROM VENTAS v JOIN CLIENTES c ON c.ID_CLIENTE = v.ID_CLIENTE
             ORDER BY v.FECHA_VENTA DESC FETCH FIRST 5 ROWS ONLY`),
      query(`SELECT (SELECT COUNT(*) FROM CONSOLAS WHERE ACTIVO = 'S') AS "inventory",
            (SELECT COUNT(*) FROM CONSOLAS WHERE ACTIVO = 'S' AND STOCK BETWEEN 1 AND 3) AS "lowStock",
            (SELECT NVL(SUM(TOTAL_VENTA), 0) FROM VENTAS WHERE ESTADO_VENTA = 'COMPLETADA' AND FECHA_VENTA >= TRUNC(SYSDATE, 'MM')) AS "monthlySales",
            (SELECT COUNT(*) FROM CLIENTES) AS "customers" FROM DUAL`)
    ]);
    res.json({ inventory, sales, metrics: metrics[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/inventory', async (_req, res) => {
  if (demoMode) return res.json(demoInventory);
  if (ordsInventoryUrl) {
    try { return res.json(await getOrdsInventory()); } catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try { res.json(await query(`SELECT ID_CONSOLA AS "id", NOMBRE AS "name", MARCA AS "brand", MODELO AS "model", TIPO AS "type", PRECIO_VENTA AS "price", STOCK AS "stock" FROM CONSOLAS WHERE ACTIVO = 'S' ORDER BY NOMBRE`)); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/catalogs', async (_req, res) => {
  if (demoMode) return res.json({ customers: demoCustomers, providers: demoProviders, inventory: demoInventory.filter(item => item.stock > 0) });
  if (ordsInventoryUrl && !poolPromise) {
    try {
      const [customersResult, inventoryResult] = await Promise.allSettled([
        getOrdsCollection(`${ordsBaseUrl}clientes/`),
        getOrdsInventory()
      ]);
      if (inventoryResult.status === 'rejected') throw inventoryResult.reason;
      const customers = customersResult.status === 'fulfilled'
        ? collectionItems(customersResult.value)
        : [];
      return res.json({ customers, providers: [], inventory: inventoryResult.value });
    }
    catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try {
    const [customers, providers, inventory] = await Promise.all([
      query('SELECT ID_CLIENTE AS "id", NOMBRE AS "name" FROM CLIENTES ORDER BY NOMBRE'),
      query('SELECT ID_PROVEEDOR AS "id", NOMBRE AS "name" FROM PROVEEDORES ORDER BY NOMBRE'),
      query('SELECT ID_CONSOLA AS "id", NOMBRE AS "name", STOCK AS "stock", PRECIO_VENTA AS "price" FROM CONSOLAS WHERE ACTIVO = \'S\' ORDER BY NOMBRE')
    ]);
    res.json({ customers, providers, inventory });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { name, brand, model, type, price, cost, stock, retro } = req.body;
    required(name, 'Nombre'); required(type, 'Tipo');
    if (!['NUEVA', 'RETRO'].includes(type) || Number(price) < 0 || Number(stock) < 0) throw new Error('Datos de inventario inválidos');
    if (demoMode) {
      const id = Math.max(...demoInventory.map(item => item.id)) + 1;
      demoInventory.unshift({ id, name, brand, model, type, price: Number(price), stock: Number(stock), status: Number(stock) === 0 ? 'Agotado' : 'Disponible' });
      return res.status(201).json({ id });
    }
    if (ordsInventoryUrl && !poolPromise) {
      const result = await postOrdsResource('consolas', { name, brand, model, type, price: Number(price), cost: cost ? Number(cost) : null, stock: Number(stock), retro });
      return res.status(201).json(result);
    }
    const id = await transaction(async connection => {
      const result = await connection.execute(`INSERT INTO CONSOLAS (NOMBRE, MARCA, MODELO, TIPO, PRECIO_VENTA, PRECIO_COMPRA, STOCK)
        VALUES (:name, :brand, :model, :type, :price, :cost, :stock) RETURNING ID_CONSOLA INTO :id`,
      { name, brand, model, type, price: Number(price), cost: cost ? Number(cost) : null, stock: Number(stock), id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
      const inventoryId = result.outBinds.id[0];
      if (type === 'RETRO' && retro) await connection.execute(`INSERT INTO CONSOLAS_RETRO_DETALLE (ID_CONSOLA, CONDICION_ESTETICA, INCLUYE_CAJA, INCLUYE_MANUAL, ESTADO_FUNCIONAL) VALUES (:id, :condition, :box, :manual, :functional)`, { id: inventoryId, condition: Number(retro.condition || 5), box: retro.box ? 'S' : 'N', manual: retro.manual ? 'S' : 'N', functional: retro.functional || 'FUNCIONAL' });
      return inventoryId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.patch('/api/inventory/:id', async (req, res) => {
  try {
    const { price, stock, name } = req.body;
    if (demoMode) {
      const item = demoInventory.find(entry => entry.id === Number(req.params.id));
      if (!item) return res.status(404).json({ error: 'Consola no encontrada' });
      if (name) item.name = name; if (price !== undefined) item.price = Number(price); if (stock !== undefined) item.stock = Number(stock);
      return res.json({ ok: true });
    }
    const result = await withConnection(connection => connection.execute(`UPDATE CONSOLAS SET NOMBRE = COALESCE(:name, NOMBRE), PRECIO_VENTA = COALESCE(:price, PRECIO_VENTA), STOCK = COALESCE(:stock, STOCK) WHERE ID_CONSOLA = :id`, { id: Number(req.params.id), name: name || null, price: price === undefined ? null : Number(price), stock: stock === undefined ? null : Number(stock) }));
    if (!result.rowsAffected) return res.status(404).json({ error: 'Consola no encontrada' });
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { customerId, payment, items } = req.body;
    required(customerId, 'Cliente'); required(payment, 'Método de pago');
    if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto');
    if (demoMode) { demoSales.unshift({ id: 1049, customer: demoCustomers.find(customer => customer.id === Number(customerId))?.name || 'Cliente', date: new Date().toISOString().slice(0, 10), total: items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0), payment, status: 'COMPLETADA' }); return res.status(201).json({ id: 1049 }); }
    if (ordsInventoryUrl && !poolPromise) return res.status(201).json(await postOrdsResource('ventas', { customerId: Number(customerId), payment, items }));
    if (!poolPromise) return res.status(501).json({ error: 'Configura la conexión Oracle para registrar ventas.' });
    const id = await transaction(async connection => {
      const total = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
      const header = await connection.execute(`INSERT INTO VENTAS (ID_CLIENTE, METODO_PAGO, TOTAL_VENTA) VALUES (:customerId, :payment, :total) RETURNING ID_VENTA INTO :id`, { customerId: Number(customerId), payment, total, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
      const saleId = header.outBinds.id[0];
      for (const item of items) {
        const stock = await connection.execute(`UPDATE CONSOLAS SET STOCK = STOCK - :quantity WHERE ID_CONSOLA = :productId AND STOCK >= :quantity`, { quantity: Number(item.quantity), productId: Number(item.productId) });
        if (!stock.rowsAffected) throw new Error('Stock insuficiente para una consola');
        await connection.execute(`INSERT INTO VENTAS_DETALLE (ID_VENTA, ID_CONSOLA, CANTIDAD, PRECIO_UNITARIO) VALUES (:saleId, :productId, :quantity, :price)`, { saleId, productId: Number(item.productId), quantity: Number(item.quantity), price: Number(item.price) });
      }
      return saleId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

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
      const header = await connection.execute(`INSERT INTO COMPRAS (ID_PROVEEDOR, TOTAL_COMPRA) VALUES (:providerId, :total) RETURNING ID_COMPRA INTO :id`, { providerId: Number(providerId), total, id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
      const purchaseId = header.outBinds.id[0];
      for (const item of items) {
        await connection.execute(`UPDATE CONSOLAS SET STOCK = STOCK + :quantity, PRECIO_COMPRA = :cost WHERE ID_CONSOLA = :productId`, { quantity: Number(item.quantity), cost: Number(item.cost), productId: Number(item.productId) });
        await connection.execute(`INSERT INTO COMPRAS_DETALLE (ID_COMPRA, ID_CONSOLA, CANTIDAD, PRECIO_UNITARIO) VALUES (:purchaseId, :productId, :quantity, :cost)`, { purchaseId, productId: Number(item.productId), quantity: Number(item.quantity), cost: Number(item.cost) });
      }
      return purchaseId;
    });
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const runtimeMode = demoMode ? 'demo' : ordsInventoryUrl ? 'ORDS' : hasOracleCredentials ? 'Oracle' : 'sin base de datos';
app.listen(port, () => console.log(`Gaming Solutions listo en http://localhost:${port} (${runtimeMode})`));
