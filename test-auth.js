const r = await fetch('https://bolamu.co/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+242069735418', password: 'TestNouveau2026!' })
});
console.log('STATUS:', r.status);
console.log('BODY:', await r.text());
