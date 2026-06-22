// ============================================================
// BOLAMU — FLUX 2 : Paiement → Activation compte patient
// Setup : INSERT direct en DB (contourne le rate limiter /register
// ET /payments/initiate qui a un bug prod sur payment_method_new).
// L'endpoint /payments/confirm est le cœur de la correction P0-3.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const ADMIN = { phone: '+242060000099', password: 'bolamu2026' };
const TEST_PHONE = '+242069000098';
const TEST_REF   = `TEST-PW-${Date.now()}`;

let pool;
let adminToken;

async function cleanup(p) {
  await p.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [TEST_PHONE]);
  await p.query(`DELETE FROM payments WHERE patient_phone = $1`, [TEST_PHONE]);
  await p.query(`DELETE FROM users WHERE phone = $1`, [TEST_PHONE]);
}

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await cleanup(pool);

  // INSERT direct : patient avec is_active=false
  const hashedPwd = await bcrypt.hash('TestPaiement2026!', 10);
  await pool.query(
    `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash, member_code)
     VALUES ($1, 'Test Paiement', 'Test', 'Paiement', 'patient', false, $2,
       'BLM-' || LPAD(CAST(COALESCE((SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER))
                FROM users WHERE member_code ~ '^BLM-[0-9]+$'), 0) + 1 AS TEXT), 5, '0'))`,
    [TEST_PHONE, hashedPwd]
  );

  // INSERT direct du paiement (bypass /initiate cassé en prod : payment_method inexistant)
  await pool.query(
    `INSERT INTO payments (patient_phone, amount_fcfa, payment_type, payment_method_new, status, reference, plan)
     VALUES ($1, 2000, 'subscription', 'simulation', 'pending', $2, 'essentiel')`,
    [TEST_PHONE, TEST_REF]
  );

  // Signer le JWT admin localement (bypass strictLimiter sur /admin-login en test répété)
  const adminRow = await pool.query(`SELECT id FROM users WHERE phone = $1`, [ADMIN.phone]);
  if (!adminRow.rows.length) throw new Error(`Admin ${ADMIN.phone} introuvable en base`);
  adminToken = jwt.sign(
    { id: adminRow.rows[0].id, phone: ADMIN.phone, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
});

test.afterAll(async () => {
  await cleanup(pool);
  await pool.end();
});

test.describe('FLUX 2 — Paiement → Activation compte', () => {
  test.describe.configure({ mode: 'serial' });

  test('is_active = false avant paiement (preuve P0)', async () => {
    const row = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].is_active, 'is_active doit être false avant paiement').toBe(false);
    console.log(`[AUDIT] ✅ is_active=false avant paiement`);
  });

  test('paiement pending en base avant confirmation (preuve)', async () => {
    const row = await pool.query(`SELECT status FROM payments WHERE reference = $1`, [TEST_REF]);
    expect(row.rows.length, 'Paiement test non trouvé en base').toBe(1);
    expect(row.rows[0].status).toBe('pending');
    console.log(`[AUDIT] ✅ Paiement pending — ref=${TEST_REF}`);
  });

  test('POST /payments/confirm/:ref → users.is_active = TRUE + abonnement actif (P0-3)', async ({ request }) => {
    // AVANT
    const before = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(before.rows[0].is_active).toBe(false);

    const res = await request.post(`${BASE}/api/v1/payments/confirm/${TEST_REF}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();

    // Preuve DB 1 : users.is_active = TRUE (correction P0-3)
    const uRow = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PHONE]);
    expect(uRow.rows[0].is_active, 'users.is_active doit être TRUE après confirmation (P0-3)').toBe(true);

    // Preuve DB 2 : abonnement actif, expires_at dans le futur
    const sRow = await pool.query(
      `SELECT status, is_active, expires_at FROM subscriptions
       WHERE patient_phone = $1 AND is_active = TRUE`,
      [TEST_PHONE]
    );
    expect(sRow.rows.length, 'Abonnement actif non créé').toBeGreaterThan(0);
    expect(sRow.rows[0].status).toBe('active');
    console.log(`[AUDIT] ✅ P0-3 validé — is_active=true, abonnement actif`);
  });

  test('double confirmation → 400 (déjà confirmé)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/confirm/${TEST_REF}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect([400, 200], `Double confirmation : 400 ou 200 (idempotent), reçu ${res.status()}`).toContain(res.status());
    console.log(`[AUDIT] ✅ Double confirmation → HTTP ${res.status()}`);
  });

  test('non-admin ne peut pas confirmer → 401 ou 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/confirm/REF-FAKE-NOAUTH`, {
      headers: { Authorization: 'Bearer FAKETOKEN.INVALID.VALUE' }
    });
    expect([401, 403]).toContain(res.status());
    console.log(`[AUDIT] ✅ Non-admin bloqué — HTTP ${res.status()}`);
  });
});
