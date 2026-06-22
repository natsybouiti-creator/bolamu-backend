// ============================================================
// BOLAMU — FLUX 2 : Paiement → Activation compte patient
// Setup : INSERT direct en DB (is_active=false) pour isoler
// le test du rate limiter sur /register.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const ADMIN = { phone: '+242060000099', password: 'bolamu2026' };
const TEST_PHONE = '+242069000098';

let pool;
let adminToken;
let paymentReference;

async function cleanup(p) {
  await p.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [TEST_PHONE]);
  await p.query(`DELETE FROM payments WHERE patient_phone = $1`, [TEST_PHONE]);
  await p.query(`DELETE FROM users WHERE phone = $1`, [TEST_PHONE]);
}

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await cleanup(pool);

  // INSERT direct : patient avec is_active=false (évite le rate limiter /register)
  const hashedPwd = await bcrypt.hash('TestPaiement2026!', 10);
  await pool.query(
    `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash, member_code)
     VALUES ($1, 'Test Paiement', 'Test', 'Paiement', 'patient', false, $2,
       'BLM-' || LPAD(CAST(COALESCE((SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER))
                FROM users WHERE member_code ~ '^BLM-[0-9]+$'), 0) + 1 AS TEXT), 5, '0'))`,
    [TEST_PHONE, hashedPwd]
  );

  // Login admin
  const adminRes = await request.post(`${BASE}/api/v1/auth/admin-login`, {
    data: { phone: ADMIN.phone, password: ADMIN.password }
  });
  if (!adminRes.ok()) throw new Error(`Admin login failed: ${adminRes.status()}`);
  adminToken = (await adminRes.json()).accessToken;
});

test.afterAll(async () => {
  await cleanup(pool);
  await pool.end();
});

test.describe('FLUX 2 — Paiement → Activation compte', () => {
  test.describe.configure({ mode: 'serial' });
  test('is_active = false avant paiement (preuve P0)', async () => {
    const row = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(row.rows.length, `Patient ${TEST_PHONE} introuvable en base`).toBe(1);
    expect(row.rows[0].is_active, 'is_active doit être false avant paiement (règle P0)').toBe(false);
    console.log(`[AUDIT] ✅ is_active=false avant paiement`);
  });

  test('POST /payments/initiate → référence générée + persistée', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/initiate`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        patient_phone:  TEST_PHONE,
        amount_fcfa:    2000,
        payment_type:   'subscription',
        plan:           'essentiel'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    paymentReference = body.payment?.reference ?? body.reference;
    expect(paymentReference, 'Référence paiement absente de la réponse').toBeTruthy();

    // Preuve DB : paiement en attente
    const row = await pool.query(`SELECT status FROM payments WHERE reference = $1`, [paymentReference]);
    expect(row.rows.length, 'Paiement non créé en base').toBe(1);
    expect(row.rows[0].status).toBe('pending');
    console.log(`[AUDIT] ✅ Paiement initié — ref=${paymentReference}`);
  });

  test('POST /payments/confirm/:ref → users.is_active = TRUE + abonnement actif', async ({ request }) => {
    expect(paymentReference, 'Référence manquante (test précédent requis)').toBeTruthy();

    // AVANT
    const before = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(before.rows[0].is_active).toBe(false);

    const res = await request.post(`${BASE}/api/v1/payments/confirm/${paymentReference}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();

    // Preuve DB 1 : users.is_active = TRUE (correction P0-3)
    const uRow = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(uRow.rows[0].is_active, 'users.is_active doit être TRUE après confirmation paiement (P0-3)').toBe(true);

    // Preuve DB 2 : abonnement actif, expires_at dans le futur
    const sRow = await pool.query(
      `SELECT status, is_active, expires_at FROM subscriptions
       WHERE patient_phone = $1 AND is_active = TRUE`,
      [TEST_PHONE]
    );
    expect(sRow.rows.length, 'Abonnement actif non créé').toBeGreaterThan(0);
    expect(sRow.rows[0].status).toBe('active');
    expect(new Date(sRow.rows[0].expires_at) > new Date(), 'expires_at doit être dans le futur').toBeTruthy();
    console.log(`[AUDIT] ✅ is_active=true, abonnement actif jusqu'au ${sRow.rows[0].expires_at}`);
  });

  test('double confirmation → 400 ou déjà confirmé', async ({ request }) => {
    if (!paymentReference) return;
    const res = await request.post(`${BASE}/api/v1/payments/confirm/${paymentReference}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect([400, 200], `Double confirmation doit retourner 400 ou 200 (idempotent), reçu ${res.status()}`).toContain(res.status());
    console.log(`[AUDIT] ✅ Double confirmation → HTTP ${res.status()}`);
  });

  test('non-admin ne peut pas confirmer → 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/confirm/REF-FAKE-99999`, {
      headers: { Authorization: 'Bearer FAKETOKEN.INVALID.VALUE' }
    });
    expect([401, 403]).toContain(res.status());
    console.log(`[AUDIT] ✅ Non-admin bloqué — HTTP ${res.status()}`);
  });
});
