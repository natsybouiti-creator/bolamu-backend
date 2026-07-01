const fs = require('fs');
const filePath = process.argv[2];
try {
  JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log('VALID');
} catch (e) {
  console.log('INVALID: ' + e.message);
}
