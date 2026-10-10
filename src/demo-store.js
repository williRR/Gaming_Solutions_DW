const fs = require('node:fs');
const path = require('node:path');

const dataDirectory = process.env.VERCEL
  ? path.join('/tmp', 'gaming-solutions-data')
  : path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDirectory, 'demo_db.json');

function loadDemoData(defaults) {
  if (!fs.existsSync(dataFile)) return defaults;
  try {
    const stored = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      inventory: Array.isArray(stored.inventory) ? stored.inventory : defaults.inventory,
      sales: Array.isArray(stored.sales) ? stored.sales : defaults.sales,
      customers: Array.isArray(stored.customers) ? stored.customers : defaults.customers,
      providers: Array.isArray(stored.providers) ? stored.providers : defaults.providers,
      audit: Array.isArray(stored.audit) ? stored.audit : defaults.audit
    };
  } catch (error) {
    throw new Error(`No se pudo leer ${dataFile}: ${error.message}`);
  }
}

function createDemoPersistence(data) {
  if (!fs.existsSync(dataDirectory)) fs.mkdirSync(dataDirectory, { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryFile, dataFile);
}

module.exports = { loadDemoData, createDemoPersistence, dataFile };
