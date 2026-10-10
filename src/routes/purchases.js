const express = require('express');
const oracledb = require('oracledb');
const { requireRole } = require('../middleware/auth');

const processedRequests = new Map();

function createPurchasesRouter({ demoMode, demoInventory, poolPromise, transaction, postOrdsResource, persistDemoData }) {
  const router = express.Router();

  router.post('/', requireRole(['Administrador', 'Almacen']), async (req, res) => {
    try {
      const providerId = Number(req.body?.providerId ?? req.body?.id_proveedor);
      if (!Number.isInteger(providerId) || providerId <= 0) throw new Error('Proveedor inválido');
      const items = normalizeItems(req.body?.items);
      const requestKey = idempotencyKey(req);
      if (requestKey && processedRequests.has(requestKey)) return res.status(200).json(processedRequests.get(requestKey));

      if (demoMode) {
        const byId = new Map(demoInventory.map(item => [item.id, item]));
        items.forEach(item => {
          const product = byId.get(item.productId);
          if (!product) throw new Error(`Producto ${item.productId} no encontrado`);
          product.stock += item.quantity;
          product.cost = item.cost;
          product.status = product.stock <= 3 ? 'Stock bajo' : 'Disponible';
        });
        persistDemoData?.();
        const result = { id: 2001 + Date.now() % 1000, total: totalOf(items), message: 'Compra registrada correctamente' };
        if (requestKey) processedRequests.set(requestKey, result);
        return res.status(201).json(result);
      }

      if (!poolPromise) {
        if (items.length !== 1) return res.status(501).json({ error: 'Las compras multi-línea requieren conexión Oracle transaccional.' });
        const item = items[0];
        const result = await postOrdsResource('compras', {
          providerId,
          productId: item.productId,
          quantity: item.quantity,
          cost: item.cost,
          notes: req.body.notes || null
        }, req.user);
        return res.status(201).json(result);
      }

      const result = await transaction(async connection => {
        const header = await connection.execute(
          `INSERT INTO COMPRAS (ID_PROVEEDOR, TOTAL_COMPRA, OBSERVACIONES, USUARIO_REGISTRO)
           VALUES (:providerId, :total, :notes, :operator)
           RETURNING ID_COMPRA INTO :id`,
          {
            providerId,
            total: totalOf(items),
            notes: req.body.notes || null,
            operator: String(req.user.id_usuario),
            id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
          }
        );
        const purchaseId = header.outBinds.id[0];
        for (const item of items) {
          const product = await connection.execute(
            `UPDATE PRODUCTOS
                SET STOCK = STOCK + :quantity, PRECIO_COMPRA = :cost
              WHERE ID_PRODUCTO = :productId
            RETURNING ID_PRODUCTO INTO :updated`,
            {
              quantity: item.quantity,
              cost: item.cost,
              productId: item.productId,
              updated: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
            }
          );
          if (!product.rowsAffected) throw new Error(`Producto ${item.productId} no encontrado`);
          await connection.execute(
            `INSERT INTO COMPRAS_DETALLE (ID_COMPRA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO)
             VALUES (:purchaseId, :productId, :quantity, :cost)`,
            { purchaseId, productId: item.productId, quantity: item.quantity, cost: item.cost }
          );
        }
        return { id: purchaseId, total: totalOf(items), message: 'Compra registrada correctamente' };
      }, req.user);
      if (requestKey) processedRequests.set(requestKey, result);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  return router;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Agrega al menos un producto');
  const normalized = items.map(item => ({
    productId: Number(item.id_producto ?? item.productId),
    quantity: Number(item.cantidad ?? item.quantity),
    cost: Number(item.precio_compra ?? item.cost)
  }));
  if (normalized.some(item => !Number.isInteger(item.productId) || item.productId <= 0 ||
    !Number.isInteger(item.quantity) || item.quantity <= 0 ||
    !Number.isFinite(item.cost) || item.cost < 0)) {
    throw new Error('Cada producto debe tener id_producto, cantidad y precio_compra válidos');
  }
  return normalized;
}

function totalOf(items) {
  return Math.round((items.reduce((total, item) => total + item.quantity * item.cost, 0) + Number.EPSILON) * 100) / 100;
}

function idempotencyKey(req) {
  const key = req.get('Idempotency-Key');
  return key && key.length <= 120 ? `${req.user.id_usuario}:${key}` : null;
}

module.exports = { createPurchasesRouter };
