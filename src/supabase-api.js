const express = require('express');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const PRODUCT_COLUMNS = `id_producto, nombre, marca, modelo, tipo_hardware, tipo_producto, imagen_url,
  precio_venta, precio_compra, stock, sku, descripcion, id_proveedor, tiempo_garantia_meses,
  certificados_gs(codigo_certificado, hardware_original_pct, estado_estetico_pct,
    rendimiento_termico_pct, meses_garantia, puntos_revisados)`;

const CATEGORY_SLUG = { NEXT_GEN: 'consolas-next-gen', LAPTOP: 'laptops-gamer', RETRO: 'retro-restoration', ACCESORIO: 'accesorios' };

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  console.log("Conectando a Supabase URL:", url ? "URL presente" : "¡URL VACÍA!");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function check({ data, error }) {
  if (error) {
    const wrapped = new Error(error.message || 'Error de Supabase');
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
}

function one(value) { return Array.isArray(value) ? value[0] : value; }

function stockStatus(stock) {
  return stock === 0 ? 'Agotado' : stock <= 3 ? 'Stock bajo' : 'Disponible';
}

function mapProduct(row) {
  const cert = one(row.certificados_gs) || {};
  const stock = Number(row.stock || 0);
  return {
    id: row.id_producto,
    name: row.nombre,
    brand: row.marca,
    model: row.modelo,
    type: row.tipo_hardware,
    productType: row.tipo_producto,
    imageUrl: row.imagen_url || '',
    price: Number(row.precio_venta),
    cost: Number(row.precio_compra),
    stock,
    sku: row.sku || null,
    description: row.descripcion || '',
    providerId: row.id_proveedor,
    status: stockStatus(stock),
    certificate: cert.codigo_certificado || null,
    hwPct: cert.hardware_original_pct ?? null,
    aestheticPct: cert.estado_estetico_pct ?? null,
    thermalPct: cert.rendimiento_termico_pct ?? null,
    warrantyMonths: row.tiempo_garantia_meses ?? cert.meses_garantia ?? null
  };
}

function mapClient(row) {
  return { id: row.id_cliente, name: row.nombre, phone: row.telefono, email: row.email, address: row.direccion, nit: row.nit, dpi: row.dpi };
}

function mapProvider(row) {
  return { id: row.id_proveedor, name: row.nombre, type: row.tipo_proveedor, phone: row.telefono, email: row.email, address: row.direccion, nit: row.nit };
}

function mapSale(row) {
  return {
    id: row.id_venta,
    customer: row.clientes?.nombre || '',
    date: String(row.fecha_venta || '').slice(0, 10),
    payment: row.metodo_pago,
    total: Number(row.total_venta),
    status: row.estado_venta
  };
}

const emptyToNull = value => (value === undefined || value === null || String(value).trim() === '' ? null : value);

function validationError(message) {
  const error = new Error(message);
  error.validation = true;
  return error;
}

function positiveInt(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw validationError(`${field} inválido`);
  return number;
}

function nonNegative(value, field) {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw validationError(`${field} debe ser un número no negativo`);
  return number;
}

function createSupabaseRouter(db, { requireRole }) {
  const router = express.Router();
  const processedRequests = new Map();

  const handle = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (error) {
      const isUnique = error.code === '23505';
      const isValidation = error.validation || error.code === '23514' || /Stock insuficiente|Agrega|no encontrado/i.test(error.message);
      if (!isValidation && !isUnique) console.error('Error Supabase:', error.message);
      res.status(isUnique ? 409 : isValidation ? 400 : 502).json({
        error: isUnique ? 'Ya existe un registro con ese valor único (NIT, DPI o SKU)' : error.message
      });
    }
  };

  async function listProducts() {
    const rows = check(await db.from('productos').select(PRODUCT_COLUMNS).eq('activo', 'S').order('nombre'));
    return rows.map(mapProduct);
  }

  async function listSales(limit) {
    let request = db.from('ventas').select('id_venta, fecha_venta, metodo_pago, total_venta, estado_venta, clientes(nombre)')
      .order('fecha_venta', { ascending: false });
    if (limit) request = request.limit(limit);
    return check(await request).map(mapSale);
  }

  async function metrics() {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [stockRows, sales, customers] = await Promise.all([
      db.from('productos').select('stock').eq('activo', 'S'),
      db.from('ventas').select('total_venta').eq('estado_venta', 'COMPLETADA').gte('fecha_venta', monthStart.toISOString()),
      db.from('clientes').select('id_cliente', { count: 'exact', head: true })
    ]);
    const stocks = check(stockRows).map(row => Number(row.stock));
    if (customers.error) check(customers);
    const inventory = stocks.reduce((sum, value) => sum + value, 0);
    return {
      inventory,
      totalStock: inventory,
      lowStock: stocks.filter(value => value >= 1 && value <= 3).length,
      monthlySales: check(sales).reduce((sum, row) => sum + Number(row.total_venta), 0),
      customers: customers.count || 0
    };
  }

  router.get('/health', handle(async (_req, res) => {
    check(await db.from('roles').select('id_rol').limit(1));
    res.json({ ok: true, mode: 'supabase' });
  }));

  router.get('/dashboard', handle(async (_req, res) => {
    const [inventory, sales, summary] = await Promise.all([listProducts(), listSales(5), metrics()]);
    res.json({ mode: 'supabase', inventory, sales, metrics: summary });
  }));

  router.get('/summary', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (_req, res) => {
    res.json({ ok: true, mode: 'supabase', metrics: await metrics() });
  }));

  router.get('/inventory', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (_req, res) => {
    res.json(await listProducts());
  }));

  router.get('/inventory/:id', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (req, res) => {
    const id = positiveInt(req.params.id, 'ID de producto');
    const row = check(await db.from('productos').select(PRODUCT_COLUMNS).eq('id_producto', id).maybeSingle());
    if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(mapProduct(row));
  }));

  router.get('/providers', requireRole(['Administrador', 'Almacen']), handle(async (_req, res) => {
    res.json(check(await db.from('proveedores').select('*').order('nombre')).map(mapProvider));
  }));

  router.get('/categories', requireRole(['Administrador', 'Almacen']), handle(async (_req, res) => {
    const rows = check(await db.from('categorias').select('id_categoria, nombre, slug, garantia_meses_defecto').order('nombre'));
    res.json(rows.map(row => ({ id: row.id_categoria, name: row.nombre, slug: row.slug, defaultWarrantyMonths: row.garantia_meses_defecto })));
  }));

  router.get('/clients', requireRole(['Administrador', 'Ventas']), handle(async (_req, res) => {
    res.json(check(await db.from('clientes').select('*').order('nombre')).map(mapClient));
  }));

  router.get('/audit', requireRole(['Administrador']), handle(async (_req, res) => {
    const rows = check(await db.from('bitacora_auditoria').select('id_auditoria, tabla_afectada, operacion, fecha_evento, usuario_bd')
      .order('fecha_evento', { ascending: false }).limit(200));
    res.json(rows.map(row => ({ id: row.id_auditoria, operation: row.operacion, table: row.tabla_afectada, timestamp: row.fecha_evento, dbUser: row.usuario_bd })));
  }));

  router.get('/catalogs', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (_req, res) => {
    const [customers, providers, inventory] = await Promise.all([
      db.from('clientes').select('*').order('nombre'),
      db.from('proveedores').select('*').order('nombre'),
      listProducts()
    ]);
    res.json({ customers: check(customers).map(mapClient), providers: check(providers).map(mapProvider), inventory });
  }));

  router.get('/sales', requireRole(['Administrador', 'Ventas']), handle(async (_req, res) => {
    res.json(await listSales());
  }));

  router.get('/sales/:id', requireRole(['Administrador', 'Ventas']), handle(async (req, res) => {
    const id = positiveInt(req.params.id, 'ID de venta');
    const row = check(await db.from('ventas')
      .select('id_venta, fecha_venta, metodo_pago, total_venta, estado_venta, notas_venta, clientes(nombre), ventas_detalle(id_producto, cantidad, precio_unitario, productos(nombre))')
      .eq('id_venta', id).maybeSingle());
    if (!row) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json({
      ...mapSale(row),
      notes: row.notas_venta,
      items: (row.ventas_detalle || []).map(line => ({
        productId: line.id_producto, name: line.productos?.nombre, quantity: line.cantidad, price: Number(line.precio_unitario)
      }))
    });
  }));

  router.post('/clients', requireRole(['Administrador', 'Ventas']), handle(async (req, res) => {
    const { name, phone, email, address, nit, dpi } = req.body || {};
    if (!name) throw validationError('Nombre del cliente es obligatorio');
    const row = check(await db.from('clientes').insert({
      nombre: name, telefono: emptyToNull(phone), email: emptyToNull(email), direccion: emptyToNull(address), nit: emptyToNull(nit), dpi: emptyToNull(dpi)
    }).select('id_cliente').single());
    res.status(201).json({ id: row.id_cliente });
  }));

  router.post('/providers', requireRole(['Administrador', 'Almacen']), handle(async (req, res) => {
    const { name, type, phone, email, address, nit } = req.body || {};
    if (!name) throw validationError('Nombre del proveedor es obligatorio');
    const providerType = type || 'PARTICULAR';
    if (!['EMPRESA', 'PARTICULAR'].includes(providerType)) throw validationError('Tipo de proveedor inválido');
    const row = check(await db.from('proveedores').insert({
      nombre: name, tipo_proveedor: providerType, telefono: emptyToNull(phone), email: emptyToNull(email), direccion: emptyToNull(address), nit: emptyToNull(nit)
    }).select('id_proveedor').single());
    res.status(201).json({ id: row.id_proveedor, name });
  }));

  router.post('/inventory', requireRole(['Administrador', 'Almacen']), handle(async (req, res) => {
    const { name, brand, model, type, productType, imageUrl, price, cost, stock, description, providerId } = req.body || {};
    if (!name) throw validationError('Nombre es obligatorio');
    const itemType = type || 'NEXT_GEN';
    const salePrice = nonNegative(price, 'price');
    const initialStock = nonNegative(stock ?? 0, 'stock');
    if (salePrice === undefined) throw validationError('Precio es obligatorio');
    const category = check(await db.from('categorias').select('id_categoria').eq('slug', CATEGORY_SLUG[itemType] || CATEGORY_SLUG.NEXT_GEN).maybeSingle());
    if (!category) throw validationError('Categoría no encontrada; ejecuta sql/10_supabase_schema.sql');
    const row = check(await db.from('productos').insert({
      id_categoria: category.id_categoria,
      id_proveedor: providerId ? Number(providerId) : null,
      nombre: name, marca: brand || '', modelo: model || '', tipo_hardware: itemType,
      tipo_producto: productType || 'NUEVO', imagen_url: emptyToNull(imageUrl),
      precio_venta: salePrice, precio_compra: nonNegative(cost, 'cost') ?? 0, stock: initialStock,
      descripcion: emptyToNull(description)
    }).select('id_producto').single());
    const cert = check(await db.from('certificados_gs').select('codigo_certificado').eq('id_producto', row.id_producto).maybeSingle());
    res.status(201).json({ id: row.id_producto, certificate: cert?.codigo_certificado || null });
  }));

  async function updateProduct(req, res) {
    const id = positiveInt(req.params.id, 'ID de producto');
    const body = req.body || {};
    const image = body.imagen_url ?? body.imageUrl;
    const warranty = body.warrantyMonths ?? body.tiempo_garantia_meses;
    const changes = {};
    if (body.name) changes.nombre = body.name;
    if (body.price !== undefined) changes.precio_venta = nonNegative(body.price, 'price');
    if (body.cost !== undefined) changes.precio_compra = nonNegative(body.cost, 'cost');
    if (body.stock !== undefined) changes.stock = nonNegative(body.stock, 'stock');
    if (image !== undefined && image !== null) changes.imagen_url = emptyToNull(image);
    if (body.productType) changes.tipo_producto = body.productType;
    if (body.description !== undefined) changes.descripcion = emptyToNull(body.description);
    if (body.providerId !== undefined) changes.id_proveedor = body.providerId ? Number(body.providerId) : null;
    if (warranty !== undefined) changes.tiempo_garantia_meses = nonNegative(warranty, 'warrantyMonths');
    if (!Object.keys(changes).length) return res.json({ id, ok: true });
    const rows = check(await db.from('productos').update(changes).eq('id_producto', id).select('id_producto'));
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ id, ok: true });
  }
  router.patch('/inventory/:id', requireRole(['Administrador', 'Almacen']), handle(updateProduct));
  router.put('/products/:id', requireRole(['Administrador', 'Almacen']), handle(updateProduct));

  router.delete('/inventory/:id', requireRole(['Administrador']), handle(async (req, res) => {
    const id = positiveInt(req.params.id, 'ID de producto');
    const rows = check(await db.from('productos').update({ activo: 'N' }).eq('id_producto', id).select('id_producto'));
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ ok: true });
  }));

  router.patch('/inventory/:id/certificate', requireRole(['Administrador', 'Almacen']), handle(async (req, res) => {
    const id = positiveInt(req.params.id, 'ID de producto');
    const { hwPct, aestheticPct, thermalPct, pointsReviewed, warrantyMonths, inspectionDetail, technician } = req.body || {};
    for (const [field, value] of Object.entries({ hwPct, aestheticPct, thermalPct })) {
      if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) throw validationError(`${field} debe estar entre 0 y 100`);
    }
    for (const [field, value] of Object.entries({ pointsReviewed, warrantyMonths })) {
      if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < 0)) throw validationError(`${field} debe ser un entero no negativo`);
    }
    const changes = {};
    if (hwPct !== undefined) changes.hardware_original_pct = Number(hwPct);
    if (aestheticPct !== undefined) changes.estado_estetico_pct = Number(aestheticPct);
    if (thermalPct !== undefined) changes.rendimiento_termico_pct = Number(thermalPct);
    if (pointsReviewed !== undefined) changes.puntos_revisados = Number(pointsReviewed);
    if (warrantyMonths !== undefined) changes.meses_garantia = Number(warrantyMonths);
    if (inspectionDetail !== undefined) changes.detalle_inspeccion = inspectionDetail;
    if (technician) changes.tecnico_responsable = technician;
    if (!Object.keys(changes).length) return res.json({ ok: true });
    changes.fecha_inspeccion = new Date().toISOString();
    const rows = check(await db.from('certificados_gs').update(changes).eq('id_producto', id).select('id_certificado'));
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    if (warrantyMonths !== undefined) check(await db.from('productos').update({ tiempo_garantia_meses: Number(warrantyMonths) }).eq('id_producto', id));
    res.json({ ok: true });
  }));

  router.post('/sales', requireRole(['Administrador', 'Ventas']), handle(async (req, res) => {
    const { customerId, payment, items, notes } = req.body || {};
    const clientId = positiveInt(customerId, 'Cliente');
    if (!['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'].includes(payment)) throw validationError('Método de pago inválido');
    const lines = normalizeLines(items, 'price');
    const key = req.get('Idempotency-Key');
    const cacheKey = key && key.length <= 120 ? `${req.user.id_usuario}:${key}` : null;
    if (cacheKey && processedRequests.has(cacheKey)) return res.status(200).json(processedRequests.get(cacheKey));

    const customer = check(await db.from('clientes').select('nit, dpi, telefono, direccion').eq('id_cliente', clientId).maybeSingle());
    if (!customer || !((customer.nit || customer.dpi) && customer.telefono && customer.direccion)) {
      throw validationError('El cliente seleccionado debe tener datos completos (NIT/DPI, Teléfono y Dirección) para realizar la compra.');
    }
    const id = check(await db.rpc('registrar_venta', {
      p_id_cliente: clientId, p_metodo_pago: payment, p_notas: emptyToNull(notes), p_usuario: req.user.nombre || String(req.user.id_usuario), p_items: lines
    }));
    const result = { id };
    if (cacheKey) processedRequests.set(cacheKey, result);
    res.status(201).json(result);
  }));

  router.post('/purchases', requireRole(['Administrador', 'Almacen']), handle(async (req, res) => {
    const { providerId, items, notes } = req.body || {};
    const supplierId = positiveInt(providerId, 'Proveedor');
    const lines = normalizeLines(items, 'cost');
    const id = check(await db.rpc('registrar_compra', {
      p_id_proveedor: supplierId, p_notas: emptyToNull(notes), p_usuario: req.user.nombre || String(req.user.id_usuario), p_items: lines
    }));
    res.status(201).json({ id });
  }));

  router.get('/mobile/dashboard', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (_req, res) => {
    const [inventory, sales, summary] = await Promise.all([listProducts(), listSales(5), metrics()]);
    res.json({
      metrics: { inventory: summary.inventory, lowStock: inventory.filter(item => item.stock < 5).length, monthlySales: summary.monthlySales },
      inventory: inventory.map(item => ({
        id: item.id, name: item.name, sku: item.sku, certificate: item.certificate, stock: item.stock, price: item.price,
        status: item.stock === 0 ? 'Agotado' : item.stock < 5 ? 'Stock bajo' : 'Disponible'
      })),
      recentSales: sales.map(sale => ({ id: sale.id, total: sale.total, payment: sale.payment, date: sale.date }))
    });
  }));

  router.get('/mobile/scan/:code', requireRole(['Administrador', 'Ventas', 'Almacen']), handle(async (req, res) => {
    const code = decodeURIComponent(String(req.params.code || '')).trim();
    if (!code || code.length > 120) throw validationError('Código de escaneo inválido');
    const products = await listProducts();
    const lower = code.toLowerCase();
    const product = products.find(item => String(item.id) === code ||
      String(item.certificate || '').toLowerCase() === lower || String(item.sku || '').toLowerCase() === lower);
    if (!product) return res.status(404).json({ error: 'Producto o certificado no encontrado' });
    res.json({ product });
  }));

  return router;
}

