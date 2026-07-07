const jwt = require('jsonwebtoken');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const jwtSecretMatch = envContent.match(/^JWT_SECRET=(.+)$/m);
const jwtSecret = jwtSecretMatch ? jwtSecretMatch[1] : null;

if (!jwtSecret) {
  console.error('JWT_SECRET non trouvé dans .env');
  process.exit(1);
}

const phone = process.argv[2] || '+24265786548';
const token = jwt.sign(
  { id: 0, phone: phone, role: 'patient', is_active: true, banned: false },
  jwtSecret,
  { expiresIn: '15m' }
);

// Vérifier le token immédiatement
try {
  const decoded = jwt.verify(token, jwtSecret);
  console.log(token);
} catch (error) {
  console.error('Token généré invalide:', error.message);
  process.exit(1);
}
