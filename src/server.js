require('dotenv').config();

const path = require('node:path');
const express = require('express');
const oracledb = require('oracledb');
const bcrypt = require('bcryptjs');
const {
  configureAuth,
  authenticateToken,
  requireRole,
  loginHandler,
  meHandler
} = require('./middleware/auth');
const { createSalesRouter } = require('./routes/sales');
const { createPurchasesRouter } = require('./routes/purchases');
const { createMobileRouter } = require('./routes/mobile');
const { loadDemoData, createDemoPersistence } = require('./demo-store');

const app = express();
const port = Number(process.env.PORT || 3000);
const apiVersion = '2026.09.28-apex-ords';
const demoMode = process.env.DEMO_MODE === 'true';
// Configure either the full product collection URL or the ORDS module base URL.
const configuredOrdsBaseUrl = process.env.ORDS_BASE_URL || '';
const configuredInventoryUrl = process.env.ORDS_INVENTORY_URL || '';
const ordsInventoryUrl = /\/(productos|consolas)\/?$/i.test(configuredInventoryUrl)
  ? `${configuredInventoryUrl.replace(/\/+$/, '')}/`
  : `${(configuredOrdsBaseUrl || configuredInventoryUrl).replace(/\/+$/, '')}/productos/`;
// Used to build sibling ORDS resources such as POST /productos/.
const ordsBaseUrl = (configuredOrdsBaseUrl || ordsInventoryUrl.replace(/(productos|consolas)\/?$/, '')).replace(/\/+$/, '') + '/';
// Can be overridden if the ORDS WAF requires a different User-Agent.
const ordsUserAgent = process.env.ORDS_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const hasOracleCredentials = Boolean(
  process.env.ORACLE_USER &&
  process.env.ORACLE_PASSWORD &&
  process.env.ORACLE_PASSWORD !== 'replace-me' &&
  process.env.ORACLE_CONNECT_STRING
);

const oracleUnavailableMessage = 'Configura las variables de conexión Oracle o activa DEMO_MODE=true.';

