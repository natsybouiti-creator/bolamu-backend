const fs = require('fs');

// Lire les deux fichiers
const login = fs.readFileSync('public/admin/login.html', 'utf8');
const dashboard = fs.readFileSync('public/admin/dashboard.html', 'utf8');

// Trouver les clés localStorage dans login.html
const loginKeys = [...login.matchAll(/localStorage\.setItem\(['"`]([^'"`]+)['"`]/g)]
  .map(m => m[1]);
console.log('Login sauvegarde:', loginKeys);

// Trouver les clés localStorage dans dashboard.html
const dashKeys = [...dashboard.matchAll(/localStorage\.getItem\(['"`]([^'"`]+)['"`]/g)]
  .map(m => m[1]);
console.log('Dashboard lit:', dashKeys);