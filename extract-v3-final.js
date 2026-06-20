const fs = require('fs');

const content = fs.readFileSync('public/patient/Bolamu Dashboard V3.html', 'utf8');
const startIdx = content.indexOf('<script type="__bundler/template">') + '<script type="__bundler/template">'.length;
const endIdx = content.lastIndexOf('</script>');
const templateStr = content.substring(startIdx, endIdx).trim();

// C'est une chaîne JSON avec des guillemets, donc on la parse
const template = JSON.parse(templateStr);

fs.writeFileSync('public/patient/dashboard-v3-extracted.html', template);
console.log('Extrait:', template.length, 'caractères');
