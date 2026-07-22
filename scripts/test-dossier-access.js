const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const BASE_URL = 'http://localhost:3005/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function normalizePhone(phone) {
  let p = String(phone).trim().replace(/\D/g, '');
  if (p.startsWith('0') && p.length === 10) p = '+242' + p;
  if (p.startsWith('242')) p = '+' + p;
  return p.startsWith('+') ? p : '+242' + p;
}

function generateToken(phone, role, id) {
  return jwt.sign({ phone: normalizePhone(phone), role, id }, JWT_SECRET, { expiresIn: '1h' });
}

async function apiFetch(path, options = {}) {
  const url = BASE_URL + path;
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}

async function getCouple() {
  const query = `
    SELECT d.phone AS doctor_phone, d.id AS doctor_id, a.patient_phone, u.first_name || ' ' || u.last_name AS patient_name, a.appointment_date
    FROM appointments a
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users u ON u.phone = a.patient_phone
    WHERE a.status = 'complete'
    ORDER BY a.appointment_date DESC
    LIMIT 1
  `;
  const result = await pool.query(query);
  if (!result.rows.length) {
    // Fallback: prendre un médecin et un patient actifs au hasard
    const docRes = await pool.query("SELECT phone, id FROM doctors WHERE is_active = true LIMIT 1");
    const patRes = await pool.query("SELECT phone, first_name || ' ' || last_name AS name FROM users WHERE role = 'patient' AND is_active = true LIMIT 1");
    if (!docRes.rows.length || !patRes.rows.length) {
      throw new Error('Aucun médecin/patient trouvé en base');
    }
    return {
      doctor_phone: docRes.rows[0].phone,
      doctor_id: docRes.rows[0].id,
      patient_phone: patRes.rows[0].phone,
      patient_name: patRes.rows[0].name,
      appointment_date: null
    };
  }
  return {
    doctor_phone: result.rows[0].doctor_phone,
    doctor_id: result.rows[0].doctor_id,
    patient_phone: result.rows[0].patient_phone,
    patient_name: result.rows[0].patient_name,
    appointment_date: result.rows[0].appointment_date
  };
}

async function verifyDossierAccessRequest(requestId) {
  const result = await pool.query(
    'SELECT id, doctor_user_id, patient_phone, status, responded_at FROM dossier_access_requests WHERE id = $1',
    [requestId]
  );
  return result.rows[0] || null;
}

async function verifyDmnAccessLog(patientPhone, source) {
  const result = await pool.query(
    "SELECT id, patient_phone, accessor_phone, access_type, accessed_at, details FROM dmn_access_log WHERE patient_phone = $1 AND details->>'source' = $2 ORDER BY accessed_at DESC LIMIT 1",
    [patientPhone, source]
  );
  return result.rows[0] || null;
}

async function verifyAuditLog(actorPhone, eventType) {
  const result = await pool.query(
    "SELECT id, event_type, actor_phone, target_table, target_id, payload, created_at FROM audit_log WHERE actor_phone = $1 AND event_type = $2 ORDER BY created_at DESC LIMIT 1",
    [actorPhone, eventType]
  );
  return result.rows[0] || null;
}

async function cleanup() {
  await pool.query("DELETE FROM dossier_access_requests WHERE patient_phone = $1", [TEST_PATIENT_PHONE]).catch(() => {});
}

let TEST_DOCTOR_PHONE, TEST_DOCTOR_ID, TEST_PATIENT_PHONE, TEST_PATIENT_NAME;

