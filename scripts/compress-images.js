const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public/images/landing');
const files = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

(async () => {
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.size > 300000) {
      const outPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '_compressed.jpg');
      await sharp(filePath)
        .resize(1200, null, { withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toFile(outPath);
      fs.renameSync(outPath, filePath);
      console.log(`✓ ${file} : ${Math.round(stat.size/1024)}KB → ${Math.round(fs.statSync(filePath).size/1024)}KB`);
    }
  }
  console.log('Terminé.');
})();
