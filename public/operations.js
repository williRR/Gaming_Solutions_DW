const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
let catalogs = { customers: [], providers: [], inventory: [] };
let lastSale = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function renderCartBadge() {
  const quantity = Number(document.querySelector('[data-form="sale"] [name="quantity"]')?.value || 0);
  const badge = document.querySelector('[data-cart-count]');
  if (badge) badge.textContent = quantity;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`);
  return data;
}

function fillSelect(selector, items, label) {
  const select = document.querySelector(selector);
  if (!select) return;
  select.innerHTML = items.length
    ? items.map(item => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join('')
    : '<option value="">Sin registros disponibles</option>';
}

function renderSales(items) {
  const list = document.querySelector('#salesList');
  if (!list) return;
  list.innerHTML = items.length
    ? items.map(sale => `<div class="sale"><div class="sale-info"><span class="sale-name">${escapeHtml(sale.customer || 'Cliente')}</span><span class="sale-date">Venta #${escapeHtml(sale.id)} · ${escapeHtml(sale.date)}</span></div><div class="sale-meta"><strong class="sale-total">${money.format(Number(sale.total) || 0)}</strong><span class="sale-payment">${escapeHtml(sale.payment)}</span></div></div>`).join('')
    : '<div class="empty-state">No hay ventas registradas.</div>';
}

function updateTotals() {
  const saleProduct = catalogs.inventory.find(item => item.id === Number(document.querySelector('#saleProduct')?.value));
  const saleQuantity = Number(document.querySelector('[data-form="sale"] [name="quantity"]')?.value) || 0;
  const saleTotal = document.querySelector('#saleTotal');
  if (saleTotal) saleTotal.textContent = money.format((Number(saleProduct?.price) || 0) * saleQuantity);
  const purchaseQuantity = Number(document.querySelector('[data-form="purchase"] [name="quantity"]')?.value) || 0;
  const purchaseCost = Number(document.querySelector('[data-form="purchase"] [name="cost"]')?.value) || 0;
  const purchaseTotal = document.querySelector('#purchaseTotal');
  if (purchaseTotal) purchaseTotal.textContent = money.format(purchaseQuantity * purchaseCost);
}

