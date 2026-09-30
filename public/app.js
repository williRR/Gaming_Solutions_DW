const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
let catalogs = { customers: [], providers: [], inventory: [] };
let inventoryItems = [];
let categories = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function getCategoryLabel(item) {
  const categoryName = item.category || categories.find(category => category.id === Number(item.categoryId))?.name;
  if (categoryName) return `<span class="type">${escapeHtml(categoryName)}</span>`;
  switch (item.type) {
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
        <small>${escapeHtml(`${item.brand || ''} ${item.model || ''}`.trim())}</small>
      </td>
      <td>${getCategoryLabel(item)}</td>
      <td>
        <div class="inspection-pills">
          <span class="pill hw" title="Hardware Original">HW ${Number(item.hwPct ?? 100)}%</span>
          <span class="pill aesthetic" title="Estado Estético">Est. ${Number(item.aestheticPct ?? 95)}%</span>
          <span class="pill thermal" title="Rendimiento Térmico">Térmico ${Number(item.thermalPct ?? 98)}%</span>
        </div>
      </td>
      <td><strong>${money.format(Number(item.price) || 0)}</strong></td>
      <td class="stock">${Number(item.stock)} u.</td>
      <td><span class="state ${item.stock === 0 ? 'out' : item.stock <= 3 ? 'low' : ''}">${escapeHtml(item.status || (item.stock === 0 ? 'Agotado' : 'Disponible'))}</span></td>
      <td class="row-actions">
        <button class="edit-button" data-edit-product="${Number(item.id)}">Editar</button>
        <button class="edit-button danger" data-delete-product="${Number(item.id)}">Eliminar</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7" class="loading">No hay productos registrados</td></tr>';
}

function renderCategories() {
  document.querySelector('#categoryRows').innerHTML = categories.map(category => `
    <tr>
      <td><strong>${escapeHtml(category.name)}</strong></td>
      <td><code>${escapeHtml(category.slug)}</code></td>
      <td>${Number(category.warrantyMonths)} meses</td>
      <td>${escapeHtml(category.description || '')}</td>
      <td class="row-actions">
        <button class="edit-button" data-edit-category="${Number(category.id)}">Editar</button>
        <button class="edit-button danger" data-delete-category="${Number(category.id)}">Eliminar</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="loading">No hay categorías registradas</td></tr>';
}

function renderSales(items) {
  document.querySelector('#salesList').innerHTML = items.map(sale => `
    <div class="sale">
      <div class="sale-info">
        <span class="sale-name">${escapeHtml(sale.customer)}</span>
        <span class="sale-date">Venta #${escapeHtml(sale.id)} · ${escapeHtml(sale.date)}</span>
      </div>
      <div class="sale-meta">
        <strong class="sale-total">${money.format(Number(sale.total) || 0)}</strong>
        <span class="sale-payment">${escapeHtml(sale.payment)}</span>
      </div>
    </div>`).join('');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
  return result;
}

async function loadDashboard() {
  const data = await fetchJson('/api/dashboard');
  document.querySelector('#metricInventory').textContent = data.metrics.inventory;
  document.querySelector('#metricSales').textContent = money.format(data.metrics.monthlySales);
  document.querySelector('#metricLowStock').textContent = data.metrics.lowStock;
  document.querySelector('#metricCustomers').textContent = data.metrics.customers;
  document.querySelector('#connectionMode').textContent = data.mode === 'demo' ? 'DEMO' : data.mode === 'ords' ? 'ORDS APEX' : 'ORACLE DB';
  inventoryItems = data.inventory;
  renderInventory(inventoryItems);
  renderSales(data.sales);
}

async function loadCategories() {
  categories = await fetchJson('/api/categories');
  renderCategories();
  const select = document.querySelector('#productCategory');
  select.innerHTML = categories.map(category =>
    `<option value="${Number(category.id)}">${escapeHtml(category.name)}</option>`
  ).join('');
}

async function loadCatalogs() {
  catalogs = await fetchJson('/api/catalogs');
  const fill = (selector, items, label = item => item.name) => {
    document.querySelector(selector).innerHTML = items.map(item =>
      `<option value="${Number(item.id)}">${escapeHtml(label(item))}</option>`
    ).join('');
  };
  fill('#saleCustomer', catalogs.customers);
  fill('#purchaseProvider', catalogs.providers);
  fill('#saleProduct', catalogs.inventory, item => `${item.name} (${item.certificate || '#GS'}) · ${money.format(item.price)} · Stock: ${item.stock}`);
  fill('#purchaseProduct', catalogs.inventory, item => item.name);
}

function resetForm(form) {
  form.reset();
  if (form.elements.id) form.elements.id.value = '';
  if (form.id === 'categoryForm') form.elements.slug.dataset.userEdited = 'false';
  form.querySelector('.form-message').textContent = '';
  form.querySelector('.form-message').className = 'form-message';
}

async function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  const form = modal.querySelector('form');
  resetForm(form);
  if (id === 'inventoryModal') {
    await loadCategories();
    form.querySelector('[data-form-title]').textContent = 'Registrar Producto Gamer';
  } else if (id === 'categoryModal') {
    form.querySelector('[data-form-title]').textContent = 'Registrar Categoría';
  } else {
    await loadCatalogs();
  }
  modal.classList.add('open');
}

function closeModal(modal) {
  modal.classList.remove('open');
  const message = modal.querySelector('.form-message');
  if (message) {
    message.textContent = '';
    message.className = 'form-message';
  }
}

function editProduct(id) {
  const product = inventoryItems.find(item => Number(item.id) === id);
  if (!product) return;
  const modal = document.querySelector('#inventoryModal');
  const form = modal.querySelector('form');
  resetForm(form);
  form.elements.id.value = product.id;
  form.elements.name.value = product.name || '';
  form.elements.brand.value = product.brand || '';
  form.elements.model.value = product.model || '';
  form.elements.categoryId.value = product.categoryId || categories.find(item => item.name === product.category)?.id || '';
  form.elements.type.value = product.type || 'NEXT_GEN';
  form.elements.price.value = product.price;
  form.elements.cost.value = product.cost ?? '';
  form.elements.stock.value = product.stock;
  form.querySelector('[data-form-title]').textContent = 'Editar Producto';
  modal.classList.add('open');
}

function editCategory(id) {
  const category = categories.find(item => Number(item.id) === id);
  if (!category) return;
  const modal = document.querySelector('#categoryModal');
  const form = modal.querySelector('form');
  resetForm(form);
  form.elements.id.value = category.id;
  form.elements.name.value = category.name;
  form.elements.slug.value = category.slug;
  form.elements.warrantyMonths.value = category.warrantyMonths;
  form.elements.description.value = category.description || '';
  form.querySelector('[data-form-title]').textContent = 'Editar Categoría';
  modal.classList.add('open');
}

async function submitForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  const id = data.id;
  try {
    let endpoint;
    let method = 'POST';
    let payload;
    if (form.dataset.form === 'inventory') {
      endpoint = id ? `/api/inventory/${encodeURIComponent(id)}` : '/api/inventory';
      method = id ? 'PUT' : 'POST';
      payload = {
        name: data.name, brand: data.brand, model: data.model, type: data.type,
        categoryId: Number(data.categoryId), price: Number(data.price),
        cost: data.cost ? Number(data.cost) : 0, stock: Number(data.stock)
      };
    } else if (form.dataset.form === 'category') {
      endpoint = id ? `/api/categories/${encodeURIComponent(id)}` : '/api/categories';
      method = id ? 'PATCH' : 'POST';
      payload = {
        name: data.name, slug: data.slug, description: data.description,
        warrantyMonths: Number(data.warrantyMonths)
      };
    } else if (form.dataset.form === 'sale') {
      endpoint = '/api/sales';
      payload = {
        customerId: Number(data.customerId),
        payment: data.payment,
        items: [{ productId: Number(data.productId), quantity: Number(data.quantity), price: catalogs.inventory.find(item => item.id === Number(data.productId))?.price || 0 }]
      };
    } else if (form.dataset.form === 'purchase') {
      endpoint = '/api/purchases';
      payload = {
        providerId: Number(data.providerId),
        items: [{ productId: Number(data.productId), quantity: Number(data.quantity), cost: Number(data.cost) }]
      };
    }
    const result = await fetchJson(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    message.textContent = `${id ? 'Actualizado' : 'Registrado'} correctamente${result.id ? ` (#${result.id})` : ''}${result.certificate ? ` - ${result.certificate}` : ''}`;
    message.className = 'form-message success';
    form.reset();
    if (form.elements.id) form.elements.id.value = '';
    await Promise.all([loadDashboard(), loadCategories(), loadCatalogs()]);
    setTimeout(() => closeModal(form.closest('.modal')), 1100);
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
}

async function deleteResource(url, label, reload) {
  if (!window.confirm(`¿Seguro que deseas eliminar ${label}?`)) return;
  try {
    await fetchJson(url, { method: 'DELETE' });
    await reload();
  } catch (error) {
    window.alert(error.message);
  }
}

async function boot() {
  try {
    await Promise.all([loadDashboard(), loadCategories(), loadCatalogs()]);
  } catch (error) {
    document.querySelector('#connectionMode').textContent = 'SIN CONEXIÓN';
    document.querySelector('#inventoryRows').innerHTML = `<tr><td colspan="7" class="loading">${escapeHtml(error.message)}</td></tr>`;
  }
}

document.querySelector('#refresh').addEventListener('click', boot);
document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
  openModal(button.dataset.open).catch(error => window.alert(error.message));
}));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
document.querySelectorAll('[data-form]').forEach(form => form.addEventListener('submit', submitForm));
document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => {
  if (event.target === modal) closeModal(modal);
}));
document.querySelector('#inventoryRows').addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-product]');
  const deleteButton = event.target.closest('[data-delete-product]');
  if (editButton) editProduct(Number(editButton.dataset.editProduct));
  if (deleteButton) deleteResource(`/api/inventory/${deleteButton.dataset.deleteProduct}`, 'este producto', boot);
});
document.querySelector('#categoryRows').addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-category]');
  const deleteButton = event.target.closest('[data-delete-category]');
  if (editButton) editCategory(Number(editButton.dataset.editCategory));
  if (deleteButton) deleteResource(`/api/categories/${deleteButton.dataset.deleteCategory}`, 'esta categoría', async () => {
    await Promise.all([loadCategories(), loadDashboard()]);
  });
});
document.querySelector('#categoryForm [name="name"]').addEventListener('input', event => {
  const slugInput = document.querySelector('#categoryForm [name="slug"]');
  if (slugInput.dataset.userEdited === 'true') return;
  slugInput.value = event.currentTarget.value
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
});
document.querySelector('#categoryForm [name="slug"]').addEventListener('input', event => {
  event.currentTarget.dataset.userEdited = 'true';
});

boot();