// ORDS handles operational resources, while this pool also supports API login
// against USUARIOS when ORDS is enabled.
const poolPromise = demoMode || !hasOracleCredentials ? null : oracledb.createPool({
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
let demoInventory = [
  { id: 1, name: 'PlayStation 5 Slim Digital', brand: 'Sony', model: 'CFI-2015', type: 'NEXT_GEN', price: 499.99, cost: 420.00, stock: 8, status: 'Disponible', certificate: '#GS-2201', hwPct: 100, aestheticPct: 96, thermalPct: 98, warrantyMonths: 12 },
  { id: 2, name: 'Nintendo Switch OLED White', brand: 'Nintendo', model: 'HEG-001', type: 'NEXT_GEN', price: 349.99, cost: 290.00, stock: 5, status: 'Disponible', certificate: '#GS-2202', hwPct: 100, aestheticPct: 98, thermalPct: 97, warrantyMonths: 12 },
  { id: 3, name: 'Xbox Series X 1TB Black', brand: 'Microsoft', model: 'RRT-00010', type: 'NEXT_GEN', price: 479.99, cost: 400.00, stock: 3, status: 'Stock bajo', certificate: '#GS-2203', hwPct: 100, aestheticPct: 94, thermalPct: 96, warrantyMonths: 12 },
  { id: 4, name: 'ASUS ROG Strix G16 RTX 4070', brand: 'ASUS', model: 'G614JI', type: 'LAPTOP', price: 1499.99, cost: 1250.00, stock: 4, status: 'Disponible', certificate: '#GS-2204', hwPct: 100, aestheticPct: 95, thermalPct: 95, warrantyMonths: 18 },
  { id: 5, name: 'MSI Raider GE78 HX i9 RTX 4080', brand: 'MSI', model: 'GE78-HX', type: 'LAPTOP', price: 2199.99, cost: 1850.00, stock: 2, status: 'Stock bajo', certificate: '#GS-2205', hwPct: 100, aestheticPct: 99, thermalPct: 99, warrantyMonths: 18 },
  { id: 6, name: 'Super Nintendo SNES Recapacitada', brand: 'Nintendo', model: 'SNS-001', type: 'RETRO', price: 189.99, cost: 100.00, stock: 2, status: 'Stock bajo', certificate: '#GS-2206', hwPct: 95, aestheticPct: 92, thermalPct: 96, warrantyMonths: 6 },
  { id: 7, name: 'Game Boy Color Atomic Purple', brand: 'Nintendo', model: 'CGB-001', type: 'RETRO', price: 129.99, cost: 60.00, stock: 0, status: 'Agotado', certificate: '#GS-2207', hwPct: 90, aestheticPct: 88, thermalPct: 94, warrantyMonths: 6 },
  { id: 8, name: 'Sega Genesis Model 1 HD', brand: 'Sega', model: 'MK-1601', type: 'RETRO', price: 159.99, cost: 75.00, stock: 4, status: 'Disponible', certificate: '#GS-2208', hwPct: 100, aestheticPct: 93, thermalPct: 97, warrantyMonths: 6 }
];

let demoSales = [
  { id: 1048, customer: 'María González', date: '2026-09-28', total: 849.98, payment: 'TARJETA', status: 'COMPLETADA', notes: 'Boleta emitida presencial' },
  { id: 1047, customer: 'Carlos Ramírez', date: '2026-09-27', total: 189.99, payment: 'EFECTIVO', status: 'COMPLETADA', notes: 'Pago contra entrega en tienda' },
  { id: 1046, customer: 'Ana Torres', date: '2026-09-26', total: 1499.99, payment: 'TRANSFERENCIA', status: 'COMPLETADA', notes: 'Transferencia confirmada en laboratorio' }
];

let demoCustomers = [
  { id: 1, name: 'María González', nit: '1234567-8', phone: '5555-0101', address: 'Zona 10, Guatemala' },
  { id: 2, name: 'Carlos Ramírez', dpi: '1234 56789 0101', phone: '5555-0102', address: 'Zona 1, Guatemala' },
  { id: 3, name: 'Ana Torres' }
];

let demoProviders = [
  { id: 1, name: 'Distribuciones Next Level S.A.C.' },
  { id: 2, name: 'Jorge Mendoza (Coleccionista)' }
];

let demoAudit = [
  { id: 1, operation: 'INICIO', table: 'SISTEMA', timestamp: new Date().toISOString(), dbUser: 'DEMO' },
  { id: 2, operation: 'SEED', table: 'PRODUCTOS', timestamp: new Date().toISOString(), dbUser: 'DEMO' }
];

const demoUsers = [
  { id_usuario: 1, username: 'admin', nombre: 'Carlos Mendoza - Admin Master', rol: 'Administrador', passwordHash: bcrypt.hashSync('admin123', 10) },
  { id_usuario: 2, username: 'ventas', nombre: 'María González - Ventas', rol: 'Ventas', passwordHash: bcrypt.hashSync('ventas123', 10) },
  { id_usuario: 3, username: 'almacen', nombre: 'Roberto Silva - Almacén', rol: 'Almacen', passwordHash: bcrypt.hashSync('almacen123', 10) }
];

if (demoMode) {
  const stored = loadDemoData({
    inventory: demoInventory,
    sales: demoSales,
    customers: demoCustomers,
    providers: demoProviders,
    audit: demoAudit
  });
  demoInventory = stored.inventory;
  demoSales = stored.sales;
  demoCustomers = stored.customers;
  demoProviders = stored.providers;
  demoAudit = stored.audit;
}

function persistDemoData() {
  if (demoMode) {
    createDemoPersistence({ inventory: demoInventory, sales: demoSales, customers: demoCustomers, providers: demoProviders, audit: demoAudit });
  }
}

if (!demoMode && !ordsInventoryUrl && !hasOracleCredentials) {
  console.error('CONFIGURACIÓN INVÁLIDA: DEMO_MODE=false requiere ORDS_INVENTORY_URL o credenciales Oracle. No se usará almacenamiento en memoria.');
}

async function loginViaOrds(username, password) {
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD &&
      username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    return { id_usuario: 1, nombre: 'Administrador', rol: 'Administrador' };
  }
  const authUrl = process.env.ORDS_AUTH_URL;
  if (!authUrl) {
    const error = new Error('ORDS no publica un endpoint de autenticación. Configura ORACLE_* o ADMIN_USERNAME/ADMIN_PASSWORD.');
    error.code = 'AUTH_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  const payload = await requestOrds(authUrl.replace(/\/+$/, ''), {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  const user = singleCollectionItem(payload);
  if (!user) return null;
  const passwordHash = user.passwordHash || user.password_hash || user.CLAVE_HASH;
  if (!passwordHash || !(await bcrypt.compare(password, passwordHash))) return null;
  return {
    id_usuario: user.id_usuario || user.ID_USUARIO || user.id,
    nombre: user.nombre || user.NOMBRE_COMPLETO || user.name,
    rol: user.rol || user.NOMBRE_ROL || user.role,
    passwordHash
  };
}

configureAuth({
  demoMode,
  query: poolPromise ? query : null,
  loginViaOrds: !poolPromise && process.env.ORDS_AUTH_URL ? loginViaOrds : null,
  demoUsers
});

async function setOracleActor(connection, user) {
  if (user?.id_usuario) {
    await connection.execute(
      `BEGIN DBMS_SESSION.SET_IDENTIFIER(:id_usuario); END;`,
      { id_usuario: String(user.id_usuario) }
    );
  }
}

async function withConnection(work, user) {
  if (!poolPromise) {
    const error = new Error(oracleUnavailableMessage);
    error.code = 'AUTH_DB_UNAVAILABLE';
    throw error;
  }
  const pool = await poolPromise;
  const connection = await pool.getConnection();
  try {
    await setOracleActor(connection, user);
    return await work(connection);
  } finally { await connection.close(); }
}

async function query(sql, binds = {}) {
  return withConnection(async (connection) => {
    const result = await connection.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return result.rows;
  });
}

async function transaction(work, user) {
  const pool = await poolPromise;
  const connection = await pool.getConnection();
  try {
    await setOracleActor(connection, user);
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { await connection.close(); }
}

app.post('/api/auth/login', loginHandler);
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/health') return next();
  return authenticateToken(req, res, next);
});
app.get('/api/auth/me', meHandler);
app.use('/api/sales', createSalesRouter({
  demoMode,
  demoSales,
  demoCustomers,
  demoInventory,
  poolPromise,
  transaction,
  postOrdsResource,
  query,
  persistDemoData
}));
app.use('/api/purchases', createPurchasesRouter({
  demoMode,
  demoInventory,
  poolPromise,
  transaction,
  postOrdsResource,
  persistDemoData
}));
app.use('/api/mobile', createMobileRouter({
  demoMode,
  demoInventory,
  demoSales,
  poolPromise,
  query,
  getOrdsCollection,
  getOrdsInventory,
  normalizeOrdsItem,
  ordsBaseUrl
}));

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
    name: value(['name', 'NOMBRE', 'nombre'], 'Sin nombre'),
    brand: value(['brand', 'MARCA', 'marca'], ''),
    model: value(['model', 'MODELO', 'modelo'], ''),
    type: value(['type', 'TIPO_HARDWARE', 'tipo_hardware', 'TIPO', 'tipo'], 'NEXT_GEN'),
    productType: value(['productType', 'product_type', 'TIPO_PRODUCTO', 'tipo_producto'], 'NUEVO'),
    imageUrl: value(['imageUrl', 'image_url', 'IMAGEN_URL', 'imagen_url'], ''),
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

function ordsValue(item, names, fallback = null) {
  const key = names.find(name => item?.[name] !== undefined && item?.[name] !== null);
  return key ? item[key] : fallback;
}

function normalizeOrdsCustomer(item) {
  return {
    id: Number(ordsValue(item, ['id', 'id_cliente', 'ID_CLIENTE'], 0)),
    name: ordsValue(item, ['name', 'nombre', 'NOMBRE'], 'Cliente'),
    phone: ordsValue(item, ['phone', 'telefono', 'TELEFONO'], ''),
    address: ordsValue(item, ['address', 'direccion', 'DIRECCION'], ''),
    nit: ordsValue(item, ['nit', 'NIT'], ''),
    dpi: ordsValue(item, ['dpi', 'DPI'], '')
  };
}

function normalizeOrdsSale(item) {
  return {
    id: Number(ordsValue(item, ['id', 'id_venta', 'ID_VENTA'], 0)),
    date: ordsValue(item, ['date', 'fecha', 'fecha_venta', 'FECHA_VENTA'], ''),
    total: Number(ordsValue(item, ['total', 'total_venta', 'TOTAL_VENTA'], 0)),
    customer: ordsValue(item, ['customer', 'cliente', 'nombre_cliente', 'NOMBRE_CLIENTE'], 'Cliente'),
    payment: ordsValue(item, ['payment', 'metodo_pago', 'METODO_PAGO'], ''),
    status: ordsValue(item, ['status', 'estado_venta', 'ESTADO_VENTA'], '')
  };
}

async function aggregateOrdsSummary() {
  const [customersPayload, productsPayload, salesPayload] = await Promise.all([
    getOrdsCollection(`${ordsBaseUrl}clientes/`),
    getOrdsCollection(ordsInventoryUrl),
    getOrdsCollection(`${ordsBaseUrl}ventas/consulta/`).catch(error => {
      console.error('ORDS /ventas/consulta/ no disponible; intentando /ventas/:', error.message);
      return getOrdsCollection(`${ordsBaseUrl}ventas/`);
    })
  ]);
  const customers = collectionItems(customersPayload).map(normalizeOrdsCustomer);
  const products = collectionItems(productsPayload).map(normalizeOrdsItem);
  const sales = collectionItems(salesPayload).map(normalizeOrdsSale);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlySales = sales
    .filter(sale => String(sale.date).slice(0, 7) === currentMonth)
    .reduce((sum, sale) => sum + (Number.isFinite(sale.total) ? sale.total : 0), 0);
  return {
    customers: customers.length,
    totalStock: products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0),
    monthlySales,
    lowStock: products.filter(product => Number(product.stock) <= 3).length,
    inventory: products.reduce((sum, product) => sum + (Number(product.stock) || 0), 0),
    inventoryItems: products,
    sales: sales.slice(-5).reverse()
  };
}

