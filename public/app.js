const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
let catalogs = { customers: [], providers: [], inventory: [] };
window.money = money;
Object.defineProperty(window, 'catalogs', { get: () => catalogs });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

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
        <strong>${escapeHtml(item.name)}</strong><br>
        <span class="cert-tag">${escapeHtml(item.certificate || '#GS-2200')}</span>
        <small>${escapeHtml(`${item.brand || ''} ${item.model || ''}`)}</small>
      </td>
      <td>${getCategoryLabel(item.type)}</td>
      <td>
        <div class="inspection-pills">
          <span class="pill hw" title="Hardware Original">HW ${item.hwPct || 100}%</span>
          <span class="pill aesthetic" title="Estado Estético">Est. ${item.aestheticPct || 95}%</span>
          <span class="pill thermal" title="Rendimiento Térmico">Térmico ${item.thermalPct || 98}%</span>
        </div>
      </td>
      <td><strong>${money.format(Number(item.price) || 0)}</strong></td>
      <td class="stock">${Number(item.stock) || 0} u.</td>
      <td><span class="state ${item.stock === 0 ? 'out' : item.stock <= 3 ? 'low' : ''}">${escapeHtml(item.status || (item.stock === 0 ? 'Agotado' : 'Disponible'))}</span></td>
      <td><button class="edit-button" data-edit="${encodeURIComponent(item.id)}" data-permission="inventoryRead">Editar / GS</button></td>
    </tr>`).join('');
  window.GSRbac?.applyRoleUI();
}

function renderSales(items, mode) {
  if (!items.length) {
    document.querySelector('#salesList').innerHTML = `<div class="loading">${mode === 'ords' ? 'Ventas no disponibles desde ORDS' : 'No hay ventas para mostrar'}</div>`;
    return;
  }
  document.querySelector('#salesList').innerHTML = items.map(sale => `
    <div class="sale">
      <div class="sale-info">
        <span class="sale-name">${escapeHtml(sale.customer || 'Cliente')}</span>
        <span class="sale-date">Venta #${escapeHtml(sale.id)} · ${escapeHtml(sale.date)}</span>
      </div>
      <div class="sale-meta">
        <strong class="sale-total">${money.format(sale.total)}</strong>
        <span class="sale-payment">${escapeHtml(sale.payment)}</span>
      </div>
    </div>`).join('');
}

function renderGallery(items) {
  const gallery = document.querySelector('#productGallery');
  gallery.innerHTML = items.slice(0, 6).map(item => `
    <article class="product-card">
      <div>
        <div class="product-art">${escapeHtml(item.type || 'GS')}</div>
        <h4>${escapeHtml(item.name)}</h4>
        <small>${escapeHtml(item.certificate || 'Certificado pendiente')} · ${Number(item.stock) || 0} unidades</small>
      </div>
      <strong class="product-price">${money.format(Number(item.price) || 0)}</strong>
    </article>`).join('') || '<div class="empty-state">No hay productos disponibles.</div>';
}

function renderCategories(items) {
  const list = document.querySelector('#categoryList');
  list.innerHTML = items.length ? items.map(category => `
    <div class="category-item"><span>${escapeHtml(category.name || category.NOMBRE || 'Sin nombre')}</span>
      <small>${escapeHtml(category.description || category.DESCRIPCION || 'Categoría de catálogo')}</small></div>`).join('')
    : '<div class="empty-state">No hay categorías publicadas en este entorno.</div>';
}

function renderClients(items) {
  document.querySelector('#clientRows').innerHTML = items.length ? items.map(client => `
    <tr><td><strong>${escapeHtml(client.name || client.NOMBRE)}</strong></td>
      <td>${escapeHtml(client.email || client.EMAIL || client.phone || client.TELEFONO || 'Sin contacto')}</td>
      <td>${escapeHtml(client.address || client.DIRECCION || 'Sin dirección')}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty-state">No hay clientes registrados.</td></tr>';
}

function renderAudit(items) {
  const list = document.querySelector('#auditList');
  list.innerHTML = items.length ? items.slice(0, 12).map(entry => `
    <div class="audit-entry"><strong>${escapeHtml(entry.accion || entry.action || entry.EVENTO || 'Evento registrado')}</strong>
      <small>${escapeHtml(entry.fecha || entry.date || entry.FECHA_EVENTO || '')} · ${escapeHtml(entry.usuario || entry.user || entry.USUARIO || 'Sistema')}</small></div>`).join('')
    : '<div class="empty-state">No hay eventos de auditoría disponibles.</div>';
}

