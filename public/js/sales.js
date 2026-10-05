(function () {
  let cart = [];

  function productCatalog() {
    return window.catalogs?.inventory || [];
  }

  function selectedProduct() {
    const id = Number(document.querySelector('#saleProduct')?.value);
    return productCatalog().find(product => Number(product.id) === id);
  }

  function renderCart() {
    const rows = document.querySelector('#saleCartRows');
    const total = document.querySelector('#saleCartTotal');
    if (!rows || !total) return;
    if (!cart.length) {
      rows.innerHTML = '<tr><td colspan="5">El carrito está vacío</td></tr>';
      total.textContent = '$0.00';
      return;
    }
    rows.innerHTML = cart.map((item, index) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${window.money.format(item.price)}</td>
        <td>${window.money.format(item.quantity * item.price)}</td>
        <td><button type="button" data-remove-sale-item="${index}">Quitar</button></td>
      </tr>`).join('');
    total.textContent = window.money.format(cart.reduce((sum, item) => sum + item.quantity * item.price, 0));
  }

  function addItem() {
    const product = selectedProduct();
    const quantity = Number(document.querySelector('#saleQuantity')?.value);
    if (!product) throw new Error('Selecciona un producto');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('La cantidad debe ser un entero positivo');
    const existing = cart.find(item => item.productId === Number(product.id));
    const nextQuantity = (existing?.quantity || 0) + quantity;
    if (nextQuantity > Number(product.stock)) throw new Error(`Solo hay ${product.stock} unidades disponibles`);
    if (existing) existing.quantity = nextQuantity;
    else cart.push({ productId: Number(product.id), name: product.name, price: Number(product.price), quantity });
    renderCart();
  }

  async function submitSale(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('.form-message');
    try {
      if (!cart.length) throw new Error('Agrega al menos un producto al carrito');
      const customerId = Number(form.elements.customerId.value);
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          customerId,
          payment: form.elements.payment.value,
          items: cart.map(item => ({
            id_producto: item.productId,
            cantidad: item.quantity,
            precio_unitario: item.price
          }))
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar la venta');
      message.textContent = `Venta #${result.id} registrada por ${window.money.format(result.total || 0)}`;
      message.className = 'form-message success';
      cart = [];
      renderCart();
      form.reset();
      await window.loadDashboard?.();
      await window.loadCatalogs?.();
    } catch (error) {
      message.textContent = error.message;
      message.className = 'form-message error';
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#addSaleItem')?.addEventListener('click', () => {
      try { addItem(); } catch (error) { document.querySelector('[data-form="sale"] .form-message').textContent = error.message; }
    });
    document.querySelector('#saleCartRows')?.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-sale-item]');
      if (button) { cart.splice(Number(button.dataset.removeSaleItem), 1); renderCart(); }
    });
    document.querySelector('[data-form="sale"]')?.addEventListener('submit', submitSale);
  });
})();