async function loadData() {
  const [catalogResult, salesResult] = await Promise.allSettled([apiRequest('/api/catalogs'), apiRequest('/api/sales')]);
  if (catalogResult.status === 'fulfilled') {
    catalogs = catalogResult.value;
    fillSelect('#saleCustomer', catalogs.customers, item => item.name);
    fillSelect('#purchaseProvider', catalogs.providers, item => item.name);
    fillSelect('#saleProduct', catalogs.inventory.filter(item => item.stock > 0), item => `${item.name} · ${money.format(item.price)} · Stock: ${item.stock}`);
    fillSelect('#purchaseProduct', catalogs.inventory, item => item.name);
    updateTotals();
  }
  if (salesResult.status === 'fulfilled') renderSales(salesResult.value);
  document.querySelector('#sidebarStatus').textContent = catalogResult.status === 'fulfilled' ? 'Apex / ORDS Activo' : 'Catálogos no disponibles';
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  let endpoint;
  let payload;
  if (form.dataset.form === 'sale') {
    const product = catalogs.inventory.find(item => item.id === Number(data.productId));
    endpoint = '/api/sales';
    payload = {
      customerId: Number(data.customerId),
      payment: data.payment,
      items: [{ productId: Number(data.productId), quantity: Number(data.quantity), price: Number(product?.price) || 0 }]
    };
  } else {
    endpoint = '/api/purchases';
    payload = {
      providerId: Number(data.providerId),
      items: [{ productId: Number(data.productId), quantity: Number(data.quantity), cost: Number(data.cost) }],
      notes: data.notes.trim() || null
    };
  }
  try {
    const result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });
    if (form.dataset.form === 'sale') {
      lastSale = { ...result, customer: catalogs.customers.find(item => item.id === Number(data.customerId)), product, quantity: Number(data.quantity), payment: data.payment };
      document.querySelector('[data-sale-print]').disabled = false;
    }
    message.textContent = `Operación registrada correctamente (#${result.id})`;
    message.className = 'form-message success';
    form.reset();
    await loadData();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }

  function renderSaleSummary() {
    const customer = catalogs.customers.find(item => item.id === Number(document.querySelector('#saleCustomer')?.value));
    const product = catalogs.inventory.find(item => item.id === Number(document.querySelector('#saleProduct')?.value));
    const quantity = Number(document.querySelector('[data-form="sale"] [name="quantity"]')?.value || 0);
    document.querySelector('#saleSummary').innerHTML = `<p><strong>Cliente:</strong> ${escapeHtml(customer?.name || 'Sin seleccionar')}</p><p><strong>Producto:</strong> ${escapeHtml(product?.name || 'Sin seleccionar')} × ${quantity}</p><p class="operation-total">Total <strong>${money.format((Number(product?.price) || 0) * quantity)}</strong></p>`;
  }

  document.querySelector('.cart-action')?.addEventListener('click', () => {
    renderSaleSummary();
    document.querySelector('#saleSummaryModal')?.classList.add('open');
  });
  document.querySelector('[data-sale-close]')?.addEventListener('click', () => document.querySelector('#saleSummaryModal')?.classList.remove('open'));
  document.querySelector('[data-sale-print]')?.addEventListener('click', () => {
    if (!lastSale) return;
    const item = lastSale.product;
    const inspection = String(item.productType || item.type).toUpperCase() === 'NUEVO'
      ? '<p class="stamp">PRODUCTO NUEVO / GARANTÍA DE FÁBRICA</p>'
      : `<h2>Inspección técnica</h2><ul><li>HW: ${item.hwPct || 100}%</li><li>Estética: ${item.aestheticPct || 95}%</li><li>Térmico: ${item.thermalPct || 98}%</li></ul>`;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    const safe = value => escapeHtml(value);
    popup.document.write(`<html lang="es"><head><title>Certificado de Garantía ${safe(lastSale.id)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;color:#20252b}h1{color:#20252b;border-bottom:4px solid #c8f05a;padding-bottom:14px}.stamp{padding:14px;background:#ecf7d8;font-weight:bold}li{margin:8px 0}</style></head><body><h1>Gaming Solutions - Certificado de Garantía</h1><p><strong>Venta:</strong> #GS-${safe(lastSale.id)} · <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-GT')}</p><p><strong>Cliente:</strong> ${safe(lastSale.customer?.name || 'Cliente')}</p><h2>Producto(s) adquirido(s)</h2><p>${safe(item.name)} × ${lastSale.quantity}</p><p><strong>Tiempo de garantía:</strong> ${Number(item.warrantyMonths || 12)} meses</p>${inspection}<p>Conserve este certificado para solicitar servicio de garantía.</p></body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  });
}

document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', submitForm));
document.querySelectorAll('[data-form] input, [data-form] select').forEach(input => input.addEventListener('input', updateTotals));
document.querySelectorAll('[data-form] input, [data-form] select').forEach(input => input.addEventListener('input', renderCartBadge));
document.querySelector('#refreshOperations')?.addEventListener('click', loadData);
document.querySelector('#openQrScanner')?.addEventListener('click', () => {
  window.location.href = '/?scanner=1#inventory';
});
document.querySelector('#addProvider')?.addEventListener('click', async () => {
  const name = window.prompt('Nombre del nuevo proveedor:');
  if (!name?.trim()) return;
  try {
    const provider = await apiRequest('/api/providers', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), type: 'PARTICULAR' })
    });
    catalogs.providers.push(provider);
    fillSelect('#purchaseProvider', catalogs.providers, item => item.name);
    document.querySelector('#purchaseProvider').value = provider.id;
  } catch (error) {
    document.querySelector('[data-form="purchase"] .form-message').textContent = error.message;
  }
});
document.querySelector('#addProduct')?.addEventListener('click', async () => {
  const name = window.prompt('Nombre del nuevo producto:');
  if (!name?.trim()) return;
  const price = Number(window.prompt('Precio de venta (Q):', '0'));
  if (!Number.isFinite(price) || price < 0) return;
  try {
    const created = await apiRequest('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), type: 'ACCESORIO', price, cost: 0, stock: 0 })
    });
    await loadData();
    document.querySelector('#purchaseProduct').value = created.id;
  } catch (error) {
    document.querySelector('[data-form="purchase"] .form-message').textContent = error.message;
  }
});
renderCartBadge();
loadData();
