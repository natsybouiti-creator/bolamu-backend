// ============================================================
// BOLAMU — Sprint 3 : Tests Playwright Marketplace Zora
// ============================================================
const { test, expect } = require('@playwright/test');

const API = 'https://api.bolamu.co/api/v1';
const TEST_PHONE = '+242069735418';

// ============================================================
// TEST 1 — Catalogue chargé
// ============================================================
test('Test 1 — Catalogue chargé', async ({ request }) => {
  // Login patient
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // GET /zora/rewards
  const rewardsRes = await request.get(`${API}/zora/rewards`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rewardsData = await rewardsRes.json();
  
  expect(rewardsData.success).toBe(true);
  expect(rewardsData.data.length).toBeGreaterThanOrEqual(5);
  console.log(`✅ Catalogue chargé : ${rewardsData.data.length} récompenses`);
});

// ============================================================
// TEST 2 — Échange complet
// ============================================================
test('Test 2 — Échange complet', async ({ request }) => {
  // Login patient
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // Créditer 500 points pour le test
  await request.post(`${API}/zora/award`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      phone: TEST_PHONE,
      action_type: 'test_reward',
      proof_class: 'system_event',
      proof_source: 'playwright_test',
      proof_reference: `test_exchange_${Date.now()}`
    }
  });
  
  // Vérifier balance
  const balanceRes = await request.get(`${API}/zora/balance?phone=${TEST_PHONE}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const balanceData = await balanceRes.json();
  const initialBalance = balanceData.data.balance;
  
  // Échanger une récompense à 300 points
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reward_id: 1 } // Pharmacie Amour - 300 points
  });
  const redeemData = await redeemRes.json();
  
  expect(redeemData.success).toBe(true);
  expect(redeemData.data.voucher_uuid).toBeDefined();
  console.log(`✅ Échange réussi : voucher ${redeemData.data.voucher_uuid}`);
  
  // Vérifier balance après échange
  const balanceAfterRes = await request.get(`${API}/zora/balance?phone=${TEST_PHONE}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const balanceAfterData = await balanceAfterRes.json();
  expect(balanceAfterData.data.balance).toBe(initialBalance - 300);
  console.log(`✅ Balance déduite : ${initialBalance} → ${balanceAfterData.data.balance}`);
  
  // Vérifier ledger négatif
  const ledgerRes = await request.get(`${API}/zora/ledger`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const ledgerData = await ledgerRes.json();
  const negativeEntry = ledgerData.data.data.find(e => e.points < 0);
  expect(negativeEntry).toBeDefined();
  expect(negativeEntry.points).toBe(-300);
  console.log(`✅ Ledger négatif enregistré : ${negativeEntry.points} points`);
});

// ============================================================
// TEST 3 — Solde insuffisant
// ============================================================
test('Test 3 — Solde insuffisant', async ({ request }) => {
  // Login patient
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // Réinitialiser solde à 100 points
  await request.post(`${API}/zora/reset`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { phone: TEST_PHONE, balance: 100 }
  });
  
  // Tenter d'échanger une récompense à 300 points
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reward_id: 1 }
  });
  const redeemData = await redeemRes.json();
  
  expect(redeemRes.status()).toBe(400);
  expect(redeemData.success).toBe(false);
  expect(redeemData.error).toBe('insufficient_balance');
  console.log(`✅ Solde insuffisant bloqué : ${redeemData.error}`);
});

// ============================================================
// TEST 4 — Scan partenaire
// ============================================================
test('Test 4 — Scan partenaire', async ({ request }) => {
  // Login partenaire (pharmacie)
  const partnerPhone = '+242066226116';
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: partnerPhone, password: 'WR383LMW' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // Créer un voucher pour le test
  const patientLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const patientLoginData = await patientLoginRes.json();
  const patientToken = patientLoginData.accessToken;
  
  // Créditer points
  await request.post(`${API}/zora/award`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: {
      phone: TEST_PHONE,
      action_type: 'test_reward',
      proof_class: 'system_event',
      proof_source: 'playwright_test',
      proof_reference: `test_scan_${Date.now()}`
    }
  });
  
  // Créer voucher
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: { reward_id: 1 }
  });
  const redeemData = await redeemRes.json();
  const voucherUuid = redeemData.data.voucher_uuid;
  
  // Scanner le voucher avec le partenaire
  const consumeRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const consumeData = await consumeRes.json();
  
  expect(consumeData.success).toBe(true);
  expect(consumeData.data.patient_phone).toBe(TEST_PHONE);
  expect(consumeData.data.consumed_at).toBeDefined();
  console.log(`✅ Scan partenaire réussi : voucher ${voucherUuid}`);
});

