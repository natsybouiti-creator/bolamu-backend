const { test, expect } = require('@playwright/test');

const API = 'https://api.bolamu.co/api/v1';
const PATIENT_PHONE = '+242068500028';

test('S02 — Inscription patient via web', async () => {

  // ÉTAPE 1 — Créer le compte patient
  const reg = await fetch(`${API}/auth/register/patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: PATIENT_PHONE,
      first_name: 'Test',
      last_name: 'S02',
      gender: 'M',
      age: 30,
      city: 'Brazzaville',
      cgu_accepted: true,
      trust_score: 30
    })
  }).then(r => r.json());
  console.log('ÉTAPE 1 — Register:', JSON.stringify(reg));
  expect(reg.success).toBe(true);

  // ÉTAPE 2 — Vérifier dossier en attente côté admin
  const adminLogin = await fetch(`${API}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+242060000099', password: 'bolamu2026' })
  }).then(r => r.json());
  const token = adminLogin.accessToken;
  expect(token).toBeTruthy();

  const pending = await fetch(`${API}/admin/pending`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  const found = pending.data?.find(u => u.phone === PATIENT_PHONE);
  console.log('ÉTAPE 2 — Dossier en attente:', found ? '✅' : '❌');
  expect(found).toBeTruthy();

  // ÉTAPE 3 — Admin valide le dossier
  const validate = await fetch(`${API}/admin/validate-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ phone: PATIENT_PHONE, action: 'approve' })
  }).then(r => r.json());
  console.log('ÉTAPE 3 — Validation:', JSON.stringify(validate));
  expect(validate.success).toBe(true);

  // ÉTAPE 4 — Vérifier compte actif en DB
  const userCheck = await fetch(`${API}/admin/users/${PATIENT_PHONE}/profile`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  console.log('ÉTAPE 4 — UserCheck response:', JSON.stringify(userCheck));
  const isActive = userCheck.data?.is_active ?? userCheck.data?.user?.is_active;
  console.log('ÉTAPE 4 — is_active:', isActive);
  expect(isActive).toBe(true);
});