async function loadModules() {
  const requests = await Promise.allSettled([
    fetch('/api/inventory').then(response => response.ok ? response.json() : Promise.reject(new Error('No se pudo cargar el catálogo'))),
    fetch('/api/categories').then(response => response.ok ? response.json() : Promise.reject(new Error('No se pudieron cargar las categorías'))),
    fetch('/api/clients').then(response => response.ok ? response.json() : Promise.reject(new Error('No se pudieron cargar los clientes'))),
    fetch('/api/audit').then(response => response.ok ? response.json() : Promise.reject(new Error('No se pudo cargar la auditoría')))
  ]);
  if (requests[0].status === 'fulfilled') renderGallery(requests[0].value);
  else document.querySelector('#productGallery').innerHTML = '<div class="empty-state">Catálogo visual no disponible.</div>';
  if (requests[1].status === 'fulfilled') renderCategories(requests[1].value);
  else document.querySelector('#categoryList').innerHTML = '<div class="empty-state">Categorías no disponibles.</div>';
  if (requests[2].status === 'fulfilled') renderClients(requests[2].value);
  else document.querySelector('#clientRows').innerHTML = '<tr><td colspan="3" class="empty-state">Clientes no disponibles.</td></tr>';
  if (requests[3].status === 'fulfilled') renderAudit(requests[3].value);
  else document.querySelector('#auditList').innerHTML = '<div class="empty-state">Auditoría no disponible.</div>';
}

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status} al cargar el panel`);
  document.querySelector('#metricInventory').textContent = data.metrics.inventory;
  document.querySelector('#metricSales').textContent = data.metrics.monthlySales === null ? 'N/D' : money.format(data.metrics.monthlySales);
  document.querySelector('#metricLowStock').textContent = data.metrics.lowStock;
  document.querySelector('#metricCustomers').textContent = data.metrics.customers === null ? 'N/D' : data.metrics.customers;
  document.querySelector('#connectionMode').textContent = data.mode === 'demo' ? 'DEMO' : data.mode === 'ords' ? 'ORDS APEX' : 'ORACLE DB';
  renderInventory(data.inventory);
  renderSales(data.sales, data.mode);
}
window.loadDashboard = loadDashboard;

async function loadCatalogs() {
  const response = await fetch('/api/catalogs');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status} al cargar catálogos`);
  catalogs = result;
  const fill = (selector, items, label = item => item.name) => {
    document.querySelector(selector).innerHTML = items.length
      ? items.map(item => `<option value="${item.id}">${label(item)}</option>`).join('')
      : '<option value="">Sin registros disponibles</option>';
  };
  fill('#saleCustomer', catalogs.customers);
  fill('#purchaseProvider', catalogs.providers);
  fill('#saleProduct', catalogs.inventory, item => `${item.name} (${item.certificate || '#GS'}) · ${money.format(item.price)} · Stock: ${item.stock}`);
  fill('#purchaseProduct', catalogs.inventory, item => item.name);
}
window.loadCatalogs = loadCatalogs;

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  modal.classList.add('open');
  modal.removeAttribute('hidden');
  if (id !== 'inventoryModal') {
    loadCatalogs().catch(error => {
      document.querySelector('#sidebarStatus').textContent = error.message;
    });
  }
}

function closeModal(modal) {
  modal.classList.remove('open');
  modal.setAttribute('hidden', 'hidden');
  modal.querySelectorAll('.form-message').forEach(message => {
    message.textContent = '';
    message.className = 'form-message';
  });
}

