// ============================================================
// BOLAMU — FLUX 4 : Prescription médecin → patient → pharmacie
// Comptes de test créés directement en DB (médecin + pharmacie)
// pour éviter la dépendance aux mots de passe des comptes prod.
// Preuve SQL à chaque étape (create, deliver, audit_log).
// Valide aussi requireDoctor (P1) : patient → 403.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';

const PATIENT = { phone: '+242069735418', password: 'TestNouveau2026!' };
const TEST_DOCTOR_PHONE = '+242069000057';
const TEST_PHARMA_PHONE = '+242069000058';
const TEST_PASSWORD      = 'TestBolamu2026!';

let pool;
let doctorToken, pharmacieToken, patientToken;
let prescriptionId;
let testDoctorId;

async function login(request, phone, password) {
  const res = await request.post(`${BASE}/api/v1/auth/login`, {
    data: { phone, password }
  });
  if (!res.ok()) throw new Error(`Login ${phone} → ${res.status()}: ${await res.text()}`);
  return (await res.json()).accessToken;
}

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const hashedPwd = await bcrypt.hash(TEST_PASSWORD, 10);

  // Cleanup test doctor
  await pool.query(`DELETE FROM doctors WHERE phone = $1`, [TEST_DOCTOR_PHONE]);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_DOCTOR_PHONE]);
  // Cleanup test pharmacie
  await pool.query(`DELETE FROM pharmacies WHERE phone = $1`, [TEST_PHARMA_PHONE]);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_PHARMA_PHONE]);

  // Créer médecin de test en DB
  const drRow = await pool.query(
    `INSERT INTO users (phone, full_name, first_name, last_name, role, is_active, password_hash)
     VALUES ($1, 'Dr Test Playwright', 'Test', 'Playwright', 'doctor', true, $2) RETURNING id`,
    [TEST_DOCTOR_PHONE, hashedPwd]
  );
  testDoctorId = drRow.rows[0].id;
  await pool.query(
    `INSERT INTO doctors (phone, full_name, specialty, registration_number, city, is_active, user_id)
     VALUES ($1, 'Dr Test Playwright', 'Médecine générale', 'TEST-PW-001', 'Brazzaville', true, $2)`,
    [TEST_DOCTOR_PHONE, testDoctorId]
  );

  // Créer pharmacie de test en DB
  const pharRow = await pool.query(
    `INSERT INTO users (phone, full_name, role, is_active, password_hash)
     VALUES ($1, 'Pharmacie Test PW', 'pharmacie', true, $2) RETURNING id`,
    [TEST_PHARMA_PHONE, hashedPwd]
  );
  await pool.query(
    `INSERT INTO pharmacies (phone, name, is_active)
     VALUES ($1, 'Pharmacie Test Playwright', true)`,
    [TEST_PHARMA_PHONE]
  );

  // Signer tous les JWTs localement pour éviter le rate limiter (plusieurs runs)
  const [pharmaRow, patientRow] = await Promise.all([
    pool.query(`SELECT id FROM users WHERE phone = $1`, [TEST_PHARMA_PHONE]),
    pool.query(`SELECT id FROM users WHERE phone = $1`, [PATIENT.phone])
  ]);
  const JWT_SECRET = process.env.JWT_SECRET;
  doctorToken = jwt.sign(
    { id: testDoctorId, phone: TEST_DOCTOR_PHONE, role: 'doctor' },
    JWT_SECRET, { expiresIn: '1h' }
  );
  pharmacieToken = jwt.sign(
    { id: pharmaRow.rows[0].id, phone: TEST_PHARMA_PHONE, role: 'pharmacie' },
    JWT_SECRET, { expiresIn: '1h' }
  );
  patientToken = jwt.sign(
    { id: patientRow.rows[0].id, phone: PATIENT.phone, role: 'patient' },
    JWT_SECRET, { expiresIn: '1h' }
  );
});

test.afterAll(async () => {
  if (prescriptionId) {
    await pool.query(`DELETE FROM prescriptions WHERE id = $1`, [prescriptionId]);
  }
  await pool.query(`DELETE FROM doctors WHERE phone = $1`, [TEST_DOCTOR_PHONE]);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_DOCTOR_PHONE]);
  await pool.query(`DELETE FROM pharmacies WHERE phone = $1`, [TEST_PHARMA_PHONE]);
  await pool.query(`DELETE FROM users WHERE phone = $1`, [TEST_PHARMA_PHONE]);
  await pool.end();
});

