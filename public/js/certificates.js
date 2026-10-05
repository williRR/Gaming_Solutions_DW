(function () {
  function printCertificate() {
    const title = document.querySelector('#productDetailsTitle')?.textContent || 'Certificado #GS';
    const form = document.querySelector('[data-form="certificate-update"]');
    if (!form) return;
    const values = [
      ['Hardware original', form.elements.hwPct.value + '%'],
      ['Estado estético', form.elements.aestheticPct.value + '%'],
      ['Rendimiento térmico', form.elements.thermalPct.value + '%'],
      ['Garantía', form.elements.warrantyMonths.value + ' meses'],
      ['Puntos revisados', form.elements.pointsReviewed.value || 'N/D'],
      ['Técnico responsable', form.elements.technician.value || 'N/D'],
      ['Detalle', form.elements.inspectionDetail.value || 'N/D']
    ];
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) throw new Error('El navegador bloqueó la ventana de impresión');
    const safe = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    popup.document.write(`<html lang="es"><head><title>${safe(title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17202a}h1{color:#5d3fd3}table{border-collapse:collapse;width:100%}td{border:1px solid #ddd;padding:10px}td:first-child{font-weight:bold;width:38%}</style></head><body><h1>${safe(title)}</h1><p>Gaming Solutions · Certificado de inspección técnica #GS</p><table>${values.map(([label, value]) => `<tr><td>${safe(label)}</td><td>${safe(value)}</td></tr>`).join('')}</table></body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#printCertificate')?.addEventListener('click', () => {
      try { printCertificate(); } catch (error) { document.querySelector('#sidebarStatus').textContent = error.message; }
    });
  });
})();
