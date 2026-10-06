(function () {
  let scanner;
  let startGeneration = 0;

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
    const generation = ++startGeneration;
    const Html5Qrcode = await loadHtml5QrCode();
    const nextScanner = new Html5Qrcode('qrReader');
    if (generation !== startGeneration || !document.querySelector('#qrScannerModal')?.classList.contains('open')) {
      nextScanner.clear().catch(() => {});
      return;
    }
    scanner = nextScanner;
    window.html5QrCodeScanner = scanner;
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
    const activeScanner = scanner || window.html5QrCodeScanner;
    scanner = null;
    window.html5QrCodeScanner = null;
    if (activeScanner) {
      try {
        if (activeScanner.isScanning) await activeScanner.stop();
        await activeScanner.clear();
      } catch (error) {
        console.warn('Error o advertencia al detener la cámara QR:', error);
      }
    }
  }

  function open() {
    const modal = document.querySelector('#qrScannerModal');
    if (!modal) return;
    modal.classList.add('open');
    modal.classList.remove('hidden');
    modal.style.display = '';
    start().catch(error => { document.querySelector('#scanResult').textContent = error.message; });
  }

  async function stopAndCloseQrScanner() {
    const modal = document.querySelector('#qrScannerModal');
    startGeneration += 1;
    await stop();
    if (modal) {
      modal.classList.remove('open');
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  window.GSQrScanner = { open, start, stop, stopAndCloseQrScanner, lookup };
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#openQrScanner')?.addEventListener('click', open);
    document.querySelector('#scanManualForm')?.addEventListener('submit', async event => {
      event.preventDefault();
      try { await lookup(event.currentTarget.elements.code.value.trim()); }
      catch (error) { document.querySelector('#scanResult').textContent = error.message; }
    });
    document.querySelector('#closeQrScanner')?.addEventListener('click', async () => {
      await stopAndCloseQrScanner();
    });
  });
})();
