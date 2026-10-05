(function () {
  let scanner;

  async function loadHtml5QrCode() {
    if (window.Html5Qrcode) return window.Html5Qrcode;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar el lector QR'));
      document.head.appendChild(script);
    });
    return window.Html5Qrcode;
  }

  async function lookup(code) {
    const response = await fetch(`/api/mobile/scan/${encodeURIComponent(code)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Código no encontrado');
    document.querySelector('#scanResult').textContent = `${result.product.name} · Stock: ${result.product.stock}`;
    if (typeof window.openProductDetails === 'function') window.openProductDetails(result.product.id);
    return result.product;
  }

  async function start() {
    const container = document.querySelector('#qrReader');
    if (!container) return;
    const Html5Qrcode = await loadHtml5QrCode();
    scanner = new Html5Qrcode('qrReader');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 180 } },
      async decodedText => {
        await stop();
        try { await lookup(decodedText); }
        catch (error) { document.querySelector('#scanResult').textContent = error.message; }
      },
      () => {}
    );
  }

  async function stop() {
    if (scanner) {
      await scanner.stop();
      scanner.clear();
      scanner = null;
    }
  }

  function open() {
    document.querySelector('#qrScannerModal')?.classList.add('open');
    start().catch(error => { document.querySelector('#scanResult').textContent = error.message; });
  }

  window.GSQrScanner = { open, start, stop, lookup };
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#openQrScanner')?.addEventListener('click', open);
    document.querySelector('#scanManualForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      try { await lookup(event.currentTarget.elements.code.value.trim()); }
      catch (error) { document.querySelector('#scanResult').textContent = error.message; }
    });
    document.querySelector('#closeQrScanner')?.addEventListener('click', async () => {
      await stop();
      document.querySelector('#qrScannerModal')?.classList.remove('open');
    });
  });
})();
