const fs = require('fs');
const filePath = process.argv[2];
try {
  const verdict = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(verdict.status);
} catch (e) {
  console.log('UNKNOWN');
}
