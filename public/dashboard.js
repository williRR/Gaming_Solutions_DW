const dashboardMoney = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const dashboardEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

async function loadDashboardPage() {
  const response = await fetch('/api/summary');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'No se pudo cargar el resumen');
  document.querySelector('#connectionMode').textContent = data.mode === 'demo' ? 'DEMO' : data.mode.toUpperCase();
  document.querySelector('#metricInventory').textContent = data.metrics.totalStock ?? data.metrics.inventory;
  document.querySelector('#metricSales').textContent = dashboardMoney.format(Number(data.metrics.monthlySales) || 0);
  document.querySelector('#metricLowStock').textContent = data.metrics.lowStock;
  document.querySelector('#metricCustomers').textContent = data.metrics.customers ?? 'N/D';
  const lowStock = (data.inventory || []).filter(item => Number(item.stock) <= 3);
  document.querySelector('#lowStockList').innerHTML = lowStock.length
    ? lowStock.map(item => `<div class="alert-row"><span>${dashboardEsc(item.name)}</span><strong>${Number(item.stock)} u.</strong></div>`).join('')
    : '<div class="empty-state">No hay alertas de stock.</div>';
  const sales = data.sales || [];
  document.querySelector('#salesList').innerHTML = sales.length
    ? data.sales.map(sale => `<div class="sale"><div class="sale-info"><span class="sale-name">${dashboardEsc(sale.customer || 'Cliente')}</span><span class="sale-date">Venta #${dashboardEsc(sale.id)} · ${dashboardEsc(sale.date)}</span></div><strong class="sale-total">${dashboardMoney.format(Number(sale.total) || 0)}</strong></div>`).join('')
    : '<div class="empty-state">No hay ventas recientes.</div>';
  document.querySelector('#sidebarStatus').textContent = 'Conectado';
}
document.querySelector('#logout').addEventListener('click', () => { window.GSAuth.clearSession(); window.location.replace('/login.html'); });
loadDashboardPage().catch(error => { document.querySelector('#sidebarStatus').textContent = error.message; });
