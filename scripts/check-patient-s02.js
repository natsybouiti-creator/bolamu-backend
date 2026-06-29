const fetch = require('node-fetch');

async function checkPatient() {
  const adminPhone = '+242060000099';
  const adminPassword = 'bolamu2026';
  const patientPhone = '+242069735418';

  // Login admin
  const adminRes = await fetch('https://api.bolamu.co/api/v1/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: adminPhone, password: adminPassword })
  });
  const adminData = await adminRes.json();
  
  if (!adminData.success) {
    console.log('❌ Login admin échoué:', adminData.message);
    return;
  }
  
  console.log('✅ Admin connecté');
  const adminToken = adminData.accessToken;

  // Vérifier patient via admin profile
  const profileRes = await fetch(`https://api.bolamu.co/api/v1/admin/users/${encodeURIComponent(patientPhone)}/profile`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const profileData = await profileRes.json();
  
  console.log('📋 Patient profile:', JSON.stringify(profileData, null, 2));

  // Essayer login patient
  const loginRes = await fetch('https://api.bolamu.co/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: patientPhone, password: 'TestNouveau2026!' })
  });
  const loginData = await loginRes.json();
  
  console.log('🔐 Login patient (TestNouveau2026!):', JSON.stringify(loginData, null, 2));

  // Essayer avec bolamu2026
  const loginRes2 = await fetch('https://api.bolamu.co/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: patientPhone, password: 'bolamu2026' })
  });
  const loginData2 = await loginRes2.json();
  
  console.log('🔐 Login patient (bolamu2026):', JSON.stringify(loginData2, null, 2));
}

checkPatient().catch(console.error);