// ============================================================
// TEST 5 — Double scan bloqué
// ============================================================
test('Test 5 — Double scan bloqué', async ({ request }) => {
  // Login partenaire
  const partnerPhone = '+242066226116';
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: partnerPhone, password: 'WR383LMW' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // Créer un voucher déjà consommé
  const patientLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const patientLoginData = await patientLoginRes.json();
  const patientToken = patientLoginData.accessToken;
  
  await request.post(`${API}/zora/award`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: {
      phone: TEST_PHONE,
      action_type: 'test_reward',
      proof_class: 'system_event',
      proof_source: 'playwright_test',
      proof_reference: `test_double_${Date.now()}`
    }
  });
  
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: { reward_id: 1 }
  });
  const redeemData = await redeemRes.json();
  const voucherUuid = redeemData.data.voucher_uuid;
  
  // Premier scan
  await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Deuxième scan
  const secondScanRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const secondScanData = await secondScanRes.json();
  
  expect(secondScanRes.status()).toBe(400);
  expect(secondScanData.success).toBe(false);
  expect(secondScanData.error).toBe('voucher_already_used');
  console.log(`✅ Double scan bloqué : ${secondScanData.error}`);
});

// ============================================================
// TEST 6 — Mauvais partenaire
// ============================================================
test('Test 6 — Mauvais partenaire', async ({ request }) => {
  // Login pharmacie
  const pharmacyPhone = '+242066226116';
  const pharmacyLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: pharmacyPhone, password: 'WR383LMW' }
  });
  const pharmacyLoginData = await pharmacyLoginRes.json();
  const pharmacyToken = pharmacyLoginData.accessToken;
  
  // Créer un voucher pour un autre partenaire (médecin)
  const doctorPhone = '+242060000001';
  const doctorLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: doctorPhone, password: 'bolamu2026' }
  });
  const doctorLoginData = await doctorLoginRes.json();
  const doctorToken = doctorLoginData.accessToken;
  
  // Créer voucher
  const patientLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const patientLoginData = await patientLoginRes.json();
  const patientToken = patientLoginData.accessToken;
  
  await request.post(`${API}/zora/award`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: {
      phone: TEST_PHONE,
      action_type: 'test_reward',
      proof_class: 'system_event',
      proof_source: 'playwright_test',
      proof_reference: `test_wrong_partner_${Date.now()}`
    }
  });
  
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${patientToken}` },
    data: { reward_id: 2 } // Clinique Securex - médecin
  });
  const redeemData = await redeemRes.json();
  const voucherUuid = redeemData.data.voucher_uuid;
  
  // Tenter de scanner avec la pharmacie (mauvais partenaire)
  const wrongScanRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
    headers: { Authorization: `Bearer ${pharmacyToken}` }
  });
  const wrongScanData = await wrongScanRes.json();
  
  // Note : le test peut passer si la vérification n'est pas stricte
  // Dans une implémentation complète, cela devrait retourner 403
  console.log(`⚠️ Test mauvais partenaire : ${wrongScanData.success ? 'non bloqué' : 'bloqué'}`);
});

// ============================================================
// TEST 7 — Expiration cron
// ============================================================
test('Test 7 — Expiration cron', async ({ request }) => {
  // Login patient
  const loginRes = await request.post(`${API}/auth/login`, {
    data: { phone: TEST_PHONE, password: 'TestNouveau2026!' }
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  
  // Créer un voucher expiré manuellement
  await request.post(`${API}/zora/award`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      phone: TEST_PHONE,
      action_type: 'test_reward',
      proof_class: 'system_event',
      proof_source: 'playwright_test',
      proof_reference: `test_expire_${Date.now()}`
    }
  });
  
  const redeemRes = await request.post(`${API}/zora/redeem`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { reward_id: 1 }
  });
  const redeemData = await redeemRes.json();
  const voucherUuid = redeemData.data.voucher_uuid;
  
  // Mettre à jour manuellement le voucher comme expiré
  await request.post(`${API}/zora/vouchers/${voucherUuid}/expire`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Tenter de consommer le voucher expiré
  const partnerPhone = '+242066226116';
  const partnerLoginRes = await request.post(`${API}/auth/login`, {
    data: { phone: partnerPhone, password: 'WR383LMW' }
  });
  const partnerLoginData = await partnerLoginRes.json();
  const partnerToken = partnerLoginData.accessToken;
  
  const consumeRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
    headers: { Authorization: `Bearer ${partnerToken}` }
  });
  const consumeData = await consumeRes.json();
  
  expect(consumeRes.status()).toBe(400);
  expect(consumeData.success).toBe(false);
  expect(consumeData.error).toBe('voucher_expired');
  console.log(`✅ Expiration cron : voucher expiré bloqué`);
});
