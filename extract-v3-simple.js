const fs = require('fs');

const content = fs.readFileSync('public/patient/Bolamu Dashboard V3.html', 'utf8');
const startIdx = content.indexOf('<script type="__bundler/template">') + '<script type="__bundler/template">'.length;
const endIdx = content.lastIndexOf('</script>');
const templateStr = content.substring(startIdx, endIdx).trim();
const template = templateStr.replace(/^"/, '').replace(/"$/, '');

try {
  const decoded = Buffer.from(template, 'base64').toString('utf8');
  fs.writeFileSync('public/patient/dashboard-v3-extracted.html', decoded);
  console.log('Extrait:', decoded.length, 'caractères');
} catch (e) {
  console.error('Erreur decode:', e.message);
  console.log('Template length:', template.length);
  console.log('Template start:', template.substring(0, 100));
}