test.describe('FLUX 4 — Prescription inter-rôles', () => {
  test.describe.configure({ mode: 'serial' });

  test('POST /prescriptions/create avec JWT médecin → 200 + persisté en base', async ({ request }) => {
    const countBefore = await pool.query(
      `SELECT COUNT(*) AS n FROM prescriptions WHERE doctor_phone = $1 AND created_at::date = CURRENT_DATE`,
      [TEST_DOCTOR_PHONE]
    );

    const res = await request.post(`${BASE}/api/v1/prescriptions/create`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      data: {
        patient_phone: PATIENT.phone,
        doctor_phone:  TEST_DOCTOR_PHONE,
        medications:   'Amoxicilline 500mg × 3/j × 7j [PLAYWRIGHT-TEST]',
        instructions:  'Prendre pendant les repas'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    prescriptionId = body.data?.id ?? body.prescription?.id ?? body.id;
    expect(prescriptionId, 'id ordonnance absent de la réponse').toBeTruthy();

    const row = await pool.query(
      `SELECT id, status, patient_phone, doctor_phone FROM prescriptions WHERE id = $1`,
      [prescriptionId]
    );
    expect(row.rows.length).toBe(1);
    expect(row.rows[0].status).toBe('active');
    expect(row.rows[0].patient_phone).toBe(PATIENT.phone);
    console.log(`[AUDIT] ✅ Ordonnance créée id=${prescriptionId}, status=active`);
  });

  test('POST /prescriptions/create avec JWT patient → 403 (requireDoctor actif)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/prescriptions/create`, {
      headers: { Authorization: `Bearer ${patientToken}` },
      data: {
        patient_phone: PATIENT.phone,
        doctor_phone:  TEST_DOCTOR_PHONE,
        medications:   'Test guard'
      }
    });
    expect(res.status()).toBe(403);
    console.log(`[AUDIT] ✅ requireDoctor opérationnel — patient reçoit 403`);
  });

  test('GET /prescriptions/patient/:phone → ordonnance visible par le patient', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/v1/prescriptions/patient/${encodeURIComponent(PATIENT.phone)}`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    const list = body.data ?? body.prescriptions ?? [];
    expect(Array.isArray(list)).toBeTruthy();
    if (prescriptionId) {
      const found = list.some(p => p.id === prescriptionId);
      expect(found, `Ordonnance ${prescriptionId} non trouvée`).toBeTruthy();
      console.log(`[AUDIT] ✅ Ordonnance visible par le patient`);
    }
  });

  test('POST /prescriptions/deliver → status=delivered + audit_log complet', async ({ request }) => {
    expect(prescriptionId, 'prescriptionId manquant').toBeTruthy();

    const before = await pool.query(`SELECT status FROM prescriptions WHERE id = $1`, [prescriptionId]);
    expect(before.rows[0].status).toBe('active');

    const res = await request.post(`${BASE}/api/v1/prescriptions/deliver`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` },
      data: { prescription_id: prescriptionId, pharmacie_phone: TEST_PHARMA_PHONE }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();

    // Preuve DB 1 : status = 'delivered'
    const pRow = await pool.query(
      `SELECT status, pharmacie_phone, delivered_at FROM prescriptions WHERE id = $1`, [prescriptionId]
    );
    expect(pRow.rows[0].status).toBe('delivered');
    expect(pRow.rows[0].pharmacie_phone).toBe(TEST_PHARMA_PHONE);
    expect(pRow.rows[0].delivered_at).toBeTruthy();
    console.log(`[AUDIT] ✅ Délivrance persistée — status=delivered`);

    // Preuve DB 2 : audit_log (correction P0 BUG-2)
    await new Promise(r => setTimeout(r, 500));
    const aRow = await pool.query(
      `SELECT target_table, target_id, event_type FROM audit_log
       WHERE event_type = 'prescription_delivered' AND target_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [prescriptionId]
    );
    expect(aRow.rows.length, 'audit_log manquant pour prescription_delivered').toBeGreaterThan(0);
    expect(aRow.rows[0].target_table).toBe('prescriptions');
    console.log(`[AUDIT] ✅ audit_log target_table=prescriptions, target_id=${aRow.rows[0].target_id}`);
  });

  test('POST /prescriptions/deliver déjà livrée → 409 anti-rejeu', async ({ request }) => {
    if (!prescriptionId) return;
    const res = await request.post(`${BASE}/api/v1/prescriptions/deliver`, {
      headers: { Authorization: `Bearer ${pharmacieToken}` },
      data: { prescription_id: prescriptionId, pharmacie_phone: TEST_PHARMA_PHONE }
    });
    expect(res.status()).toBe(409);
    console.log(`[AUDIT] ✅ Anti-rejeu 409 sur double délivrance`);
  });
});
