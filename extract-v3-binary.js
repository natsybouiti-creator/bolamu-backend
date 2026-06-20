const fs = require('fs');

// Lire le fichier en binaire
const buffer = fs.readFileSync('public/patient/Bolamu Dashboard V3.html');
const content = buffer.toString('utf8');

const startMarker = '<script type="__bundler/template">';
const endMarker = '</script>';

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
  console.log('Marker start non trouvé');
  process.exit(1);
}

const startContent = startIdx + startMarker.length;
const endIdx = content.indexOf(endMarker, startContent);

if (endIdx === -1) {
  console.log('Marker end non trouvé');
  process.exit(1);
}

const templateStr = content.substring(startContent, endIdx).trim();
// Enlever les guillemets de début et fin
const template = templateStr.replace(/^"/, '').replace(/"$/, '');

console.log('Template raw length:', template.length);
console.log('Template start (200 chars):', template.substring(0, 200));

try {
  const decoded = Buffer.from(template, 'base64').toString('utf8');
  console.log('Decoded length:', decoded.length);
  fs.writeFileSync('public/patient/dashboard-v3-extracted.html', decoded);
  console.log('Extrait avec succès');
} catch (e) {
  console.error('Erreur decode:', e.message);
  // Essayer sans base64
  fs.writeFileSync('public/patient/dashboard-v3-extracted-raw.html', template);
  console.log('Sauvegardé raw (sans decode)');
}
