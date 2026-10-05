(function () {
  const tabs = [
    { id: 'dashboard', label: 'Resumen', icon: '▦', permission: 'dashboard' },
    { id: 'inventory', label: 'Inventario', icon: '◈', permission: 'inventoryRead' },
    { id: 'sales', label: 'Ventas', icon: '↗', permission: 'sales' },
    { id: 'purchases', label: 'Compras', icon: '↙', permission: 'purchases' },
    { id: 'audit', label: 'Auditoría', icon: '◌', permission: 'audit' }
  ];

  function isNative() {
    return Boolean(window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() !== 'web');
  }

  function allowed(tab) {
    const role = window.GSAuth?.getUser()?.rol;
    const permissions = {
      Administrador: ['dashboard', 'inventoryRead', 'sales', 'purchases', 'audit'],
      Ventas: ['dashboard', 'inventoryRead', 'sales'],
      Almacen: ['dashboard', 'inventoryRead', 'purchases']
    };
    return (permissions[role] || []).includes(tab.permission);
  }

  function render() {
    if (!isNative() && window.innerWidth > 900) return;
    let nav = document.querySelector('#mobileBottomNav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'mobileBottomNav';
      nav.className = 'mobile-bottom-nav';
      document.body.appendChild(nav);
    }
    nav.innerHTML = tabs.filter(allowed).map(tab =>
      `<a href="#${tab.id}" data-mobile-tab="${tab.id}"><span>${tab.icon}</span><small>${tab.label}</small></a>`
    ).join('');
    nav.querySelectorAll('[data-mobile-tab]').forEach(link => link.addEventListener('click', () => {
      nav.querySelectorAll('a').forEach(item => item.classList.remove('active'));
      link.classList.add('active');
    }));
  }

  function enablePullToRefresh() {
    let startY = 0;
    document.addEventListener('touchstart', event => {
      if (window.scrollY === 0) startY = event.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', async event => {
      const distance = event.changedTouches[0].clientY - startY;
      if (startY && distance > 90 && window.scrollY === 0 && typeof window.loadDashboard === 'function') {
        document.querySelector('#sidebarStatus').textContent = 'Actualizando datos...';
        try {
          await window.loadDashboard();
          await window.loadCatalogs?.();
          document.querySelector('#sidebarStatus').textContent = 'Datos actualizados';
        } catch (error) {
          document.querySelector('#sidebarStatus').textContent = error.message;
        } finally {
          startY = 0;
        }

      }
    }, { passive: true });
  }

  function enableAndroidBackButton() {
    const appPlugin = window.Capacitor?.Plugins?.App;
    if (!appPlugin?.addListener) return;
    appPlugin.addListener('backButton', async ({ canGoBack }) => {
      const openModal = document.querySelector('.modal.open');
      if (openModal) {
        openModal.querySelector('[data-close], #closeQrScanner')?.click();
        return;
      }
      if (canGoBack) window.history.back();
      else await appPlugin.exitApp();
    });
  }

  window.GSMobileNav = { render };
  window.addEventListener('DOMContentLoaded', () => {
    render();
    enablePullToRefresh();
    enableAndroidBackButton();
  });
  window.addEventListener('resize', render);
  window.addEventListener('gs:auth-ready', render);
})();
