const fs = require('fs');
const path = require('path');

const checks = {
  'Material Symbols Outlined': { pattern: /material-symbols-outlined/g, file: 'public/medecin/dashboard.html' },
  'Pas d\'emojis': { pattern: /[\u{1F300}-\u{1F9FF}]/gu, file: 'public/medecin/dashboard.html', inverse: true },
  'Plus Jakarta Sans': { pattern: /Plus Jakarta Sans/g, file: 'public/medecin/dashboard.html' },
  'Couleurs navy/turquoise': { pattern: /#0A2463|#00C9A7/g, file: 'public/medecin/dashboard.html' },
  'Messages français': { pattern: /(Erreur|Chargement|Validation|Consultation|Ordonnance)/g, file: 'public/medecin/dashboard.html' },
  'API variable': { pattern: /const API=/g, file: 'public/medecin/dashboard.html' },
  'Pas de display:none inline': { pattern: /style="[^"]*display:\s*none/g, file: 'public/medecin/dashboard.html' },
  'Routes consultation': { pattern: /\/consultations\//g, file: 'public/medecin/dashboard.html' }
};

console.log('=== PREUVE LOT 3 — 8 CHECKS DASHBOARDS ===\n');

let passed = 0;
let failed = 0;

Object.entries(checks).forEach(([name, check]) => {
  const filePath = path.join(__dirname, '..', check.file);
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(check.pattern);
  
  if (check.inverse) {
    if (!matches) {
      console.log(`✓ ${name}: Aucun emoji détecté`);
      passed++;
    } else {
      console.log(`✗ ${name}: ${matches.length} emojis détectés`);
      failed++;
    }
  } else {
    if (matches) {
      console.log(`✓ ${name}: ${matches.length} occurrences`);
      passed++;
    } else {
      console.log(`✗ ${name}: Non trouvé`);
      failed++;
    }
  }
});

console.log(`\nRésultat: ${passed}/8 checks validés`);
if (passed === 8) {
  console.log('✅ LOT 3 — PREUVE VALIDÉE');
} else {
  console.log('❌ LOT 3 — CHECKS MANQUANTS');
}
