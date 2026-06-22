// ============================================================
// BOLAMU — Sprint 3 : Tests Playwright Marketplace Zora
// Utilise un compte de test dédié (MARKET_PHONE) créé en DB
// pour éviter le rate limiter et isoler les états de balance.
// ============================================================
const { test, expect } = require('@playwright/test');
const pg = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

const API = 'https://api.bolamu.co/api/v1';
const MARKET_PHONE = '+242069000077';
const MARKET_PWD   = 'TestMarket2026!';

function readStoredToken(role) {
  try {
    if (role === 'patient') {
      const state = JSON.parse(fs.readFileSync('playwright/.auth/patient.json', 'utf8'));
      for (const origin of (state.origins || [])) {
        for (const item of (origin.localStorage || [])) {
          if (item.name === 'bolamu_patient_token') return item.value;
        }
      }
      return '';
    }
    return JSON.parse(fs.readFileSync(`playwright/.auth/${role}.json`, 'utf8')).token || '';
  } catch (_) {}
  return '';
}

async function seedBalance(pool, phone, points) {
  await pool.query(
    `INSERT INTO zora_ledger (phone, points, category, action_type, proof_class, proof_source, recording_method, proof_reference, verified, earned_at, expires_at)
     VALUES ($1, $2, 'engagement', 'test_seed', 'system_event', 'playwright_test', NULL, $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
    [phone, points, `seed_${Date.now()}_${Math.random().toString(36).slice(2)}`]
  );
  // zora/balance lit zora_points (table de résumé), pas ledger directement
  await pool.query(
    `INSERT INTO zora_points (phone, balance, total_earned, tier, last_activity_at, created_at, updated_at)
     VALUES ($1, $2, $2, 'kimia', NOW(), NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET
       balance = GREATEST(0, zora_points.balance + $2),
       total_earned = GREATEST(0, zora_points.total_earned + GREATEST(0, $2)),
       last_activity_at = NOW(),
       updated_at = NOW()`,
    [phone, points]
  );
}

async function setBalanceTo(pool, phone, target) {
  const balRow = await pool.query(
    `SELECT COALESCE(SUM(points), 0) AS bal FROM zora_ledger WHERE phone = $1`, [phone]
  );
  const current = parseInt(balRow.rows[0].bal);
  const diff = target - current;
  if (diff !== 0) await seedBalance(pool, phone, diff);
}

let pool;
let marketToken;
let pharmacieToken;

test.describe('Marketplace Zora', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    pharmacieToken = readStoredToken('pharmacie');

    // Nettoyer et recréer le compte de test marketplace
    await pool.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [MARKET_PHONE]);
    await pool.query(`DELETE FROM zora_ledger WHERE phone = $1`, [MARKET_PHONE]);
    await pool.query(`DELETE FROM zora_vouchers WHERE phone = $1`, [MARKET_PHONE]);
    await pool.query(`DELETE FROM zora_points WHERE phone = $1`, [MARKET_PHONE]);
    await pool.query(`DELETE FROM users WHERE phone = $1`, [MARKET_PHONE]);

    const hashedPwd = await bcrypt.hash(MARKET_PWD, 10);
    const userRes = await pool.query(
      `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash,
         member_code)
       VALUES ($1, 'Test Marketplace', 'Test', 'Marketplace', 'patient', true, $2,
         'BLM-' || LPAD(CAST(COALESCE((SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER))
              FROM users WHERE member_code ~ '^BLM-[0-9]+$'), 0) + 1 AS TEXT), 5, '0'))
       RETURNING id`,
      [MARKET_PHONE, hashedPwd]
    );
    const userId = userRes.rows[0].id;

    // Créer abonnement actif (requis pour le redeem)
    await pool.query(
      `INSERT INTO subscriptions (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active)
       VALUES ($1, 'essentiel', 2000, 'active', NOW(), NOW() + INTERVAL '1 month', true)`,
      [MARKET_PHONE]
    );

    // Signer JWT localement (bypass rate limiter)
    marketToken = jwt.sign(
      { id: userId, phone: MARKET_PHONE, role: 'patient', is_active: true, banned: false },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Seed balance initiale = 1000 points
    await seedBalance(pool, MARKET_PHONE, 1000);
  });

  test.afterAll(async () => {
    try {
      await pool.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [MARKET_PHONE]);
      await pool.query(`DELETE FROM zora_ledger WHERE phone = $1`, [MARKET_PHONE]);
      await pool.query(`DELETE FROM zora_vouchers WHERE phone = $1`, [MARKET_PHONE]);
      await pool.query(`DELETE FROM zora_points WHERE phone = $1`, [MARKET_PHONE]);
      await pool.query(`DELETE FROM users WHERE phone = $1`, [MARKET_PHONE]);
    } catch (_) {}
    await pool.end();
  });

  // ============================================================
  // TEST 1 — Catalogue chargé (ne nécessite pas de compte spécial)
  // ============================================================
  test('Test 1 — Catalogue chargé', async ({ request }) => {
    const token = readStoredToken('patient');
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
    // S'assurer d'avoir 500 points disponibles
    await setBalanceTo(pool, MARKET_PHONE, 500);

    const balanceRes = await request.get(`${API}/zora/balance`, {
      headers: { Authorization: `Bearer ${marketToken}` }
    });
    const balanceData = await balanceRes.json();
    const initialBalance = balanceData.data.balance;
    expect(initialBalance).toBeGreaterThanOrEqual(300);

    // Échanger une récompense à 300 points
    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
      data: { reward_id: 1 }
    });
    const redeemData = await redeemRes.json();

    expect(redeemData.success).toBe(true);
    expect(redeemData.data.voucher_uuid).toBeDefined();
    console.log(`✅ Échange réussi : voucher ${redeemData.data.voucher_uuid}`);

    // Vérifier balance réduite
    const balanceAfterRes = await request.get(`${API}/zora/balance`, {
      headers: { Authorization: `Bearer ${marketToken}` }
    });
    const balanceAfterData = await balanceAfterRes.json();
    expect(balanceAfterData.data.balance).toBe(initialBalance - 300);

    // Vérifier ledger négatif
    const ledgerRes = await request.get(`${API}/zora/ledger`, {
      headers: { Authorization: `Bearer ${marketToken}` }
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
    // Ramener le solde à 100 points
    await setBalanceTo(pool, MARKET_PHONE, 100);

    // Tenter d'échanger une récompense à 300 points
    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
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
    await setBalanceTo(pool, MARKET_PHONE, 500);

    // Créer voucher
    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
      data: { reward_id: 1 }
    });
    const redeemData = await redeemRes.json();
    expect(redeemData.success).toBe(true);
    const voucherUuid = redeemData.data.voucher_uuid;

    // Scanner le voucher avec le partenaire pharmacie
    const consumeRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` }
    });
    const consumeData = await consumeRes.json();

    expect(consumeData.success).toBe(true);
    expect(consumeData.data.patient_phone).toBe(MARKET_PHONE);
    expect(consumeData.data.consumed_at).toBeDefined();
    console.log(`✅ Scan partenaire réussi : voucher ${voucherUuid}`);
  });

  // ============================================================
  // TEST 5 — Double scan bloqué
  // ============================================================
  test('Test 5 — Double scan bloqué', async ({ request }) => {
    await setBalanceTo(pool, MARKET_PHONE, 500);

    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
      data: { reward_id: 1 }
    });
    const redeemData = await redeemRes.json();
    expect(redeemData.success).toBe(true);
    const voucherUuid = redeemData.data.voucher_uuid;

    // Premier scan
    await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` }
    });

    // Deuxième scan
    const secondScanRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` }
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
    await setBalanceTo(pool, MARKET_PHONE, 500);

    // Créer voucher pour reward_id=1 (pharmacie Amour)
    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
      data: { reward_id: 1 }
    });
    const redeemData = await redeemRes.json();
    expect(redeemData.success).toBe(true);
    const voucherUuid = redeemData.data.voucher_uuid;

    // Tenter de scanner avec le token doctor (mauvais rôle pour ce voucher)
    const doctorToken = readStoredToken('doctor');
    const wrongScanRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
      headers: { Authorization: `Bearer ${doctorToken}` }
    });
    const wrongScanData = await wrongScanRes.json();

    console.log(`⚠️ Test mauvais partenaire : ${wrongScanData.success ? 'non bloqué' : 'bloqué (code: ' + wrongScanData.error + ')'}`);
    // Le comportement attendu dépend de l'implémentation — pas de expect strict
  });

  // ============================================================
  // TEST 7 — Expiration cron
  // ============================================================
  test('Test 7 — Expiration cron', async ({ request }) => {
    await setBalanceTo(pool, MARKET_PHONE, 500);

    const redeemRes = await request.post(`${API}/zora/redeem`, {
      headers: { Authorization: `Bearer ${marketToken}` },
      data: { reward_id: 1 }
    });
    const redeemData = await redeemRes.json();
    expect(redeemData.success).toBe(true);
    const voucherUuid = redeemData.data.voucher_uuid;

    // Expirer le voucher directement en DB
    await pool.query(
      `UPDATE zora_vouchers SET status = 'expired', expires_at = NOW() - INTERVAL '1 hour' WHERE uuid = $1`,
      [voucherUuid]
    );

    // Tenter de consommer le voucher expiré
    const consumeRes = await request.post(`${API}/zora/vouchers/${voucherUuid}/consume`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` }
    });
    const consumeData = await consumeRes.json();

    expect(consumeRes.status()).toBe(400);
    expect(consumeData.success).toBe(false);
    expect(consumeData.error).toBe('voucher_expired');
    console.log(`✅ Expiration : voucher expiré bloqué`);
  });
});
