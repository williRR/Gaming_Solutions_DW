const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
let catalogs = { customers: [], providers: [], inventory: [] };
let lastSale = null;
const completeCustomerMessage = 'El cliente seleccionado debe tener datos completos (NIT/DPI, Teléfono y Dirección) para realizar la compra.';

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

function customerIsComplete(customer) {
  return Boolean(customer && (customer.nit || customer.dpi) && customer.phone && customer.address);
}

function updateSaleEligibility() {
  const select = document.querySelector('#saleCustomer');
  const button = document.querySelector('#chargeSale');
  const warning = document.querySelector('#saleCustomerWarning');
  const customer = catalogs.customers.find(item => item.id === Number(select?.value));
  const complete = customerIsComplete(customer);
  if (button) button.disabled = !complete;
  if (warning) warning.textContent = customer && !complete ? completeCustomerMessage : '';
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
    updateSaleEligibility();
  }
  if (salesResult.status === 'fulfilled') renderSales(salesResult.value);
  document.querySelector('#sidebarStatus').textContent = catalogResult.status === 'fulfilled' ? 'Apex / ORDS Activo' : 'Catálogos no disponibles';
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  const selectedProduct = catalogs.inventory.find(item => item.id === Number(data.productId));
  const selectedCustomer = catalogs.customers.find(item => item.id === Number(data.customerId));
  if (form.dataset.form === 'sale' && !customerIsComplete(selectedCustomer)) {
    updateSaleEligibility();
    return;
  }
  let endpoint;
  let payload;
  if (form.dataset.form === 'sale') {
    endpoint = '/api/sales';
    payload = {
      customerId: Number(data.customerId),
      payment: data.payment,
      items: [{ productId: Number(data.productId), quantity: Number(data.quantity), price: Number(selectedProduct?.price) || 0 }]
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
      lastSale = { ...result, customer: catalogs.customers.find(item => item.id === Number(data.customerId)), product: selectedProduct, quantity: Number(data.quantity), payment: data.payment };
      document.querySelector('[data-sale-print]').disabled = false;
      renderGuarantee();
      document.querySelector('#saleSummaryModal')?.classList.add('open');
    }
    message.textContent = `Operación registrada correctamente (#${result.id})`;
    message.className = 'form-message success';
    form.reset();
    await loadData();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }

}

function renderSaleSummary() {
  const customer = catalogs.customers.find(item => item.id === Number(document.querySelector('#saleCustomer')?.value));
  const product = catalogs.inventory.find(item => item.id === Number(document.querySelector('#saleProduct')?.value));
  const quantity = Number(document.querySelector('[data-form="sale"] [name="quantity"]')?.value || 0);
  document.querySelector('#saleSummary').innerHTML = `<p><strong>Cliente:</strong> ${escapeHtml(customer?.name || 'Sin seleccionar')}</p><p><strong>Producto:</strong> ${escapeHtml(product?.name || 'Sin seleccionar')} × ${quantity}</p><p class="operation-total">Total <strong>${money.format((Number(product?.price) || 0) * quantity)}</strong></p>`;
}

function renderGuarantee() {
  if (!lastSale) return;
  const customer = lastSale.customer || {};
  const item = lastSale.product || {};
  const documentId = customer.nit || customer.dpi || 'Sin documento';
  const inspection = String(item.productType || item.type).toUpperCase() === 'NUEVO'
    ? '<p class="guarantee-stamp">PRODUCTO NUEVO / GARANTÍA DE FÁBRICA</p>'
    : `<h4>Inspección técnica</h4><ul><li>HW: ${item.hwPct || 100}%</li><li>Estética: ${item.aestheticPct || 95}%</li><li>Térmico: ${item.thermalPct || 98}%</li></ul>`;
  document.querySelector('#saleSummary').innerHTML = `<div class="guarantee-preview"><h3>Gaming Solutions - Certificado de Garantía</h3><p><strong>Venta:</strong> #GS-${escapeHtml(lastSale.id)} · <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-GT')}</p><p><strong>Cliente:</strong> ${escapeHtml(customer.name)} · <strong>NIT/DPI:</strong> ${escapeHtml(documentId)}</p><p><strong>Producto:</strong> ${escapeHtml(item.name)} × ${lastSale.quantity}</p><p><strong>Garantía:</strong> ${Number(item.warrantyMonths || 12)} meses</p>${inspection}</div>`;
  document.querySelector('[data-sale-print]').textContent = `🖨️ Imprimir Garantía (#GS-${lastSale.id})`;
}

document.querySelector('.cart-action')?.addEventListener('click', () => {
  renderSaleSummary();
  document.querySelector('#saleSummaryModal')?.classList.add('open');
});
document.querySelector('[data-sale-close]')?.addEventListener('click', () => document.querySelector('#saleSummaryModal')?.classList.remove('open'));
document.querySelector('[data-sale-print]')?.addEventListener('click', () => {
  if (!lastSale) return;
  document.body.classList.add('printing-guarantee');
  window.print();
  window.setTimeout(() => document.body.classList.remove('printing-guarantee'), 500);
});

document.querySelector('#saleCustomer')?.addEventListener('change', updateSaleEligibility);
document.querySelector('[data-sale-client-open]')?.addEventListener('click', () => {
  const current = catalogs.customers.find(item => item.id === Number(document.querySelector('#saleCustomer')?.value));
  const form = document.querySelector('[data-sale-client-form]');
  if (current && form) Object.entries(current).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value || ''; });
  document.querySelector('#saleClientModal')?.classList.add('open');
});
document.querySelector('[data-sale-client-close]')?.addEventListener('click', () => document.querySelector('#saleClientModal')?.classList.remove('open'));
document.querySelector('[data-sale-client-form]')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = form.querySelector('.form-message');
  const data = Object.fromEntries(new FormData(form));
  if (!data.nit?.trim() && !data.dpi?.trim()) {
    message.textContent = 'Ingresa NIT o DPI para habilitar la venta.';
    message.className = 'form-message error';
    return;
  }
  try {
    const customer = await apiRequest('/api/clients', { method: 'POST', body: JSON.stringify(data) });
    const selected = { ...data, ...customer, id: Number(customer.id) };
    catalogs.customers.push(selected);
    fillSelect('#saleCustomer', catalogs.customers, item => item.name);
    document.querySelector('#saleCustomer').value = selected.id;
    updateSaleEligibility();
    form.closest('.modal')?.classList.remove('open');
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
});

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
