// Pruebas de humo contra el stack Docker (entra por nginx, como un usuario real).
// Uso: npm run docker:smoke
const fs = require('fs');
const path = require('path');

const env = {};
for (const linea of fs.readFileSync(path.join(__dirname, '..', '.env.docker'), 'utf8').split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const base = `http://localhost:${env.WEB_PORT || 8080}`;
let fallos = 0;
let total = 0;

function check(nombre, esperado, obtenido) {
  total += 1;
  if (String(esperado) === String(obtenido)) console.log(`OK   ${nombre}`);
  else { fallos += 1; console.log(`FAIL ${nombre} (esperado ${esperado}, obtenido ${obtenido})`); }
}

async function http(ruta, opciones = {}) {
  try {
    const r = await fetch(base + ruta, { signal: AbortSignal.timeout(10000), ...opciones });
    return { status: r.status, texto: await r.text() };
  } catch {
    return { status: 0, texto: '' };
  }
}

const json = (cuerpo, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(cuerpo)
});

(async () => {
  check('web sirve /login.html', 200, (await http('/login.html')).status);
  check('ruta limpia /inventario', 200, (await http('/inventario')).status);
  check('API sin token rechazada', 401, (await http('/api/inventory')).status);
  check('demo admin/admin123 rechazado', 401,
    (await http('/api/auth/login', json({ username: 'admin', password: 'admin123' }))).status);
  check('health vía proxy', '{"ok":true,"mode":"supabase"}', (await http('/api/health')).texto);

  const login = await http('/api/auth/login', json({ username: 'admin', password: env.ADMIN_INITIAL_PASSWORD }));
  let token = '';
  try { token = JSON.parse(login.texto).token || ''; } catch { /* sin token */ }
  check('login admin devuelve token', true, token.length > 100);

  const auth = { Authorization: `Bearer ${token}` };
  check('inventario autenticado', 200, (await http('/api/inventory', { headers: auth })).status);
  check('dashboard autenticado', 200, (await http('/api/dashboard', { headers: auth })).status);
  check('auditoría (solo admin)', 200, (await http('/api/audit', { headers: auth })).status);
  check('venta sin stock suficiente', 400, (await http('/api/sales',
    json({ customerId: 1, payment: 'EFECTIVO', items: [{ productId: 1, quantity: 999, price: 1 }] }, auth))).status);

  if (fallos === 0) console.log(`SMOKE OK (${total} comprobaciones)`);
  else { console.log('SMOKE CON FALLOS'); process.exit(1); }
})();