function normalizeLines(items, priceField) {
  if (!Array.isArray(items) || !items.length) throw validationError('Agrega al menos un producto');
  return items.map(item => {
    const productId = Number(item.id_producto ?? item.productId);
    const quantity = Number(item.cantidad ?? item.quantity);
    const amount = Number(item.precio_unitario ?? item[priceField] ?? item.price ?? item.cost);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(amount) || amount < 0) {
      throw validationError('Los productos, cantidades y precios no son válidos');
    }
    return { productId, quantity, [priceField]: amount };
  });
}

// Login contra la tabla usuarios; ADMIN_USERNAME/ADMIN_PASSWORD sirve de respaldo.
function createSupabaseLogin(db) {
  return async function loginViaSupabase(username, password) {
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD &&
        username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      return { id_usuario: 1, nombre: 'Administrador', rol: 'Administrador' };
    }
    const rows = check(await db.from('usuarios').select('id_usuario, nombre_completo, clave_hash, roles(nombre_rol)')
      .ilike('username', username.replace(/[%_\\]/g, '\\$&')).eq('activo', 'S').limit(1));
    const user = rows[0];
    if (!user || !user.clave_hash || !(await bcrypt.compare(password, user.clave_hash))) return null;
    return { id_usuario: user.id_usuario, nombre: user.nombre_completo, rol: one(user.roles)?.nombre_rol, passwordHash: user.clave_hash };
  };
}

module.exports = { createSupabaseClient, createSupabaseRouter, createSupabaseLogin };
