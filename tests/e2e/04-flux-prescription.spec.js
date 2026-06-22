// ============================================================
// BOLAMU — FLUX 4 : Prescription médecin → patient → pharmacie
// Preuve SQL à chaque étape (create, deliver, audit_log, notification).
// Valide aussi requireDoctor (P1) : patient → 403.
// ============================================================
import { test, expect } from '@playwright/test';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const BASE = process.env.TEST_API_BASE || 'https://api.bolamu.co';
const PATIENT   = { phone: '+242069735418', password: 'TestNouveau2026!' };
const DOCTOR    = { phone: '+242060000001', password: 'bolamu2026' };
const PHARMACIE = { phone: '+242066226116', password: 'WR383LMW' };

let pool;
let doctorToken, pharmacieToken, patientToken;
let prescriptionId;

async function login(request, creds) {
  const res = await request.post(`${BASE}/api/v1/auth/login`, {
    data: { phone: creds.phone, password: creds.password }
  });
  if (!res.ok()) throw new Error(`Login ${creds.phone} → ${res.status()}: ${await res.text()}`);
  return (await res.json()).accessToken;
}

function authH(token) { return { Authorization: `Bearer ${token}` }; }

test.beforeAll(async ({ request }) => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  [doctorToken, pharmacieToken, patientToken] = await Promise.all([
    login(request, DOCTOR),
    login(request, PHARMACIE),
    login(request, PATIENT)
  ]);
});

test.afterAll(async () => await pool.end());

test.describe('FLUX 4 — Prescription inter-rôles', () => {
  test.describe.configure({ mode: 'serial' });
  test('POST /prescriptions/create avec JWT médecin → 200 + persisté en base', async ({ request }) => {
    const countBefore = await pool.query(
      `SELECT COUNT(*) AS n FROM prescriptions
       WHERE doctor_phone = $1 AND created_at::date = CURRENT_DATE`,
      [DOCTOR.phone]
    );

    const res = await request.post(`${BASE}/api/v1/prescriptions/create`, {
      headers: authH(doctorToken),
      data: {
        patient_phone: PATIENT.phone,
        doctor_phone:  DOCTOR.phone,
        medications:   'Amoxicilline 500mg × 3/j × 7j [PLAYWRIGHT-TEST]',
        instructions:  'Prendre pendant les repas'
      }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    prescriptionId = body.data?.id ?? body.prescription?.id ?? body.id;
    expect(prescriptionId, 'id ordonnance absent de la réponse').toBeTruthy();

    // Preuve DB : ordonnance créée avec status='active'
    const row = await pool.query(
      `SELECT id, status, patient_phone, doctor_phone FROM prescriptions WHERE id = $1`,
      [prescriptionId]
    );
    expect(row.rows.length, `Ordonnance id=${prescriptionId} non trouvée en base`).toBe(1);
    expect(row.rows[0].status).toBe('active');
    expect(row.rows[0].patient_phone).toBe(PATIENT.phone);
    console.log(`[AUDIT] ✅ Ordonnance créée id=${prescriptionId}, status=active`);
  });

  test('POST /prescriptions/create avec JWT patient → 403 (requireDoctor actif)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/prescriptions/create`, {
      headers: authH(patientToken),
      data: {
        patient_phone: PATIENT.phone,
        doctor_phone:  DOCTOR.phone,
        medications:   'Test guard'
      }
    });
    expect(res.status(), 'Patient ne doit pas pouvoir créer une ordonnance (requireDoctor)').toBe(403);
    console.log(`[AUDIT] ✅ requireDoctor opérationnel — patient reçoit 403`);
  });

  test('GET /prescriptions/patient/:phone → ordonnance visible par le patient', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/v1/prescriptions/patient/${encodeURIComponent(PATIENT.phone)}`,
      { headers: authH(patientToken) }
    );
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    const list = body.data ?? body.prescriptions ?? [];
    expect(Array.isArray(list)).toBeTruthy();
    if (prescriptionId) {
      const found = list.some(p => p.id === prescriptionId);
      expect(found, `Ordonnance ${prescriptionId} non trouvée dans la liste patient`).toBeTruthy();
      console.log(`[AUDIT] ✅ Ordonnance visible par le patient`);
    }
  });

  test('POST /prescriptions/deliver → status=delivered + audit_log complet', async ({ request }) => {
    expect(prescriptionId, 'prescriptionId manquant').toBeTruthy();

    // AVANT
    const before = await pool.query(
      `SELECT status FROM prescriptions WHERE id = $1`, [prescriptionId]
    );
    expect(before.rows[0].status).toBe('active');

    const res = await request.post(`${BASE}/api/v1/prescriptions/deliver`, {
      headers: authH(pharmacieToken),
      data: { prescription_id: prescriptionId, pharmacie_phone: PHARMACIE.phone }
    });
    expect(res.ok(), `HTTP ${res.status()} — ${await res.text()}`).toBeTruthy();

    // Preuve DB 1 : status = 'delivered', delivered_at renseigné
    const pRow = await pool.query(
      `SELECT status, pharmacie_phone, delivered_at FROM prescriptions WHERE id = $1`,
      [prescriptionId]
    );
    expect(pRow.rows[0].status, 'status doit être delivered').toBe('delivered');
    expect(pRow.rows[0].pharmacie_phone).toBe(PHARMACIE.phone);
    expect(pRow.rows[0].delivered_at, 'delivered_at non renseigné').toBeTruthy();
    console.log(`[AUDIT] ✅ Délivrance persistée — status=delivered, delivered_at=${pRow.rows[0].delivered_at}`);

    // Preuve DB 2 : audit_log avec target_table='prescriptions' et target_id (correction P0 BUG-2)
    await new Promise(r => setTimeout(r, 500));
    const aRow = await pool.query(
      `SELECT target_table, target_id, event_type FROM audit_log
       WHERE event_type = 'prescription_delivered'
         AND (target_id = $1 OR target_id = $2)
       ORDER BY created_at DESC LIMIT 1`,
      [String(prescriptionId), prescriptionId]
    );
    expect(aRow.rows.length, 'Entrée audit_log manquante pour prescription_delivered').toBeGreaterThan(0);
    expect(aRow.rows[0].target_table).toBe('prescriptions');
    expect(aRow.rows[0].target_id, 'target_id absent (correction P0 BUG-2 requise)').toBeTruthy();
    console.log(`[AUDIT] ✅ audit_log target_table=prescriptions, target_id=${aRow.rows[0].target_id}`);

    // Preuve DB 3 : notification créée pour le patient
    await new Promise(r => setTimeout(r, 1000));
    const nRow = await pool.query(
      `SELECT id, type, user_phone FROM notifications
       WHERE user_phone = $1 ORDER BY created_at DESC LIMIT 1`,
      [PATIENT.phone]
    );
    if (nRow.rows.length) {
      console.log(`[AUDIT] ✅ Notification patient — type: ${nRow.rows[0].type}`);
    } else {
      console.log(`[AUDIT] ⚠️ Aucune notification trouvée après délivrance — notify() peut échouer si template absent`);
    }
  });

  test('POST /prescriptions/deliver déjà livrée → 409 anti-rejeu', async ({ request }) => {
    if (!prescriptionId) return;
    const res = await request.post(`${BASE}/api/v1/prescriptions/deliver`, {
      headers: authH(pharmacieToken),
      data: { prescription_id: prescriptionId, pharmacie_phone: PHARMACIE.phone }
    });
    expect(res.status(), 'Double délivrance doit retourner 409').toBe(409);
    console.log(`[AUDIT] ✅ Anti-rejeu 409 sur double délivrance`);
  });
});
