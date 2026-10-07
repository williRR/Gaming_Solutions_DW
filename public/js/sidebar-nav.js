(function () {
  const aliases = {
    '/': '/dashboard',
    '/index.html': '/dashboard',
    '/inventory.html': '/inventario',
    '/catalog.html': '/catalogo',
    '/clients.html': '/clientes',
    '/operations.html': '/ventas',
    '/audit.html': '/auditoria'
  };

  function markActive() {
    const currentPath = aliases[window.location.pathname] || window.location.pathname;
    document.querySelectorAll('.sidebar nav a[href]').forEach(link => {
      const linkPath = new URL(link.href, window.location.origin).pathname;
      link.classList.toggle('active', linkPath === currentPath);
    });
  }

  window.GSSidebarNav = { markActive };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', markActive, { once: true });
  else markActive();
})();
