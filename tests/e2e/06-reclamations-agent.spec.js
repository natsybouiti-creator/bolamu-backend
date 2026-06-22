// ============================================================
// BOLAMU — FLUX 6 : Réclamations agent (ex-fantômes)
// Teste les 4 routes réelles créées en session 7.
// Preuve DB : is_active, plan, first_name, audit_log.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const TEST_AGENT_PHONE   = '+242069000088';
const TEST_PATIENT_PHONE = '+242069000066';
const AGENT_PASSWORD     = 'TestAgent2026!';

let pool;
let agentToken;

async function lastAuditLog(pool, eventType, phone) {
  const res = await pool.query(
    `SELECT event_type, target_table, target_id, actor_phone
     FROM audit_log
     WHERE event_type = $1 AND payload->>'patient_phone' = $2
     ORDER BY created_at DESC LIMIT 1`,
    [eventType, phone]
  );
  return res.rows[0] ?? null;
}

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const hashedPwd = await bcrypt.hash(AGENT_PASSWORD, 10);

  // Créer le patient de test (is_active=false pour tester réactivation)
  await pool.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [TEST_PATIENT_PHONE]);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_PATIENT_PHONE]);
  await pool.query(
    `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash)
     VALUES ($1, 'Patient Reclam', 'Patient', 'Reclam', 'patient', false, $2)`,
    [TEST_PATIENT_PHONE, await bcrypt.hash('unused', 10)]
  );
  // Abonnement actif pour tester changer-formule
  await pool.query(
    `INSERT INTO subscriptions (patient_phone, plan, status, is_active, amount_fcfa, started_at, expires_at)
     VALUES ($1, 'essentiel', 'active', true, 2000, NOW(), NOW() + INTERVAL '30 days')`,
    [TEST_PATIENT_PHONE]
  );

  // Créer / réinitialiser l'agent de test
  await pool.query(
    `INSERT INTO users (phone, full_name, role, is_active, password_hash)
     VALUES ($1, 'Agent Test PW', 'agent_bolamu', true, $2)
     ON CONFLICT (phone) DO UPDATE SET role = 'agent_bolamu', is_active = true, password_hash = $2`,
    [TEST_AGENT_PHONE, hashedPwd]
  );

  // Login agent
  const loginRes = await request.post(`${BASE}/api/v1/agence/login`, {
    data: { phone: TEST_AGENT_PHONE, password: AGENT_PASSWORD }
  });
  if (!loginRes.ok()) throw new Error(`Agent login failed: ${loginRes.status()} ${await loginRes.text()}`);
  agentToken = (await loginRes.json()).token;
  if (!agentToken) throw new Error('Token agent absent');
});

test.afterAll(async () => {
  await pool.query(`DELETE FROM subscriptions WHERE patient_phone = $1`, [TEST_PATIENT_PHONE]);
  await pool.query(
    `DELETE FROM audit_log WHERE payload->>'patient_phone' = $1 AND created_at::date = CURRENT_DATE`,
    [TEST_PATIENT_PHONE]
  );
  await pool.query(`DELETE FROM users WHERE phone IN ($1, $2)`, [TEST_PATIENT_PHONE, TEST_AGENT_PHONE]);
  await pool.end();
});

