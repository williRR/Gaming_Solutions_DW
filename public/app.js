const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
let catalogs = { customers: [], providers: [], inventory: [] };

function renderInventory(items) {
  document.querySelector('#inventoryRows').innerHTML = items.slice(0, 6).map(item => `
    <tr><td>${item.name}<br><small>${item.brand || ''} ${item.model || ''}</small></td>
    <td><span class="type ${item.type === 'RETRO' ? 'retro' : ''}">${item.type}</span></td>
    <td>${money.format(item.price)}</td><td class="stock">${item.stock}</td>
    <td><span class="state ${item.stock === 0 ? 'out' : item.stock <= 3 ? 'low' : ''}">${item.status || (item.stock === 0 ? 'Agotado' : 'Disponible')}</span></td><td><button class="edit-button" data-edit="${item.id}">Editar</button></td></tr>`).join('');
}

function renderSales(items) {
  document.querySelector('#salesList').innerHTML = items.map(sale => `
    <div class="sale"><span class="sale-name">${sale.customer}</span><strong class="sale-total">${money.format(sale.total)}</strong><span class="sale-date">#${sale.id} · ${sale.date}</span><span class="sale-payment">${sale.payment}</span></div>`).join('');
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('No se pudo cargar el panel');
  const data = await response.json();
  document.querySelector('#metricInventory').textContent = data.metrics.inventory;
  document.querySelector('#metricSales').textContent = money.format(data.metrics.monthlySales);
  document.querySelector('#metricLowStock').textContent = data.metrics.lowStock;
  document.querySelector('#metricCustomers').textContent = data.metrics.customers;
  document.querySelector('#connectionMode').textContent = data.mode === 'demo' ? 'DEMO' : data.mode === 'ords' ? 'ORDS' : 'ORACLE';
  renderInventory(data.inventory); renderSales(data.sales);
}

async function loadCatalogs() {
  const response = await fetch('/api/catalogs');
  catalogs = await response.json();
  const fill = (selector, items, label = item => item.name) => { document.querySelector(selector).innerHTML = items.map(item => `<option value="${item.id}">${label(item)}</option>`).join(''); };
  fill('#saleCustomer', catalogs.customers);
  fill('#purchaseProvider', catalogs.providers);
  fill('#saleProduct', catalogs.inventory, item => `${item.name} · ${money.format(item.price)} · stock ${item.stock}`);
  fill('#purchaseProduct', catalogs.inventory, item => item.name);
}

function openModal(id) { document.querySelector(`#${id}`).classList.add('open'); if (id !== 'inventoryModal') loadCatalogs(); }
function closeModal(modal) { modal.classList.remove('open'); modal.querySelector('.form-message').textContent = ''; }

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = Object.fromEntries(new FormData(form)); const message = form.querySelector('.form-message');
  try {
    let endpoint; let payload;
    if (form.dataset.form === 'inventory') { endpoint = '/api/inventory'; payload = { ...data, price: Number(data.price), cost: data.cost ? Number(data.cost) : null, stock: Number(data.stock) }; }
    if (form.dataset.form === 'sale') { endpoint = '/api/sales'; payload = { customerId: Number(data.customerId), payment: data.payment, items: [{ productId: Number(data.productId), quantity: Number(data.quantity), price: catalogs.inventory.find(item => item.id === Number(data.productId))?.price || 0 }] }; }
    if (form.dataset.form === 'purchase') { endpoint = '/api/purchases'; payload = { providerId: Number(data.providerId), items: [{ productId: Number(data.productId), quantity: Number(data.quantity), cost: Number(data.cost) }] }; }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    message.textContent = `Guardado correctamente (#${result.id})`; message.className = 'form-message success'; form.reset(); await loadDashboard(); await loadCatalogs();
    setTimeout(() => closeModal(form.closest('.modal')), 900);
  } catch (error) { message.textContent = error.message; message.className = 'form-message error'; }
}

async function boot() {
  try {
    await loadDashboard();
    try { await loadCatalogs(); } catch (_error) {
      catalogs = { customers: [], providers: [], inventory: [] };
    }
  } catch (_error) {
    document.querySelector('#connectionMode').textContent = 'SIN CONEXIÓN';
    document.querySelector('#inventoryRows').innerHTML = '<tr><td colspan="5" class="loading">No se pudo cargar el inventario desde ORDS</td></tr>';
    document.querySelector('#salesList').innerHTML = '<div class="loading">API no disponible</div>';
  }
}
document.querySelector('#refresh').addEventListener('click', boot);
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.open)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', submitForm));
document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));
boot();
