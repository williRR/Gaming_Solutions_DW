const c = require('node:crypto');
const hex = n => c.randomBytes(n).toString('hex');
const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64url');

const pgrstSecret = hex(32); // 64 caracteres (PostgREST exige >= 32)
const now = Math.floor(Date.now() / 1000);
const head = b64u({ alg: 'HS256', typ: 'JWT' });
const body = b64u({ role: 'service_role', iss: 'gs-local', iat: now, exp: now + 10 * 365 * 24 * 3600 });
const sig = c.createHmac('sha256', pgrstSecret).update(`${head}.${body}`).digest('base64url');

const content = `# Generado ${new Date().toISOString()} - NO versionar
COMPOSE_PROJECT_NAME=gaming-solutions
POSTGRES_USER=gs_owner
POSTGRES_PASSWORD=${hex(16)}
POSTGRES_DB=gamingsolutions
AUTHENTICATOR_PASSWORD=${hex(16)}
PGRST_JWT_SECRET=${pgrstSecret}
SERVICE_ROLE_KEY=${head}.${body}.${sig}
JWT_SECRET=${hex(32)}
ADMIN_INITIAL_PASSWORD=${hex(8)}
AUTH_DEMO_MODE=false
WEB_PORT=8080
`;

// --write crea .env.docker en ASCII/LF (evita el UTF-16 de ">" en PowerShell).
if (process.argv.includes('--write')) {
  const fs = require('node:fs');
  const target = require('node:path').join(__dirname, '..', '.env.docker');
  if (fs.existsSync(target) && !process.argv.includes('--force')) {
    console.error('.env.docker ya existe. Regenerarlo cambia las contraseñas y rompe el volumen actual de la BD.\n' +
      'Si lo necesitas: npm run docker:reset (borra el volumen y regenera).');
    process.exit(1);
  }
  fs.writeFileSync(target, content, { encoding: 'ascii' });
  console.log('.env.docker creado');
} else {
  process.stdout.write(content);
}
