(function () {
  const permissions = {
    Administrador: ['dashboard', 'inventoryRead', 'inventoryWrite', 'sales', 'purchases', 'audit', 'clients', 'costs'],
    Ventas: ['dashboard', 'inventoryRead', 'sales', 'clients'],
    Almacen: ['dashboard', 'inventoryRead', 'inventoryWrite', 'purchases', 'costs']
  };

  function applyRoleUI() {
    const user = window.GSAuth?.getUser();
    const role = user?.rol;
    const allowed = new Set(permissions[role] || []);
    document.querySelectorAll('[data-role]').forEach(element => {
      const roles = element.dataset.role.split(',').map(value => value.trim());
      element.hidden = !roles.includes(role);
    });
    document.querySelectorAll('[data-permission]').forEach(element => {
      element.hidden = !allowed.has(element.dataset.permission);
      if (element.hidden) {
        element.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = true; });
      }
    });
    document.querySelectorAll('[data-user-name]').forEach(element => { element.textContent = user?.nombre || ''; });
    document.querySelectorAll('[data-user-role]').forEach(element => { element.textContent = role || ''; });
  }

  window.GSRbac = { applyRoleUI };
  window.addEventListener('DOMContentLoaded', applyRoleUI);
  window.addEventListener('gs:auth-ready', applyRoleUI);
})();
