const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get = async path => { const response = await fetch(path); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo cargar el módulo'); return data; };
async function start() {
  const module = document.body.dataset.module;
  try {
    if (module === 'catalog') document.querySelector('#productGallery').innerHTML = (await get('/api/inventory')).map(item => `<article class="product-card"><div><div class="product-art">${esc(item.type)}</div><h4>${esc(item.name)}</h4><small>${esc(item.certificate || '#GS')} · ${item.stock} unidades</small></div><strong class="product-price">${money.format(Number(item.price) || 0)}</strong></article>`).join('');
    if (module === 'clients') document.querySelector('#clientRows').innerHTML = (await get('/api/clients')).map(item => `<tr><td><strong>${esc(item.name)}</strong></td><td>${esc(item.email || item.phone || 'Sin contacto')}</td><td>${esc(item.address || 'Sin dirección')}</td></tr>`).join('');
    if (module === 'operations') document.querySelector('#salesList').innerHTML = (await get('/api/sales')).map(item => `<div class="sale"><div class="sale-info"><span class="sale-name">${esc(item.customer || 'Cliente')}</span><span class="sale-date">Venta #${esc(item.id)} · ${esc(item.date)}</span></div><div class="sale-meta"><strong class="sale-total">${money.format(Number(item.total) || 0)}</strong><span class="sale-payment">${esc(item.payment)}</span></div></div>`).join('');
    if (module === 'audit') document.querySelector('#auditList').innerHTML = (await get('/api/audit')).map(item => `<div class="audit-entry"><strong>${esc(item.accion || item.action || item.EVENTO || 'Evento registrado')}</strong><small>${esc(item.fecha || item.date || item.FECHA_EVENTO || '')}</small></div>`).join('') || '<div class="empty-state">No hay eventos disponibles.</div>';
    document.querySelector('#sidebarStatus').textContent = 'Apex / ORDS Activo';
  } catch (error) { document.querySelector('#sidebarStatus').textContent = error.message; }
}
start();