test.describe('FLUX 6 — Réclamations agent (ex-fantômes)', () => {
  test.describe.configure({ mode: 'serial' });
  test('POST /agence/reclamation/reactiver → 200 + is_active=true + audit_log', async ({ request }) => {
    // AVANT : is_active = false
    const before = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PATIENT_PHONE]);
    expect(before.rows[0].is_active).toBe(false);

    const res = await request.post(`${BASE}/api/v1/agence/reclamation/reactiver`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: { patient_phone: TEST_PATIENT_PHONE, raison: 'test-playwright-reactivation' }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    expect((await res.json()).success).toBe(true);

    // Preuve DB 1 : is_active = true
    const uRow = await pool.query(`SELECT is_active FROM users WHERE phone = $1`, [TEST_PATIENT_PHONE]);
    expect(uRow.rows[0].is_active, 'is_active doit être true après réactivation').toBe(true);

    // Preuve DB 2 : audit_log
    const log = await lastAuditLog(pool, 'agent.reclamation_reactivation', TEST_PATIENT_PHONE);
    expect(log, 'audit_log manquant pour agent.reclamation_reactivation').toBeTruthy();
    expect(log.target_table).toBe('users');
    console.log(`[AUDIT] ✅ reactiver — is_active=true, audit_log présent`);
  });

  test('POST /agence/reclamation/changer-formule → 200 + plan=standard + audit_log', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/reclamation/changer-formule`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: { patient_phone: TEST_PATIENT_PHONE, nouveau_plan: 'standard', raison: 'test-playwright' }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    expect((await res.json()).success).toBe(true);

    // Preuve DB 1 : plan mis à jour
    const sRow = await pool.query(
      `SELECT plan FROM subscriptions WHERE patient_phone = $1 AND is_active = true`,
      [TEST_PATIENT_PHONE]
    );
    expect(sRow.rows.length, 'Abonnement actif introuvable').toBeGreaterThan(0);
    expect(sRow.rows[0].plan, 'Plan non mis à jour vers standard').toBe('standard');

    // Preuve DB 2 : audit_log
    const log = await lastAuditLog(pool, 'agent.reclamation_changement_plan', TEST_PATIENT_PHONE);
    expect(log, 'audit_log manquant pour agent.reclamation_changement_plan').toBeTruthy();
    console.log(`[AUDIT] ✅ changer-formule — plan=standard, audit_log présent`);
  });

  test('POST /agence/reclamation/corriger → 200 + first_name mis à jour + audit_log', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/reclamation/corriger`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        patient_phone: TEST_PATIENT_PHONE,
        corrections:   { first_name: 'PatientCorrigé', last_name: 'TestPW' },
        raison:        'test-playwright-correction'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.champs_mis_a_jour)).toBeTruthy();
    expect(body.champs_mis_a_jour).toContain('first_name');

    // Preuve DB 1 : first_name et last_name mis à jour
    const uRow = await pool.query(
      `SELECT first_name, last_name FROM users WHERE phone = $1`, [TEST_PATIENT_PHONE]
    );
    expect(uRow.rows[0].first_name).toBe('PatientCorrigé');
    expect(uRow.rows[0].last_name).toBe('TestPW');

    // Preuve DB 2 : audit_log
    const log = await lastAuditLog(pool, 'agent.reclamation_correction', TEST_PATIENT_PHONE);
    expect(log, 'audit_log manquant pour agent.reclamation_correction').toBeTruthy();
    console.log(`[AUDIT] ✅ corriger — first_name=PatientCorrigé, audit_log présent`);
  });

  test('POST /agence/reclamation/signaler → 200 + audit_log', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/reclamation/signaler`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        patient_phone: TEST_PATIENT_PHONE,
        description:   'Test Playwright — signalement fictif pour audit de persistance'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    expect((await res.json()).success).toBe(true);

    // Preuve DB : audit_log
    const log = await lastAuditLog(pool, 'agent.reclamation_signalement', TEST_PATIENT_PHONE);
    expect(log, 'audit_log manquant pour agent.reclamation_signalement').toBeTruthy();
    console.log(`[AUDIT] ✅ signaler — audit_log présent`);
  });

  test('réclamations sans JWT → 401 ou 403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/reclamation/reactiver`, {
      data: { patient_phone: TEST_PATIENT_PHONE }
    });
    expect([401, 403]).toContain(res.status());
    console.log(`[AUDIT] ✅ Sans token → HTTP ${res.status()}`);
  });

  test('réclamations avec plan invalide → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/agence/reclamation/changer-formule`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: { patient_phone: TEST_PATIENT_PHONE, nouveau_plan: 'gold' }
    });
    expect(res.status(), 'Plan inexistant doit retourner 400').toBe(400);
    console.log(`[AUDIT] ✅ Plan invalide → 400`);
  });
});