async function main() {
  console.log('=== RÉCUPÉRATION COUPLE MÉDECIN/PATIENT ===');
  const couple = await getCouple();
  TEST_DOCTOR_PHONE = couple.doctor_phone;
  TEST_DOCTOR_ID = couple.doctor_id;
  TEST_PATIENT_PHONE = couple.patient_phone;
  TEST_PATIENT_NAME = couple.patient_name;

  console.table([{
    doctor_phone: TEST_DOCTOR_PHONE,
    doctor_id: TEST_DOCTOR_ID,
    patient_phone: TEST_PATIENT_PHONE,
    patient_name: TEST_PATIENT_NAME,
    appointment_date: couple.appointment_date
  }]);

  // Nettoyage préalable
  await cleanup();

  const doctorToken = generateToken(TEST_DOCTOR_PHONE, 'doctor', TEST_DOCTOR_ID);
  const patientToken = generateToken(TEST_PATIENT_PHONE, 'patient', null);

  // ÉTAPE 2 : POST request-access
  console.log('\n=== ÉTAPE 2 : POST /doctors/patients/:patientPhone/request-access ===');
  const postRes = await apiFetch(`/doctors/patients/${encodeURIComponent(TEST_PATIENT_PHONE)}/request-access`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  });
  console.log('Status:', postRes.status, 'Response:', postRes.data);

  if (!postRes.ok || !postRes.data?.success) {
    throw new Error('ÉTAPE 2 ÉCHOUÉE : POST request-access a échoué');
  }

  const requestId = postRes.data.request_id;
  const reqRow2 = await verifyDossierAccessRequest(requestId);
  console.log('Preuve SQL dossier_access_requests :');
  console.table([reqRow2]);

  if (!reqRow2 || reqRow2.status !== 'pending') {
    throw new Error('ÉTAPE 2 ÉCHOUÉE : status attendu pending');
  }

  // ÉTAPE 3 : PATCH grant
  console.log('\n=== ÉTAPE 3 : PATCH /patients/dossier-access/:requestId (grant) ===');
  const patchRes = await apiFetch(`/patients/dossier-access/${requestId}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${patientToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'grant' })
  });
  console.log('Status:', patchRes.status, 'Response:', patchRes.data);

  if (!patchRes.ok || !patchRes.data?.success) {
    throw new Error('ÉTAPE 3 ÉCHOUÉE : PATCH grant a échoué');
  }

  const reqRow3 = await verifyDossierAccessRequest(requestId);
  console.log('Preuve SQL dossier_access_requests :');
  console.table([reqRow3]);

  if (!reqRow3 || reqRow3.status !== 'granted' || !reqRow3.responded_at) {
    throw new Error('ÉTAPE 3 ÉCHOUÉE : status attendu granted avec responded_at');
  }

  // ÉTAPE 4 : GET profile
  console.log('\n=== ÉTAPE 4 : GET /doctors/patients/:patientPhone/profile ===');
  const profileRes = await apiFetch(`/doctors/patients/${encodeURIComponent(TEST_PATIENT_PHONE)}/profile`, {
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  console.log('Status:', profileRes.status, 'Response dossier_access:', profileRes.data?.data?.dossier_access);

  if (!profileRes.ok || profileRes.data?.data?.dossier_access !== 'granted') {
    throw new Error('ÉTAPE 4 ÉCHOUÉE : dossier_access attendu granted');
  }

  // ÉTAPE 5 : GET dossier
  console.log('\n=== ÉTAPE 5 : GET /doctors/patients/:patientPhone/dossier ===');
  const dossierRes = await apiFetch(`/doctors/patients/${encodeURIComponent(TEST_PATIENT_PHONE)}/dossier`, {
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  console.log('Status:', dossierRes.status, 'Keys:', dossierRes.data?.data ? Object.keys(dossierRes.data.data) : null);

  if (!dossierRes.ok || !dossierRes.data?.data?.constantes) {
    throw new Error('ÉTAPE 5 ÉCHOUÉE : GET dossier a échoué ou données incomplètes');
  }

  const dmnLog = await verifyDmnAccessLog(TEST_PATIENT_PHONE, 'doctor_dashboard_consent');
  console.log('Preuve SQL dmn_access_log :');
  console.table(dmnLog ? [dmnLog] : []);

  if (!dmnLog || dmnLog.access_type !== 'consultation') {
    throw new Error('ÉTAPE 5 ÉCHOUÉE : dmn_access_log consultation manquant');
  }

  const auditLog = await verifyAuditLog(TEST_DOCTOR_PHONE, 'DOSSIER_ACCESS_VIEW');
  console.log('Preuve SQL audit_log :');
  console.table(auditLog ? [auditLog] : []);

  if (!auditLog) {
    throw new Error('ÉTAPE 5 ÉCHOUÉE : audit_log DOSSIER_ACCESS_VIEW manquant');
  }

  // ÉTAPE 6 : Test négatif pending
  console.log('\n=== ÉTAPE 6 : Test négatif GET /dossier sans accès granted ===');
  // Créer une nouvelle demande pending sans la valider
  const pendingRes = await apiFetch(`/doctors/patients/${encodeURIComponent(TEST_PATIENT_PHONE)}/request-access`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  });

  if (!pendingRes.ok || !pendingRes.data?.success) {
    throw new Error('ÉTAPE 6 ÉCHOUÉE : impossible de créer demande pending pour test négatif');
  }

  // Révoquer le granted précédent pour simuler none
  await pool.query("UPDATE dossier_access_requests SET status = 'revoked' WHERE id = $1", [requestId]);

  const deniedRes = await apiFetch(`/doctors/patients/${encodeURIComponent(TEST_PATIENT_PHONE)}/dossier`, {
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  console.log('Status:', deniedRes.status, 'Response:', deniedRes.data);

  if (deniedRes.status !== 403 || deniedRes.data?.error !== 'ACCESS_DENIED') {
    throw new Error('ÉTAPE 6 ÉCHOUÉE : attendu 403 ACCESS_DENIED');
  }

  // Cleanup
  await cleanup();
  await pool.query("DELETE FROM dossier_access_requests WHERE id = $1", [pendingRes.data.request_id]).catch(() => {});

  console.log('\n✅ TOUS LES TESTS ONT RÉUSSI');
}

main().catch(async (err) => {
  console.error('\n❌ ERREUR:', err.message);
  await cleanup();
  process.exit(1);
}).finally(() => {
  pool.end();
});
