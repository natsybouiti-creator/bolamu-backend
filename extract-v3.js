const fs = require('fs');

const content = fs.readFileSync('public/patient/Bolamu Dashboard V3.html', 'utf8');
const match = content.match(/<script type="__bundler\/template">(.+?)<\/script>/s);

if (match) {
  try {
    const template = JSON.parse(match[1]);
    // Le template est déjà en base64 mais pas gzip
    const decompressed = Buffer.from(template, 'base64').toString('utf8');
    fs.writeFileSync('public/patient/dashboard-v3-extracted.html', decompressed);
    console.log('Template extrait dans dashboard-v3-extracted.html');
    console.log('Taille:', decompressed.length, 'caractères');
  } catch (e) {
    console.error('Erreur:', e.message);
  }
} else {
  console.log('Template non trouvé');
}
