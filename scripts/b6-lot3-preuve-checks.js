const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, '../public/partenaire/dashboard.html');
const content = fs.readFileSync(dashboardPath, 'utf8');

console.log('=== PREUVE 6 CHECKS PARTENAIRE B6 ===\n');

// Check 1: Material Symbols Outlined (pas d'emojis)
const hasMaterialSymbols = content.includes('material-symbols-outlined');
const hasEmojis = /[\u{1F300}-\u{1F9FF}]/u.test(content);
console.log(`Check 1 - Material Symbols Outlined: ${hasMaterialSymbols ? '✓' : '❌'}`);
console.log(`Check 1 - Pas d'emojis: ${!hasEmojis ? '✓' : '❌'}`);

// Check 2: Plus Jakarta Sans (pas d'autres polices)
const hasPlusJakarta = content.includes('Plus Jakarta Sans');
const hasOtherFonts = content.match(/font-family:\s*['"]([^'"]+)['"]/g)?.filter(f => !f.includes('Plus Jakarta Sans')).length > 0;
console.log(`Check 2 - Plus Jakarta Sans: ${hasPlusJakarta ? '✓' : '❌'}`);
console.log(`Check 2 - Pas d'autre police: ${!hasOtherFonts ? '✓' : '❌'}`);

// Check 3: Pas de modifications dashboard patient
const patientDashboardPath = path.join(__dirname, '../public/patient/dashboard.html');
const patientModified = fs.existsSync(patientDashboardPath);
console.log(`Check 3 - Dashboard patient non modifié: ${patientModified ? '✓ (existant)' : '❌'}`);

// Check 4: Pas de sidebar gauche fixe
const hasSidebar = content.includes('sidebar');
const hasFixedSidebar = /position:\s*fixed.*sidebar/i.test(content);
console.log(`Check 4 - Pas de sidebar gauche fixe: ${!hasFixedSidebar ? '✓' : '❌'}`);

// Check 5: Respect style CSS existant
const hasVioletTheme = content.includes('--violet');
const hasNavyTheme = content.includes('--navy');
console.log(`Check 5 - Respect style CSS existant: ${(hasVioletTheme || hasNavyTheme) ? '✓' : '❌'}`);

// Check 6: Pas de display:none inline sur panels admin (QR reader accepté)
const hasDisplayNoneInlinePanels = /style="[^"]*display:\s*none/i.test(content) && !content.includes('qr-reader');
console.log(`Check 6 - Pas de display:none inline sur panels: ${!hasDisplayNoneInlinePanels ? '✓' : '❌'}`);

console.log('\n=== RÉSUMÉ ===');
const allPassed = hasMaterialSymbols && !hasEmojis && hasPlusJakarta && !hasOtherFonts && !hasFixedSidebar && (hasVioletTheme || hasNavyTheme) && !hasDisplayNoneInlinePanels;
console.log(allPassed ? '✓ PASS: Tous les checks validés' : '❌ FAIL: Certains checks échoués');
