const fs = require('fs');

// Fix 1: corriger les chemins dans clearing.routes.js
let c = fs.readFileSync('src/routes/clearing.routes.js', 'utf8');
c = c.replace("require('../../middleware/auth.middleware')", "require('../middleware/auth.middleware')");
c = c.replace("require('../../scripts/clearing-mensuel')", "require('../scripts/clearing-mensuel')");
fs.writeFileSync('src/routes/clearing.routes.js', c);
console.log('clearing.routes.js: chemins corrigés');

// Fix 2: créer le script clearing-mensuel stub
if (!fs.existsSync('src/scripts')) fs.mkdirSync('src/scripts');
const stub = `
const db = require('../config/db');
async function runClearing() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  console.log('[CLEARING] Calcul CDR pour', periodStart.toISOString().slice(0,10), '-', periodEnd.toISOString().slice(0,10));
  // TODO: logique de calcul CDR par zone/partenaire
  return { success: true };
}
module.exports = { runClearing };
`;
fs.writeFileSync('src/scripts/clearing-mensuel.js', stub);
console.log('clearing-mensuel.js: créé');

console.log('Tout OK');
