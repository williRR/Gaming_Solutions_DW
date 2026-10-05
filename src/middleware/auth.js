const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const TOKEN_EXPIRATION = '8h';
const ROLE_ALIASES = new Map([
  ['administrador', 'Administrador'],
  ['administrador general', 'Administrador'],
  ['admin', 'Administrador'],
  ['ventas', 'Ventas'],
  ['vendedor / cajero', 'Ventas'],
  ['vendedor/cajero', 'Ventas'],
  ['almacen', 'Almacen'],
  ['almacén', 'Almacen'],
  ['técnico certificador', 'Almacen'],
  ['tecnico certificador', 'Almacen']
]);

let authConfig = {
  demoMode: false,
  query: null,
  demoUsers: [],
  secret: process.env.JWT_SECRET
};

function configureAuth(config) {
  authConfig = { ...authConfig, ...config };
  if (!authConfig.secret) {
    if (!authConfig.demoMode) throw new Error('JWT_SECRET es obligatorio fuera de DEMO_MODE');
    authConfig.secret = 'gaming-solutions-demo-secret-change-me';
  }
}

function normalizeRole(role) {
  const value = String(role || '').trim();
  return ROLE_ALIASES.get(value.toLowerCase()) || value;
}

function issueToken(user) {
  const payload = {
    id_usuario: Number(user.id_usuario),
    nombre: user.nombre,
    rol: normalizeRole(user.rol)
  };
  return jwt.sign(payload, authConfig.secret, { expiresIn: TOKEN_EXPIRATION });
}

function authenticateToken(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
  try {
    req.user = jwt.verify(token, authConfig.secret);
    return next();
  } catch (error) {
    return res.status(401).json({
      error: error.name === 'TokenExpiredError' ? 'La sesión ha expirado' : 'Token inválido'
    });
  }
}

function requireRole(roles) {
  const allowedRoles = new Set(roles.map(normalizeRole));
  return (req, res, next) => {
    if (!req.user || !allowedRoles.has(normalizeRole(req.user.rol))) {
      return res.status(403).json({ error: 'No tienes permisos para esta operación' });
    }
    return next();
  };
}

async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  return bcrypt.compare(String(password), String(storedHash));
}

async function loginHandler(req, res) {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

  try {
    let user;
    if (authConfig.demoMode) {
      user = authConfig.demoUsers.find(item => item.username.toLowerCase() === username.toLowerCase());
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }
    } else {
      const rows = await authConfig.query(
        `SELECT u.ID_USUARIO AS "id_usuario",
                u.NOMBRE_COMPLETO AS "nombre",
                u.CLAVE_HASH AS "passwordHash",
                r.NOMBRE_ROL AS "rol"
           FROM USUARIOS u
           JOIN ROLES r ON r.ID_ROL = u.ID_ROL
          WHERE LOWER(u.USERNAME) = LOWER(:username)
            AND u.ACTIVO = 'S'`,
        { username }
      );
      user = rows[0];
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
      }
    }

    const safeUser = {
      id_usuario: Number(user.id_usuario),
      nombre: user.nombre,
      rol: normalizeRole(user.rol)
    };
    return res.json({ token: issueToken(safeUser), user: safeUser, expiresIn: TOKEN_EXPIRATION });
  } catch (error) {
    console.error('Error de autenticación:', error);
    return res.status(500).json({ error: 'No se pudo procesar el inicio de sesión' });
  }
}

function meHandler(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  configureAuth,
  authenticateToken,
  requireRole,
  loginHandler,
  meHandler,
  normalizeRole,
  issueToken,
  TOKEN_EXPIRATION
};
