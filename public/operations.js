const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
let catalogs = { customers: [], providers: [], inventory: [] };

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

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
  select.innerHTML = items.length
    ? items.map(item => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join('')
    : '<option value="">Sin registros disponibles</option>';
}

function renderSales(items) {
  document.querySelector('#salesList').innerHTML = items.length
    ? items.map(sale => `<div class="sale"><div class="sale-info"><span class="sale-name">${escapeHtml(sale.customer || 'Cliente')}</span><span class="sale-date">Venta #${escapeHtml(sale.id)} · ${escapeHtml(sale.date)}</span></div><div class="sale-meta"><strong class="sale-total">${money.format(Number(sale.total) || 0)}</strong><span class="sale-payment">${escapeHtml(sale.payment)}</span></div></div>`).join('')
    : '<div class="empty-state">No hay ventas registradas.</div>';
}

function updateTotals() {
  const saleProduct = catalogs.inventory.find(item => item.id === Number(document.querySelector('#saleProduct').value));
  const saleQuantity = Number(document.querySelector('[data-form="sale"] [name="quantity"]').value) || 0;
  document.querySelector('#saleTotal').textContent = money.format((Number(saleProduct?.price) || 0) * saleQuantity);
  const purchaseQuantity = Number(document.querySelector('[data-form="purchase"] [name="quantity"]').value) || 0;
  const purchaseCost = Number(document.querySelector('[data-form="purchase"] [name="cost"]').value) || 0;
  document.querySelector('#purchaseTotal').textContent = money.format(purchaseQuantity * purchaseCost);
}

async function loadData() {
  const [catalogResult, salesResult] = await Promise.allSettled([apiRequest('/api/catalogs'), apiRequest('/api/sales')]);
  if (catalogResult.status === 'fulfilled') {
    catalogs = catalogResult.value;
    fillSelect('#saleCustomer', catalogs.customers, item => item.name);
    fillSelect('#purchaseProvider', catalogs.providers, item => item.name);
    fillSelect('#saleProduct', catalogs.inventory, item => `${item.name} · ${money.format(item.price)} · Stock: ${item.stock}`);
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
    message.textContent = `Operación registrada correctamente (#${result.id})`;
    message.className = 'form-message success';
    form.reset();
    await loadData();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
}

document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', submitForm));
document.querySelectorAll('[data-form] input, [data-form] select').forEach(input => input.addEventListener('input', updateTotals));
document.querySelector('#refreshOperations').addEventListener('click', loadData);
loadData();
