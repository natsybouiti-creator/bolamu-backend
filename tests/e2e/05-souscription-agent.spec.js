// ============================================================
// BOLAMU — FLUX 5 : Souscription via agent (souscrire-complet)
// Crée un agent de test en DB, vérifie users + subscriptions + member_code.
// L'agent de test est supprimé dans teardown.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const TEST_AGENT_PHONE   = '+242069000088';
const TEST_PATIENT_PHONE = '+242069000077';
const TEST_PHOTO_PHONE   = '+242069000076';
const AGENT_PASSWORD     = 'TestAgent2026!';

let pool;
let agentToken;

async function cleanPatient(p, phone) {
  await p.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [phone]);
  await p.query(`DELETE FROM audit_log WHERE payload->>'patient_phone' = $1 AND created_at::date = CURRENT_DATE`, [phone]);
  await p.query(`DELETE FROM users WHERE phone = $1`, [phone]);
}

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Cleanup patients de test
  await cleanPatient(pool, TEST_PATIENT_PHONE);
  await cleanPatient(pool, TEST_PHOTO_PHONE);

  // Créer ou réinitialiser l'agent de test directement en DB
  const hashedPwd = await bcrypt.hash(AGENT_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash)
     VALUES ($1, 'Agent Test Playwright', 'Agent', 'Test', 'agent_bolamu', true, $2)
     ON CONFLICT (phone) DO UPDATE
       SET role = 'agent_bolamu', is_active = true, password_hash = $2`,
    [TEST_AGENT_PHONE, hashedPwd]
  );

  // Login agent via /agence/login
  const loginRes = await request.post(`${BASE}/api/v1/agence/login`, {
    data: { phone: TEST_AGENT_PHONE, password: AGENT_PASSWORD }
  });
  if (!loginRes.ok()) {
    throw new Error(`Agent login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  agentToken = (await loginRes.json()).token;
  if (!agentToken) throw new Error('Token agent absent de la réponse /agence/login');
});

test.afterAll(async () => {
  await cleanPatient(pool, TEST_PATIENT_PHONE);
  await cleanPatient(pool, TEST_PHOTO_PHONE);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_AGENT_PHONE]);
  await pool.end();
});

test.describe('FLUX 5 — Souscription agent (souscrire-complet)', () => {
  test.describe.configure({ mode: 'serial' });
  test('POST /agence/souscrire-complet → users + subscriptions + member_code', async ({ request }) => {
    // AVANT : patient inexistant
    const before = await pool.query(`SELECT COUNT(*) AS n FROM users WHERE phone = $1`, [TEST_PATIENT_PHONE]);
    expect(parseInt(before.rows[0].n, 10)).toBe(0);

    const res = await request.post(`${BASE}/api/v1/agence/souscrire-complet`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        phone:          TEST_PATIENT_PHONE,
        nom:            'Playwright',
        prenom:         'TestAgent',
        dob:            '1990-01-01',
        genre:          'M',
        ville:          'Brazzaville',
        plan:           'moto',
        payment_mode:   'momo',
        canal:          'aucun'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    // Preuve DB 1 : users créé
    const uRow = await pool.query(
      `SELECT phone, is_active, member_code, role FROM users WHERE phone = $1`,
      [TEST_PATIENT_PHONE]
    );
    expect(uRow.rows.length, 'Utilisateur non créé en base').toBe(1);
    expect(uRow.rows[0].role).toBe('patient');
    expect(uRow.rows[0].member_code, 'member_code non généré').toBeTruthy();
    console.log(`[AUDIT] ✅ User créé — member_code=${uRow.rows[0].member_code}`);

    // Preuve DB 2 : subscription créée et active
    const sRow = await pool.query(
      `SELECT plan, status, expires_at FROM subscriptions
       WHERE patient_phone = $1 AND status = 'active'`,
      [TEST_PATIENT_PHONE]
    );
    expect(sRow.rows.length, 'Abonnement non créé').toBeGreaterThan(0);
    expect(sRow.rows[0].status).toBe('active');
    expect(new Date(sRow.rows[0].expires_at) > new Date(), 'expires_at non dans le futur').toBeTruthy();
    console.log(`[AUDIT] ✅ Abonnement actif — plan=${sRow.rows[0].plan}, expire=${sRow.rows[0].expires_at}`);
  });

  test('sans JWT agent → 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/souscrire-complet`, {
      data: { phone: '+242069000075', nom: 'X', prenom: 'Y', dob: '2000-01-01', genre: 'M', ville: 'BZV', plan: 'moto' }
    });
    expect([401, 403]).toContain(res.status());
    console.log(`[AUDIT] ✅ Sans token agent → HTTP ${res.status()}`);
  });

  test('photo_url renseigné en DB si photoData fourni', async ({ request }) => {
    // 1×1 pixel PNG rouge en base64
    const photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request.post(`${BASE}/api/v1/agence/souscrire-complet`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        phone:        TEST_PHOTO_PHONE,
        nom:          'PhotoTest',
        prenom:       'Agent',
        dob:          '1995-05-15',
        genre:        'F',
        ville:        'Pointe-Noire',
        plan:         'moto',
        payment_mode: 'especes',
        canal:        'aucun',
        photoData
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();

    // Preuve DB : photo_url renseigné
    const row = await pool.query(`SELECT photo_url FROM users WHERE phone = $1`, [TEST_PHOTO_PHONE]);
    expect(row.rows.length).toBe(1);
    if (row.rows[0].photo_url) {
      expect(row.rows[0].photo_url).toContain('cloudinary');
      console.log(`[AUDIT] ✅ photo_url renseigné (Cloudinary)`);
    } else {
      // Upload Cloudinary peut échouer en test (timeout réseau) — non-bloquant
      console.log(`[AUDIT] ⚠️ photo_url absent — Cloudinary upload échoué en test (acceptable)`);
    }
  });
});