function singleCollectionItem(payload) {
  if (Array.isArray(payload)) return payload[0] || null;
  if (Array.isArray(payload.items)) return payload.items[0] || null;
  return payload;
}

// READ ORDS collection resources by name, for example /proveedores/ or /auditoria/.
async function getOrdsItems(resource) {
  return collectionItems(await getOrdsCollection(`${ordsBaseUrl}${resource}/`));
}

// ORDS GET transport shared by inventory and other collection endpoints.
async function getOrdsCollection(url) {
  return requestOrds(url, { method: 'GET' });
}

// ORDS POST transport; forwards a JSON payload and parses the JSON response.
async function postOrdsResource(resource, payload, user) {
  const body = user ? { ...payload, id_usuario: Number(user.id_usuario) } : payload;
  return requestOrds(`${ordsBaseUrl}${resource.replace(/^\/+/, '').replace(/\/?$/, '/')}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

async function requestOrds(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': ordsUserAgent,
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(15000)
    });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error(`ORDS ${options.method || 'GET'} ${url} respondió HTTP ${response.status}: ${responseBody || 'sin cuerpo'}`);
      throw new Error(`ORDS respondió HTTP ${response.status}: ${responseBody || 'sin detalle'}`);
    }
    if (!responseBody) return { ok: true };
    try {
      return JSON.parse(responseBody);
    } catch (error) {
      console.error(`ORDS ${options.method || 'GET'} ${url} devolvió JSON inválido: ${responseBody}`);
      throw new Error(`ORDS devolvió una respuesta no válida: ${error.message}`);
    }
  } catch (error) {
    console.error(`Error de comunicación con ORDS ${options.method || 'GET'} ${url}:`, error);
    throw error;
  }
}

function normalizeSummaryMetrics(payload) {
  const source = payload?.metrics || payload || {};
  return {
    inventory: Number(source.inventory ?? source.total_stock ?? source.TOTAL_STOCK ?? 0),
    lowStock: Number(source.lowStock ?? source.low_stock ?? source.LOW_STOCK ?? 0),
    monthlySales: Number(source.monthlySales ?? source.monthly_sales ?? source.ventas_mes ?? source.VENTAS_MES ?? 0),
    customers: Number(source.customers ?? source.total_clientes ?? source.TOTAL_CLIENTES ?? 0)
  };
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
      // ORDS dashboard, inventory, and sales are separate read-only endpoints.
      const [inventory, dashboard, sales] = await Promise.all([
        getOrdsInventory(),
        getOrdsCollection(`${ordsBaseUrl}dashboard/`),
        getOrdsItems('ventas/consulta')
      ]);
      const metrics = normalizeSummaryMetrics(dashboard);
      return res.json({
        mode: 'ords',
        inventory,
        sales,
        metrics
      });
    }
    const [inventory, sales, metrics] = await Promise.all([
      query(`SELECT p.ID_PRODUCTO AS "id", p.NOMBRE AS "name", p.MARCA AS "brand", p.MODELO AS "model",
            p.TIPO_HARDWARE AS "type", p.TIPO_PRODUCTO AS "productType", p.IMAGEN_URL AS "imageUrl", p.PRECIO_VENTA AS "price", p.STOCK AS "stock",
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
            (SELECT COUNT(ID_CLIENTE) FROM CLIENTES) AS "customers" FROM DUAL`)
    ]);
    res.json({ inventory, sales, metrics: metrics[0] });
  } catch (error) { res.status(ordsInventoryUrl ? 502 : 500).json({ error: error.message }); }
});

// Resumen operativo: métricas reales para consumidores que no usan /api/dashboard.
app.get('/api/summary', requireRole(['Administrador', 'Ventas', 'Almacen']), async (_req, res) => {
  if (demoMode) {
    return res.json({ mode: 'demo', metrics: { inventory: demoInventory.reduce((total, item) => total + item.stock, 0), monthlySales: 13840.50, lowStock: demoInventory.filter(item => item.stock > 0 && item.stock <= 3).length, customers: 86 } });
  }
  try {
    if (ordsInventoryUrl) {
      try {
        const payload = await getOrdsCollection(`${ordsBaseUrl}dashboard/`);
        const metrics = normalizeSummaryMetrics(payload);
        if (metrics.customers || metrics.inventory || metrics.monthlySales || metrics.lowStock) {
          return res.json({ ok: true, mode: 'ords', metrics: { ...metrics, totalStock: metrics.inventory } });
        }
      } catch (error) {
        console.error('ORDS /dashboard/ no disponible; calculando resumen desde colecciones:', error.message);
      }
      const aggregate = await aggregateOrdsSummary();
      const { inventoryItems, sales, ...metrics } = aggregate;
      return res.json({ ok: true, mode: 'ords', metrics, inventory: inventoryItems, sales });
    }
    const [metrics] = await query(`SELECT
      (SELECT NVL(SUM(STOCK), 0) FROM PRODUCTOS WHERE ACTIVO = 'S') AS "inventory",
      (SELECT NVL(SUM(TOTAL_VENTA), 0) FROM VENTAS WHERE ESTADO_VENTA = 'COMPLETADA' AND FECHA_VENTA >= TRUNC(SYSDATE, 'MM')) AS "monthlySales",
      (SELECT COUNT(*) FROM PRODUCTOS WHERE ACTIVO = 'S' AND STOCK BETWEEN 1 AND 3) AS "lowStock",
      (SELECT COUNT(ID_CLIENTE) FROM CLIENTES) AS "customers"
      FROM DUAL`);
    return res.json({ ok: true, mode: 'oracle', metrics: { ...metrics, totalStock: metrics.inventory } });
  } catch (error) {
    return res.status(ordsInventoryUrl ? 502 : 500).json({ error: error.message });
  }
});

// READ products: GET /api/inventory proxies the ORDS GET /productos/ collection.
app.get('/api/inventory', requireRole(['Administrador', 'Ventas', 'Almacen']), async (_req, res) => {
  if (demoMode) return res.json(demoInventory);
  if (ordsInventoryUrl) {
    try { return res.json(await getOrdsInventory()); } catch (error) { return res.status(502).json({ error: error.message }); }
  }
  try {
    const products = await query(`
      SELECT p.ID_PRODUCTO AS "id", p.NOMBRE AS "name", p.MARCA AS "brand", p.MODELO AS "model", 
             p.TIPO_HARDWARE AS "type", p.TIPO_PRODUCTO AS "productType", p.IMAGEN_URL AS "imageUrl", p.PRECIO_VENTA AS "price", p.PRECIO_COMPRA AS "cost", p.STOCK AS "stock",
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

// READ one product: GET /api/inventory/:id proxies ORDS GET /productos/:id/.
app.get('/api/inventory/:id', requireRole(['Administrador', 'Ventas', 'Almacen']), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: 'ID de producto inválido' });
  if (demoMode) {
    const product = demoInventory.find(item => item.id === productId);
    return product ? res.json(product) : res.status(404).json({ error: 'Producto no encontrado' });
  }
  try {
    const payload = await getOrdsCollection(`${ordsBaseUrl}productos/${productId}/`);
    const product = singleCollectionItem(payload);
    if (!product || !Object.keys(product).length) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json(normalizeOrdsItem(product));
  } catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ providers: GET /api/providers proxies ORDS GET /proveedores/.
app.get('/api/providers', requireRole(['Administrador', 'Almacen']), async (_req, res) => {
  if (demoMode) return res.json(demoProviders);
  try { return res.json(await getOrdsItems('proveedores')); }
  catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ categories: GET /api/categories proxies ORDS GET /categorias/.
app.get('/api/categories', requireRole(['Administrador', 'Almacen']), async (_req, res) => {
  if (demoMode) return res.json([]);
  try { return res.json(await getOrdsItems('categorias')); }
  catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ client contact data: GET /api/clients proxies ORDS GET /clientes/.
app.get('/api/clients', requireRole(['Administrador', 'Ventas']), async (_req, res) => {
  if (demoMode) return res.json(demoCustomers);
  try { return res.json(await getOrdsItems('clientes')); }
  catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ sales: GET /api/sales proxies ORDS GET /ventas/consulta/.
app.get('/api/sales', requireRole(['Administrador', 'Ventas']), async (_req, res) => {
  if (demoMode) return res.json(demoSales);
  try { return res.json(await getOrdsItems('ventas/consulta')); }
  catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ one sale: GET /api/sales/:id proxies ORDS GET /ventas/consulta/:id/.
app.get('/api/sales/:id', requireRole(['Administrador', 'Ventas']), async (req, res) => {
  const saleId = Number(req.params.id);
  if (!Number.isInteger(saleId) || saleId <= 0) return res.status(400).json({ error: 'ID de venta inválido' });
  if (demoMode) {
    const sale = demoSales.find(item => item.id === saleId);
    return sale ? res.json(sale) : res.status(404).json({ error: 'Venta no encontrada' });
  }
  try {
    const payload = await getOrdsCollection(`${ordsBaseUrl}ventas/consulta/${saleId}/`);
    const sale = singleCollectionItem(payload);
    if (!sale || !Object.keys(sale).length) return res.status(404).json({ error: 'Venta no encontrada' });
    return res.json(sale);
  } catch (error) { return res.status(502).json({ error: error.message }); }
});

// READ audit history: GET /api/audit proxies ORDS GET /auditoria/.
app.get('/api/audit', requireRole(['Administrador']), async (_req, res) => {
  if (demoMode) return res.json(demoAudit);
  try { return res.json(await getOrdsItems('auditoria')); }
  catch (error) { return res.status(502).json({ error: error.message }); }
});

// Support Catalogs (Customers, Providers, Inventory Options)
app.get('/api/catalogs', requireRole(['Administrador', 'Ventas', 'Almacen']), async (_req, res) => {
  if (demoMode) return res.json({ customers: demoCustomers, providers: demoProviders, inventory: demoInventory });
  if (ordsInventoryUrl) {
    try {
      const [customers, providers, inventory] = await Promise.all([
        // El POS requiere los datos de contacto completos para validar la venta.
        getOrdsItems('clientes'),
        getOrdsItems('proveedores'),
        getOrdsInventory()
      ]);
      return res.json({ customers, providers, inventory });
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

// CREATE client: POST /api/clients proxies ORDS POST /clientes/.
app.post('/api/clients', requireRole(['Administrador', 'Ventas']), async (req, res) => {
  try {
    const { name, phone, email, address, nit, dpi } = req.body;
    required(name, 'Nombre del cliente');
    if (demoMode) {
      const id = Math.max(0, ...demoCustomers.map(customer => customer.id)) + 1;
      demoCustomers.push({ id, name, phone, email, address, nit, dpi });
      persistDemoData();
      return res.status(201).json({ id });
    }
    if (ordsInventoryUrl && !poolPromise) {
      try {
        const result = await postOrdsResource('clientes', { name, phone, email, address, nit, dpi }, req.user);
        return res.status(201).json(result);
      } catch (error) { return res.status(502).json({ error: error.message }); }
    }
    return res.status(501).json({ error: 'El alta de clientes requiere ORDS.' });
  } catch (error) {
    const isValidation = /obligatorio|inválido|inválida|producto|Agrega|Stock insuficiente|no son válidos/.test(error.message);
    res.status(isValidation ? 400 : 502).json({ error: error.message });
  }
});

// CREATE provider: POST /api/providers registers a supplier for purchases.
app.post('/api/providers', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  try {
    const { name, type, phone, email, address, nit } = req.body || {};
    required(name, 'Nombre del proveedor');
    const providerType = type || 'PARTICULAR';
    if (!['EMPRESA', 'PARTICULAR'].includes(providerType)) throw new Error('Tipo de proveedor inválido');
    if (demoMode) {
      const id = Math.max(0, ...demoProviders.map(provider => provider.id)) + 1;
      demoProviders.push({ id, name, type: providerType, phone, email, address, nit });
      persistDemoData();
      return res.status(201).json({ id, name });
    }
    if (ordsInventoryUrl && !poolPromise) {
      const result = await postOrdsResource('proveedores', { name, type: providerType, phone, email, address, nit }, req.user);
      return res.status(201).json(result);
    }
    if (!poolPromise) return res.status(501).json({ error: oracleUnavailableMessage });
    const id = await transaction(async connection => {
      const result = await connection.execute(
        `INSERT INTO PROVEEDORES (NOMBRE, TIPO_PROVEEDOR, TELEFONO, EMAIL, DIRECCION, NIT)
         VALUES (:name, :type, :phone, :email, :address, :nit)
         RETURNING ID_PROVEEDOR INTO :id`,
        {
          name, type: providerType, phone: phone || null, email: email || null, address: address || null, nit: nit || null,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );
      return result.outBinds.id[0];
    }, req.user);
    return res.status(201).json({ id, name });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// CREATE product: POST /api/inventory forwards product data to ORDS POST /productos/.
app.post('/api/inventory', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  try {
    const { name, brand, model, type, productType, imageUrl, price, cost, stock } = req.body;
    required(name, 'Nombre');
    const itemType = type || 'NEXT_GEN';
    if (Number(price) < 0 || Number(stock) < 0) throw new Error('Datos de inventario inválidos');
    
    if (demoMode) {
      const id = Math.max(...demoInventory.map(item => item.id)) + 1;
      const certificate = `#GS-${2200 + id}`;
      const newItem = {
        id, name, brand: brand || 'Gaming Solutions', model: model || 'GS-CUSTOM',
        type: itemType, productType: productType || 'NUEVO', imageUrl: imageUrl || '', price: Number(price), cost: Number(cost || 0), stock: Number(stock),
        status: Number(stock) === 0 ? 'Agotado' : 'Disponible',
        certificate, hwPct: 100, aestheticPct: 95, thermalPct: 98, warrantyMonths: itemType === 'LAPTOP' ? 18 : itemType === 'RETRO' ? 6 : 12
      };
      demoInventory.unshift(newItem);
      persistDemoData();
      return res.status(201).json({ id, certificate });
    }
    if (ordsInventoryUrl && !poolPromise) {
      const result = await postOrdsResource('productos', { name, brand, model, type: itemType, productType: productType || 'NUEVO', imageUrl: imageUrl || null, price: Number(price), cost: cost ? Number(cost) : null, stock: Number(stock) }, req.user);
      return res.status(201).json(result);
    }
    const id = await transaction(async connection => {
      const result = await connection.execute(
        `INSERT INTO PRODUCTOS (ID_CATEGORIA, NOMBRE, MARCA, MODELO, TIPO_HARDWARE, TIPO_PRODUCTO, IMAGEN_URL, PRECIO_VENTA, PRECIO_COMPRA, STOCK)
         VALUES (1, :name, :brand, :model, :type, :productType, :imageUrl, :price, :cost, :stock) RETURNING ID_PRODUCTO INTO :id`,
        {
          name, brand: brand || '', model: model || '', type: itemType, productType: productType || 'NUEVO', imageUrl: imageUrl || null,
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
    }, req.user);
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// PATCH Update Product
app.patch('/api/inventory/:id', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const { price, stock, name, cost, description, providerId, imageUrl, productType, warrantyMonths } = req.body;
    if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: 'ID de producto inválido' });
    for (const [field, value] of Object.entries({ price, stock, cost })) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
        throw new Error(`${field} debe ser un número no negativo`);
      }
    }
    if (demoMode) {
      const item = demoInventory.find(entry => entry.id === productId);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
      if (name !== undefined) item.name = name;
      if (price !== undefined) item.price = Number(price);
      if (stock !== undefined) item.stock = Number(stock);
      if (cost !== undefined) item.cost = Number(cost);
      if (description !== undefined) item.description = description;
      if (providerId !== undefined) item.providerId = Number(providerId);
      if (imageUrl !== undefined) item.imageUrl = imageUrl;
      if (productType !== undefined) item.productType = productType;
      if (warrantyMonths !== undefined) item.warrantyMonths = Number(warrantyMonths);
      persistDemoData();
      return res.json({ ok: true });
    }
    if (ordsInventoryUrl && !poolPromise) {
      try { return res.json(await postOrdsResource(`productos/${productId}/actualizar`, req.body, req.user)); }
      catch (error) { return res.status(502).json({ error: error.message }); }
    }
    const result = await withConnection(connection => connection.execute(
      `UPDATE PRODUCTOS SET NOMBRE = COALESCE(:name, NOMBRE), PRECIO_VENTA = COALESCE(:price, PRECIO_VENTA), PRECIO_COMPRA = COALESCE(:cost, PRECIO_COMPRA), STOCK = COALESCE(:stock, STOCK), IMAGEN_URL = COALESCE(:imageUrl, IMAGEN_URL), TIPO_PRODUCTO = COALESCE(:productType, TIPO_PRODUCTO), TIEMPO_GARANTIA_MESES = COALESCE(:warrantyMonths, TIEMPO_GARANTIA_MESES) WHERE ID_PRODUCTO = :id`,
      { id: productId, name: name || null, price: price === undefined ? null : Number(price), cost: cost === undefined ? null : Number(cost), stock: stock === undefined ? null : Number(stock), imageUrl: imageUrl || null, productType: productType || null, warrantyMonths: warrantyMonths === undefined ? null : Number(warrantyMonths) }
    ), req.user);
    if (!result.rowsAffected) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

// PUT compatible con integraciones que consumen /api/products/:id.
app.put('/api/products/:id', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  const productId = Number(req.params.id);
  const { name, price, cost, stock, imagen_url, imageUrl, warrantyMonths, tiempo_garantia_meses } = req.body || {};
  const image = imagen_url ?? imageUrl ?? null;
  const warranty = warrantyMonths ?? tiempo_garantia_meses;
  if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: 'ID de producto inválido' });
  try {
    for (const [field, value] of Object.entries({ price, cost, stock, warranty })) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error(`${field} debe ser un número no negativo`);
    }
    if (demoMode) {
      const item = demoInventory.find(entry => entry.id === productId);
      if (!item) return res.status(404).json({ error: 'Producto no encontrado' });
      if (name !== undefined) item.name = name;
      if (price !== undefined) item.price = Number(price);
      if (cost !== undefined) item.cost = Number(cost);
      if (stock !== undefined) item.stock = Number(stock);
      if (image !== null) item.imageUrl = image;
      if (warranty !== undefined) item.warrantyMonths = Number(warranty);
      return res.json({ id: productId, ok: true });
    }
    if (ordsInventoryUrl && !poolPromise) {
      const response = await fetch(`${ordsBaseUrl}productos/${productId}/`, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': ordsUserAgent },
        body: JSON.stringify({ id: productId, nombre: name, precio_venta: price, precio_compra: cost, stock, imagen_url: image, tiempo_garantia_meses: warranty }),
        signal: AbortSignal.timeout(10000)
      });
      const body = await response.text();
      if (!response.ok) return res.status(502).json({ error: `ORDS respondió HTTP ${response.status}: ${body || 'sin detalle'}` });
      return res.json(body ? JSON.parse(body) : { id: productId, ok: true });
    }
    if (!poolPromise) return res.status(501).json({ error: oracleUnavailableMessage });
    const result = await transaction(connection => connection.execute(
      `UPDATE PRODUCTOS SET NOMBRE = NVL(:name, NOMBRE), PRECIO_VENTA = NVL(:price, PRECIO_VENTA), PRECIO_COMPRA = NVL(:cost, PRECIO_COMPRA), STOCK = NVL(:stock, STOCK), IMAGEN_URL = NVL(:image, IMAGEN_URL), TIEMPO_GARANTIA_MESES = NVL(:warranty, TIEMPO_GARANTIA_MESES) WHERE ID_PRODUCTO = :id`,
      { id: productId, name: name || null, price: price === undefined ? null : Number(price), cost: cost === undefined ? null : Number(cost), stock: stock === undefined ? null : Number(stock), image, warranty: warranty === undefined ? null : Number(warranty) }
    ), req.user);
    if (!result.rowsAffected) return res.status(404).json({ error: 'Producto no encontrado' });
    return res.json({ id: productId, ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// DEACTIVATE product: DELETE /api/inventory/:id proxies ORDS POST /productos/:id/desactivar/.
app.delete('/api/inventory/:id', requireRole(['Administrador']), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: 'ID de producto inválido' });
  if (demoMode) {
    const index = demoInventory.findIndex(item => item.id === productId);
    if (index === -1) return res.status(404).json({ error: 'Producto no encontrado' });
    demoInventory.splice(index, 1);
    persistDemoData();
    return res.json({ ok: true });
  }
  if (ordsInventoryUrl && !poolPromise) {
    try { return res.json(await postOrdsResource(`productos/${productId}/desactivar`, {}, req.user)); }
    catch (error) { return res.status(502).json({ error: error.message }); }
  }
  return res.status(501).json({ error: 'La baja lógica requiere ORDS.' });
});

// UPDATE certificate: PATCH /api/inventory/:id/certificate proxies its ORDS POST action.
app.patch('/api/inventory/:id/certificate', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) return res.status(400).json({ error: 'ID de producto inválido' });
  const { hwPct, aestheticPct, thermalPct, pointsReviewed, warrantyMonths, inspectionDetail, technician } = req.body;
  for (const [field, value] of Object.entries({ hwPct, aestheticPct, thermalPct })) {
    if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) {
      return res.status(400).json({ error: `${field} debe estar entre 0 y 100` });
    }
  }
  if (pointsReviewed !== undefined && (!Number.isInteger(Number(pointsReviewed)) || Number(pointsReviewed) < 0)) {
    return res.status(400).json({ error: 'pointsReviewed debe ser un entero no negativo' });
  }
  if (warrantyMonths !== undefined && (!Number.isInteger(Number(warrantyMonths)) || Number(warrantyMonths) < 0)) {
    return res.status(400).json({ error: 'warrantyMonths debe ser un entero no negativo' });
  }
  if (demoMode) {
    const product = demoInventory.find(item => item.id === productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    if (hwPct !== undefined) product.hwPct = Number(hwPct);
    if (aestheticPct !== undefined) product.aestheticPct = Number(aestheticPct);
    if (thermalPct !== undefined) product.thermalPct = Number(thermalPct);
    if (warrantyMonths !== undefined) product.warrantyMonths = Number(warrantyMonths);
    persistDemoData();
    return res.json({ ok: true });
  }
  if (ordsInventoryUrl && !poolPromise) {
    try {
      return res.json(await postOrdsResource(`productos/${productId}/certificado/actualizar`, {
        hwPct, aestheticPct, thermalPct, pointsReviewed, warrantyMonths, inspectionDetail, technician
      }, req.user));
    } catch (error) { return res.status(502).json({ error: error.message }); }
  }
  return res.status(501).json({ error: 'La actualización del certificado requiere ORDS.' });
});

// POST Register Cash / Manual Sale
app.post('/api/sales', requireRole(['Administrador', 'Ventas']), async (req, res) => {
  try {
    const { customerId, payment, items, notes } = req.body;
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
      persistDemoData();
      return res.status(201).json({ id: newId });
    }
    if (ordsInventoryUrl && !poolPromise) {
      // ORDS /ventas/ accepts one product per request, unlike the local array payload.
      if (items.length !== 1) throw new Error('El endpoint ORDS de ventas solo acepta un producto por solicitud');
      const item = items[0];
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
        throw new Error('Los datos del producto de la venta no son válidos');
      }
      const total = Math.round((price * quantity + Number.EPSILON) * 100) / 100;
      try {
        const result = await postOrdsResource('ventas', {
          customerId: Number(customerId), payment, total, productId, quantity, price, notes: notes || null
        }, req.user);
        return res.status(201).json(result);
      } catch (error) {
        return res.status(502).json({ error: error.message });
      }
    }
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
    }, req.user);
    res.status(201).json({ id });
  } catch (error) {
    const isValidation = /obligatorio|inválido|inválida|producto|Agrega|Stock insuficiente|no son válidos/.test(error.message);
    res.status(isValidation ? 400 : 502).json({ error: error.message });
  }
});

// POST Register Purchase from Supplier
app.post('/api/purchases', requireRole(['Administrador', 'Almacen']), async (req, res) => {
  try {
    const { providerId, items, notes } = req.body;
    required(providerId, 'Proveedor');
    if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto');
    const normalizedProviderId = Number(providerId);
    if (!Number.isInteger(normalizedProviderId) || normalizedProviderId <= 0) throw new Error('Proveedor inválido');
    const normalizedItems = items.map(item => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      cost: Number(item.cost)
    }));
    if (normalizedItems.some(item => !Number.isInteger(item.productId) || item.productId <= 0 ||
      !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.cost) || item.cost < 0)) {
      throw new Error('Los productos, cantidades y costos de la compra no son válidos');
    }
    if (demoMode) return res.status(201).json({ id: 2001 });
    if (ordsInventoryUrl && !poolPromise) {
      // ORDS /compras/ accepts one line with flat fields, not the local items array.
      if (normalizedItems.length !== 1) throw new Error('ORDS solo permite un producto por compra');
      const [item] = normalizedItems;
      try {
        const result = await postOrdsResource('compras', {
          providerId: normalizedProviderId,
          productId: item.productId,
          quantity: item.quantity,
          cost: item.cost,
          notes: notes || null
        }, req.user);
        return res.status(201).json(result);
      } catch (error) { return res.status(502).json({ error: error.message }); }
    }
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
    }, req.user);
    res.status(201).json({ id });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

const pageRoutes = {
  '/dashboard': 'index.html',
  '/inventario': 'inventory.html',
  '/catalogo': 'catalog.html',
  '/clientes': 'clients.html',
  '/ventas': 'sales.html',
  '/compras': 'purchases.html',
  '/auditoria': 'audit.html'
};
Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', file)));
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const runtimeMode = demoMode ? 'demo' : ordsInventoryUrl ? 'ORDS' : hasOracleCredentials ? 'Oracle' : 'sin base de datos';
app.listen(port, () => console.log(`Gaming Solutions listo en http://localhost:${port} (${runtimeMode})`));
