const express = require('express');
const oracledb = require('oracledb');
const { requireRole } = require('../middleware/auth');

const processedRequests = new Map();

function createSalesRouter({ demoMode, demoSales, demoCustomers, demoInventory, poolPromise, transaction, postOrdsResource, query }) {
  const router = express.Router();

  router.post('/', requireRole(['Administrador', 'Ventas']), async (req, res) => {
    try {
      const { customerId, payment, items, notes } = req.body || {};
      const normalizedCustomerId = Number(customerId);
      if (!Number.isInteger(normalizedCustomerId) || normalizedCustomerId <= 0) throw new Error('Cliente inválido');
      const customer = demoCustomers.find(item => item.id === normalizedCustomerId);
      if (customer && !((customer.nit || customer.dpi) && customer.phone && customer.address)) {
        throw new Error('El cliente seleccionado debe tener datos completos (NIT/DPI, Teléfono y Dirección) para realizar la compra.');
      }
      if (!demoMode && poolPromise && query) {
        const rows = await query('SELECT NIT AS "nit", DPI AS "dpi", TELEFONO AS "phone", DIRECCION AS "address" FROM CLIENTES WHERE ID_CLIENTE = :id', { id: normalizedCustomerId });
        const databaseCustomer = rows[0];
        if (!databaseCustomer || !((databaseCustomer.nit || databaseCustomer.dpi) && databaseCustomer.phone && databaseCustomer.address)) {
          throw new Error('El cliente seleccionado debe tener datos completos (NIT/DPI, Teléfono y Dirección) para realizar la compra.');
        }
      }
      if (!['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'].includes(payment)) throw new Error('Método de pago inválido');
      const normalizedItems = normalizeItems(items);
      const requestKey = idempotencyKey(req);
      if (requestKey && processedRequests.has(requestKey)) return res.status(200).json(processedRequests.get(requestKey));

      if (demoMode) {
        const byId = new Map(demoInventory.map(item => [item.id, item]));
        normalizedItems.forEach(item => {
          const product = byId.get(item.productId);
          if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
          if (product.stock < item.quantity) throw new Error(`Stock insuficiente para ${product.name}`);
        });
        normalizedItems.forEach(item => {
          const product = byId.get(item.productId);
          product.stock -= item.quantity;
          product.status = product.stock === 0 ? 'Agotado' : product.stock <= 3 ? 'Stock bajo' : 'Disponible';
        });
        const result = {
          id: 1049 + demoSales.length,
          total: totalOf(normalizedItems),
          message: 'Venta registrada correctamente'
        };
        demoSales.unshift({
          id: result.id,
          customer: demoCustomers.find(customer => customer.id === normalizedCustomerId)?.name || 'Cliente',
          date: new Date().toISOString().slice(0, 10),
          total: result.total,
          payment,
          status: 'COMPLETADA',
          notes
        });
        if (requestKey) processedRequests.set(requestKey, result);
        return res.status(201).json(result);
      }

      if (!poolPromise) {
        if (normalizedItems.length !== 1) {
          return res.status(501).json({ error: 'Las ventas multi-línea requieren conexión Oracle transaccional.' });
        }
        const item = normalizedItems[0];
        const result = await postOrdsResource('ventas', {
          customerId: normalizedCustomerId,
          payment,
          total: totalOf(normalizedItems),
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          notes: notes || null
        }, req.user);
        return res.status(201).json(result);
      }

      const result = await transaction(async connection => {
        const ids = normalizedItems.map(item => item.productId).sort((a, b) => a - b);
        const rows = await connection.execute(
          `SELECT ID_PRODUCTO AS "id", NOMBRE AS "name", STOCK AS "stock"
             FROM PRODUCTOS
            WHERE ACTIVO = 'S' AND ID_PRODUCTO IN (${ids.map((_, index) => `:id${index}`).join(',')})
            ORDER BY ID_PRODUCTO
            FOR UPDATE`,
          Object.fromEntries(ids.map((id, index) => [`id${index}`, id]))
        );
        const products = new Map(rows.rows.map(row => [Number(row.id), row]));
        normalizedItems.forEach(item => {
          const product = products.get(item.productId);
          if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
          if (Number(product.stock) < item.quantity) throw new Error(`Stock insuficiente para ${product.name}`);
        });
        const header = await connection.execute(
          `INSERT INTO VENTAS (ID_CLIENTE, METODO_PAGO, TOTAL_VENTA, NOTAS_VENTA, USUARIO_REGISTRO)
           VALUES (:customerId, :payment, :total, :notes, :operator)
           RETURNING ID_VENTA INTO :id`,
          {
            customerId: normalizedCustomerId,
            payment,
            total: totalOf(normalizedItems),
            notes: notes || null,
            operator: String(req.user.id_usuario),
            id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          }
        );
        const saleId = header.outBinds.id[0];
        for (const item of normalizedItems) {
          await connection.execute(
            `UPDATE PRODUCTOS SET STOCK = STOCK - :quantity WHERE ID_PRODUCTO = :productId`,
            { quantity: item.quantity, productId: item.productId }
          );
          await connection.execute(
            `INSERT INTO VENTAS_DETALLE (ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO)
             VALUES (:saleId, :productId, :quantity, :price)`,
            { saleId, productId: item.productId, quantity: item.quantity, price: item.price }
          );
        }
        return { id: saleId, total: totalOf(normalizedItems), message: 'Venta registrada correctamente' };
      }, req.user);
      if (requestKey) processedRequests.set(requestKey, result);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(error.message.startsWith('Stock insuficiente') ? 400 : 400).json({ error: error.message });
    }
  });

  return router;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Agrega al menos un producto');
  const normalized = items.map(item => ({
    productId: Number(item.id_producto ?? item.productId),
    quantity: Number(item.cantidad ?? item.quantity),
    price: Number(item.precio_unitario ?? item.price)
  }));
  if (normalized.some(item => !Number.isInteger(item.productId) || item.productId <= 0 ||
    !Number.isInteger(item.quantity) || item.quantity <= 0 ||
    !Number.isFinite(item.price) || item.price < 0)) {
    throw new Error('Cada producto debe tener id_producto, cantidad y precio_unitario válidos');
  }
  const grouped = new Map();
  normalized.forEach(item => {
    const current = grouped.get(item.productId);
    grouped.set(item.productId, current
      ? { ...current, quantity: current.quantity + item.quantity }
      : item);
  });
  return [...grouped.values()];
}

function totalOf(items) {
  return Math.round((items.reduce((total, item) => total + item.quantity * item.price, 0) + Number.EPSILON) * 100) / 100;
}

function idempotencyKey(req) {
  const key = req.get('Idempotency-Key');
  return key && key.length <= 120 ? `${req.user.id_usuario}:${key}` : null;
}

module.exports = { createSalesRouter };