async function openProductDetails(productId) {
  try {
    const response = await fetch(`/api/inventory/${productId}`);
    const product = await response.json();
    if (!response.ok) throw new Error(product.error || 'No se pudo consultar el producto');

    document.querySelector('#productDetailsTitle').textContent = `${product.name} · ${product.certificate || ''}`;
    const updateForm = document.querySelector('[data-form="product-update"]');
    updateForm.elements.productId.value = product.id;
    updateForm.elements.name.value = product.name || '';
    updateForm.elements.price.value = product.price ?? '';
    updateForm.elements.cost.value = product.cost ?? 0;
    updateForm.elements.stock.value = product.stock ?? 0;

    const certificateForm = document.querySelector('[data-form="certificate-update"]');
    certificateForm.elements.productId.value = product.id;
    certificateForm.elements.hwPct.value = product.hwPct ?? '';
    certificateForm.elements.aestheticPct.value = product.aestheticPct ?? '';
    certificateForm.elements.thermalPct.value = product.thermalPct ?? '';
    certificateForm.elements.warrantyMonths.value = product.warrantyMonths ?? '';
    certificateForm.elements.pointsReviewed.value = product.pointsReviewed ?? '';
    certificateForm.elements.technician.value = product.technician || '';
    certificateForm.elements.inspectionDetail.value = product.inspectionDetail || '';
    document.querySelector('#productDetailsModal').classList.add('open');
  } catch (error) {
    document.querySelector('#sidebarStatus').textContent = error.message;
  }
  window.openProductDetails = openProductDetails;
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  try {
    let endpoint;
    let payload;
    let method = 'POST';
    if (form.dataset.form === 'inventory') {
      // Express forwards this local POST to the ORDS /productos/ endpoint.
      endpoint = '/api/inventory';
      payload = { ...data, price: Number(data.price), cost: data.cost ? Number(data.cost) : null, stock: Number(data.stock) };
    }
    if (form.dataset.form === 'product-update') {
      endpoint = `/api/inventory/${data.productId}`;
      method = 'PATCH';
      payload = { name: data.name, price: Number(data.price), cost: Number(data.cost), stock: Number(data.stock) };
    }
    if (form.dataset.form === 'certificate-update') {
      endpoint = `/api/inventory/${data.productId}/certificate`;
      method = 'PATCH';
      payload = {
        hwPct: Number(data.hwPct),
        aestheticPct: Number(data.aestheticPct),
        thermalPct: Number(data.thermalPct),
        warrantyMonths: Number(data.warrantyMonths)
      };
      for (const field of ['pointsReviewed', 'technician', 'inspectionDetail']) {
        if (data[field] !== '') payload[field] = field === 'pointsReviewed' ? Number(data[field]) : data[field];
      }
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
        items: [{ productId: Number(data.productId), quantity: Number(data.quantity), cost: Number(data.cost) }],
        notes: data.notes.trim() || null
      };
    }
    if (form.dataset.form === 'client') {
      endpoint = '/api/clients';
      payload = data;
    }
    const response = await fetch(endpoint, {
      method,
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
    await loadModules();
    setTimeout(() => closeModal(form.closest('.modal')), 1100);
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
}

async function boot() {
  try {
    await loadDashboard();
    await loadModules();
    try { await loadCatalogs(); } catch (error) {
      catalogs = { customers: [], providers: [], inventory: [] };
      document.querySelector('#sidebarStatus').textContent = error.message;
    }
  } catch (_error) {
    document.querySelector('#sidebarStatus').textContent = _error.message;
    document.querySelector('#connectionMode').textContent = 'SIN CONEXIÓN';
    document.querySelector('#inventoryRows').innerHTML = '<tr><td colspan="7" class="loading">No se pudo cargar el inventario; revisa el error de conexión</td></tr>';
    document.querySelector('#salesList').innerHTML = '<div class="loading">API no disponible</div>';
  }
}

document.querySelector('#refresh').addEventListener('click', boot);
document.querySelector('#catalogRefresh').addEventListener('click', loadModules);
document.querySelector('#auditRefresh').addEventListener('click', loadModules);
document.querySelector('#logout').addEventListener('click', () => {
  window.GSAuth.clearSession();
  window.location.replace('/login.html');
});
document.querySelector('#inventoryRows').addEventListener('click', event => {
  const button = event.target.closest('[data-edit]');
  if (button) openProductDetails(decodeURIComponent(button.dataset.edit));
});
document.querySelector('#deactivateProduct').addEventListener('click', async () => {
  const productId = document.querySelector('[data-form="product-update"]').elements.productId.value;
  if (!productId || !window.confirm('Se desactivara este producto. Deseas continuar?')) return;
  try {
    const response = await fetch(`/api/inventory/${productId}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo desactivar el producto');
    closeModal(document.querySelector('#productDetailsModal'));
    await loadDashboard();
  } catch (error) {
    document.querySelector('#sidebarStatus').textContent = error.message;
  }
});
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openModal(button.dataset.open)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
document.querySelectorAll('[data-form]').forEach(form => {
  if (!['sale', 'purchase'].includes(form.dataset.form)) form.addEventListener('submit', submitForm);
});
document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal); }));

boot();
