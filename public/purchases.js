function openPurchaseModal(id) {
  document.querySelector(`#${id}`)?.classList.add('open');
}
document.querySelectorAll('[data-modal-open]').forEach(button => {
  button.addEventListener('click', () => openPurchaseModal(button.dataset.modalOpen));
});
document.querySelectorAll('[data-modal-close]').forEach(button => {
  button.addEventListener('click', () => button.closest('.modal')?.classList.remove('open'));
});

async function submitQuickRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const message = form.querySelector('.form-message');
  const endpoint = form.dataset.quickForm === 'provider' ? '/api/providers' : '/api/inventory';
  const payload = form.dataset.quickForm === 'provider'
    ? data
    : { ...data, price: Number(data.price), cost: 0, stock: 0 };
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar el registro');
    form.reset();
    form.closest('.modal').classList.remove('open');
    await loadData();
    const target = form.dataset.quickForm === 'provider' ? '#purchaseProvider' : '#purchaseProduct';
    document.querySelector(target).value = result.id;
  } catch (error) {
    message.textContent = error.message;
    message.className = 'form-message error';
  }
}
document.querySelectorAll('[data-quick-form]').forEach(form => form.addEventListener('submit', submitQuickRecord));
