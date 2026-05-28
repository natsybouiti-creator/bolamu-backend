const fs = require('fs');

let c = fs.readFileSync('src/controllers/auth.controller.js', 'utf8');
c = c.replace(
  "const ACCESS_TOKEN_EXPIRES = '15m';",
  "const ACCESS_TOKEN_EXPIRES = '7d';"
);
fs.writeFileSync('src/controllers/auth.controller.js', c);
console.log('Token expiry : 15m → 7d ✅');