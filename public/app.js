const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
let catalogs = { customers: [], providers: [], inventory: [] };

function getCategoryLabel(type) {
  switch (type) {
    case 'LAPTOP': return '<span class="type laptop">Laptop Gamer</span>';
    case 'RETRO': return '<span class="type retro">Retro Restoration</span>';
    default: return '<span class="type nextgen">Consola Next-Gen</span>';
  }
}

function renderInventory(items) {
  document.querySelector('#inventoryRows').innerHTML = items.map(item => `
    <tr>
      <td>
        <strong>${item.name}</strong><br>
        <span class="cert-tag">${item.certificate || '#GS-2200'}</span> 
        <small>${item.brand || ''} ${item.model || ''}</small>
      </td>
      <td>${getCategoryLabel(item.type)}</td>
      <td>
        <div class="inspection-pills">
          <span class="pill hw" title="Hardware Original">HW ${item.hwPct || 100}%</span>
          <span class="pill aesthetic" title="Estado Estético">Est. ${item.aestheticPct || 95}%</span>
          <span class="pill thermal" title="Rendimiento Térmico">Térmico ${item.thermalPct || 98}%</span>
        </div>
      </td>
      <td><strong>${money.format(item.price)}</strong></td>
      <td class="stock">${item.stock} u.</td>
      <td><span class="state ${item.stock === 0 ? 'out' : item.stock <= 3 ? 'low' : ''}">${item.status || (item.stock === 0 ? 'Agotado' : 'Disponible')}</span></td>
      <td><button class="edit-button" data-edit="${item.id}">Detalles</button></td>
    </tr>`).join('');
}

function renderSales(items) {
  document.querySelector('#salesList').innerHTML = items.map(sale => `
    <div class="sale">
      <div class="sale-info">
        <span class="sale-name">${sale.customer}</span>
        <span class="sale-date">Venta #${sale.id} · ${sale.date}</span>
      </div>
      <div class="sale-meta">
        <strong class="sale-total">${money.format(sale.total)}</strong>
        <span class="sale-payment">${sale.payment}</span>
      </div>
    </div>`).join('');
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('No se pudo cargar el panel');
  const data = await response.json();
  document.querySelector('#metricInventory').textContent = data.metrics.inventory;
  document.querySelector('#metricSales').textContent = money.format(data.metrics.monthlySales);
  document.querySelector('#metricLowStock').textContent = data.metrics.lowStock;
  document.querySelector('#metricCustomers').textContent = data.metrics.customers;
  document.querySelector('#connectionMode').textContent = data.mode === 'demo' ? 'DEMO' : data.mode === 'ords' ? 'ORDS APEX' : 'ORACLE DB';
  renderInventory(data.inventory);
  renderSales(data.sales);
}

async function loadCatalogs() {
  const response = await fetch('/api/catalogs');
  catalogs = await response.json();
  const fill = (selector, items, label = item => item.name) => {
    document.querySelector(selector).innerHTML = items.map(item => `<option value="${item.id}">${label(item)}</option>`).join('');
  };
  fill('#saleCustomer', catalogs.customers);
  fill('#purchaseProvider', catalogs.providers);
  fill('#saleProduct', catalogs.inventory, item => `${item.name} (${item.certificate || '#GS'}) · ${money.format(item.price)} · Stock: ${item.stock}`);
  fill('#purchaseProduct', catalogs.inventory, item => item.name);
}

function openModal(id) {
  document.querySelector(`#${id}`).classList.add('open');
  if (id !== 'inventoryModal') loadCatalogs();
}

function closeModal(modal) {
  modal.classList.remove('open');
  modal.querySelector('.form-message').textContent = '';
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  try {
    let endpoint;
    let payload;
    if (form.dataset.form === 'inventory') {
      endpoint = '/api/inventory';
      payload = { ...data, price: Number(data.price), cost: data.cost ? Number(data.cost) : null, stock: Number(data.stock) };
    }
    if (form.dataset.form === 'sale') {
      endpoint = '/api/sales';
      payload = {
        customerId: Number(data.customerId),
        payment: data.payment,
        items: [{ productId: Number(data.productId), quantity: Number(data.quantity), price: catalogs.inventory.find(item => item.id === Number(data.productId))?.price || 0 }]
      };
    }
    if (form.dataset.form === 'purchase') {
      endpoint = '/api/purchases';
      payload = {
        providerId: Number(data.providerId),
        items: [{ productId: Number(data.productId), quantity: Number(data.quantity), cost: Number(data.cost) }]
      };
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    message.textContent = `Registrado con éxito (#${result.id}${result.certificate ? ' - ' + result.certificate : ''})`;
    message.className = 'form-message success';
    form.reset();
    await loadDashboard();
    await loadCatalogs();
    setTimeout(() => closeModal(form.closest('.modal')), 1100);
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
}

async function boot() {
  try {
    await loadDashboard();
    try { await loadCatalogs(); } catch (_error) { catalogs = { customers: [], providers: [], inventory: [] }; }
  } catch (_error) {
    document.querySelector('#connectionMode').textContent = 'SIN CONEXIÓN';
    document.querySelector('#inventoryRows').innerHTML = '<tr><td colspan="7" class="loading">No se pudo cargar el inventario desde ORDS</td></tr>';
    document.querySelector('#salesList').innerHTML = '<div class="loading">API no disponible</div>';
  }
}

document.querySelector('#refresh').addEventListener('click', boot);
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.open)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', submitForm));
document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));

boot();
