const fs = require('fs');
const path = process.argv[2];
try {
  const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
  if (data.errors && data.errors.length > 0) {
    console.log('HAS_ERRORS: ' + data.errors[0].message);
  } else {
    console.log('NO_ERRORS');
  }
} catch (e) {
  console.log('READ_ERROR: ' + e.message);
}
