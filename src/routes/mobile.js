const express = require('express');
const { requireRole } = require('../middleware/auth');

function createMobileRouter({
  demoMode,
  demoInventory,
  demoSales,
  poolPromise,
  query,
  getOrdsCollection,
  getOrdsInventory,
  normalizeOrdsItem,
  ordsBaseUrl
}) {
  const router = express.Router();

  router.get('/dashboard', requireRole(['Administrador', 'Ventas', 'Almacen']), async (_req, res) => {
    try {
      if (demoMode) {
        return res.json(compactDashboard(demoInventory, demoSales));
      }
      if (getOrdsInventory && !poolPromise) {
        const [inventory, dashboard] = await Promise.all([
          getOrdsInventory(),
          getOrdsCollection(`${ordsBaseUrl}dashboard/`)
        ]);
        return res.json({
          inventory: compactInventory(inventory),
          metrics: dashboard.metrics || {}
        });
      }
      const [inventory, metrics, sales] = await Promise.all([
        query(`SELECT ID_PRODUCTO AS "id", NOMBRE AS "name", STOCK AS "stock",
                       PRECIO_VENTA AS "price", SKU AS "sku"
                  FROM PRODUCTOS
                 WHERE ACTIVO = 'S'
                 ORDER BY STOCK, NOMBRE`),
        query(`SELECT NVL(SUM(STOCK), 0) AS "inventory",
                       (SELECT COUNT(*) FROM PRODUCTOS WHERE ACTIVO = 'S' AND STOCK < 5) AS "lowStock",
                       (SELECT NVL(SUM(TOTAL_VENTA), 0) FROM VENTAS
                         WHERE ESTADO_VENTA = 'COMPLETADA'
                           AND FECHA_VENTA >= TRUNC(SYSDATE, 'MM')) AS "monthlySales"
                  FROM PRODUCTOS
                 WHERE ACTIVO = 'S'`),
        query(`SELECT ID_VENTA AS "id", TOTAL_VENTA AS "total", METODO_PAGO AS "payment",
                       FECHA_VENTA AS "date"
                  FROM VENTAS
                 WHERE ESTADO_VENTA = 'COMPLETADA'
                 ORDER BY FECHA_VENTA DESC FETCH FIRST 5 ROWS ONLY`)
      ]);
      return res.json({
        inventory: compactInventory(inventory),
        metrics: metrics[0] || {},
        recentSales: sales
      });
    } catch (error) {
      console.error('Error en dashboard móvil:', error);
      return res.status(502).json({ error: 'No se pudo cargar el dashboard móvil' });
    }
  });

  router.get('/scan/:code', requireRole(['Administrador', 'Ventas', 'Almacen']), async (req, res) => {
    const code = decodeURIComponent(String(req.params.code || '')).trim();
    if (!code || code.length > 120) return res.status(400).json({ error: 'Código de escaneo inválido' });
    try {
      if (demoMode) {
        const product = demoInventory.find(item => String(item.id) === code ||
          String(item.certificate || '').toLowerCase() === code.toLowerCase());
        return product ? res.json({ product }) : res.status(404).json({ error: 'Producto o certificado no encontrado' });
      }
      const numericId = /^\d+$/.test(code) ? Number(code) : null;
      if (numericId && getOrdsCollection) {
        const payload = await getOrdsCollection(`${ordsBaseUrl}productos/${numericId}/`);
        const item = firstItem(payload);
        return item ? res.json({ product: normalizeOrdsItem(item) }) : res.status(404).json({ error: 'Producto no encontrado' });
      }
      if (!poolPromise && getOrdsInventory) {
        const item = (await getOrdsInventory()).find(product =>
          String(product.certificate || '').toLowerCase() === code.toLowerCase() ||
          String(product.sku || '').toLowerCase() === code.toLowerCase());
        return item ? res.json({ product: item }) : res.status(404).json({ error: 'Certificado no encontrado' });
      }
      const rows = await query(
        `SELECT p.ID_PRODUCTO AS "id", p.NOMBRE AS "name", p.SKU AS "sku",
                p.MARCA AS "brand", p.MODELO AS "model", p.STOCK AS "stock",
                p.PRECIO_VENTA AS "price", cert.CODIGO_CERTIFICADO AS "certificate",
                cert.HARDWARE_ORIGINAL_PCT AS "hwPct",
                cert.ESTADO_ESTETICO_PCT AS "aestheticPct",
                cert.RENDIMIENTO_TERMICO_PCT AS "thermalPct",
                cert.MESES_GARANTIA AS "warrantyMonths"
           FROM PRODUCTOS p
           LEFT JOIN CERTIFICADOS_GS cert ON cert.ID_PRODUCTO = p.ID_PRODUCTO
          WHERE p.ACTIVO = 'S'
            AND (p.SKU = :code OR cert.CODIGO_CERTIFICADO = :code
                 OR TO_CHAR(p.ID_PRODUCTO) = :code)`,
        { code }
      );
      return rows[0] ? res.json({ product: rows[0] }) : res.status(404).json({ error: 'Producto o certificado no encontrado' });
    } catch (error) {
      console.error('Error escaneando producto:', error);
      return res.status(502).json({ error: 'No se pudo consultar el código escaneado' });
    }
  });

  return router;
}

function compactDashboard(inventory, sales) {
  return {
    metrics: {
      inventory: inventory.reduce((sum, item) => sum + Number(item.stock || 0), 0),
      lowStock: inventory.filter(item => Number(item.stock) < 5).length,
      monthlySales: sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
    },
    inventory: compactInventory(inventory),
    recentSales: sales.slice(0, 5).map(sale => ({
      id: sale.id,
      total: sale.total,
      payment: sale.payment,
      date: sale.date
    }))
  };
}

function compactInventory(items) {
  return items.map(item => ({
    id: Number(item.id),
    name: item.name,
    sku: item.sku || null,
    certificate: item.certificate || null,
    stock: Number(item.stock || 0),
    price: Number(item.price || 0),
    status: Number(item.stock || 0) === 0 ? 'Agotado' : Number(item.stock) < 5 ? 'Stock bajo' : 'Disponible'
  }));
}

function firstItem(payload) {
  if (Array.isArray(payload)) return payload[0];
  if (Array.isArray(payload?.items)) return payload.items[0];
  return payload;
}

module.exports = { createMobileRouter };
