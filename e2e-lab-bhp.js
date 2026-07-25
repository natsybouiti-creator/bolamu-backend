require('dotenv').config();
const pool = require('./src/config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Blob } = require('buffer');
const { normalizePhone } = require('./src/utils/phone');
const { cloudinary } = require('./src/utils/cloudinary');

const API_BASE = `http://localhost:${process.env.PORT || 3005}`;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET non défini');
  process.exit(1);
}

const doctorPhone = '+242060000001';
const labPhone = '+242068582563';

function makeToken(user) {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, is_active: true, banned: false },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function api(method, path, token, body, isForm = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

function green(s) { return '\x1b[32m' + s + '\x1b[0m'; }
function red(s) { return '\x1b[31m' + s + '\x1b[0m'; }
function section(n, title) { console.log(`\n=== ${n}. ${title} ===`); }
function ok(msg) { console.log(green('  ✓'), msg); }
function ko(msg, extra = '') { console.log(red('  ✗'), msg, extra); }

async function run() {
  const results = [];
  let patient = null;
  let doctor = null;
  let lab = null;
  let otherDoctor = null;
  let prescriptionId = null;
  let labResultId = null;
  let publicId = null;

  try {
    // 0. Récupérer les comptes test
    section(0, 'Préparation des comptes');
    const doctorRow = await pool.query('SELECT id, phone, role, is_active FROM users WHERE phone = $1', [normalizePhone(doctorPhone)]);
    const labRow = await pool.query('SELECT id, phone, role, is_active FROM users WHERE phone = $1', [normalizePhone(labPhone)]);
    const otherDoctorRow = await pool.query("SELECT id, phone, role FROM users WHERE role = 'doctor' AND phone != $1 LIMIT 1", [normalizePhone(doctorPhone)]);

    if (!doctorRow.rows.length) throw new Error('Médecin test introuvable');
    if (!labRow.rows.length) throw new Error('Labo test introuvable');
    if (!otherDoctorRow.rows.length) throw new Error('Second médecin test introuvable');

    doctor = doctorRow.rows[0];
    lab = labRow.rows[0];
    otherDoctor = otherDoctorRow.rows[0];

    ok(`Médecin ${doctor.phone} (id=${doctor.id})`);
    ok(`Labo ${lab.phone} (id=${lab.id})`);
    ok(`Médecin non autorisé ${otherDoctor.phone} (id=${otherDoctor.id})`);

    // 1. Créer un patient test
    section(1, 'Création patient test (sans consentement prescriptions_labo)');
    const random8 = (Date.now() % 100000000).toString().padStart(8, '0');
    const testPhoneRaw = '+2420' + random8;
    const testPhone = normalizePhone(testPhoneRaw);
    const hash = await bcrypt.hash('TestE2E!' + Date.now(), 10);

    const patientRow = await pool.query(
      `INSERT INTO users (phone, role, full_name, first_name, last_name, is_active, banned, trust_score, password_hash, cgu_accepted, created_at)
       VALUES ($1, 'patient', 'Patient E2E', 'Patient', 'E2E', true, false, 80, $2, true, NOW())
       ON CONFLICT (phone) DO UPDATE SET is_active = true, banned = false RETURNING id, phone, role`,
      [testPhone, hash]
    );
    patient = patientRow.rows[0];
    ok(`Patient créé ${patient.phone} (id=${patient.id})`);

    // 2. Médecin crée une prescription labo
    section(2, 'Création prescription labo par le médecin');
    const doctorToken = makeToken(doctor);
    const prescriptionRes = await api('POST', '/api/v1/lab/prescribe', doctorToken, {
      patient_phone: testPhone,
      doctor_phone: doctor.phone,
      lab_phone: lab.phone,
      examens: 'Glycémie à jeun',
      instructions: 'Test e2e BHP labo',
      priorite: 'normale'
    });

    if (prescriptionRes.status !== 201 || !prescriptionRes.json?.data?.id) {
      throw new Error(`Prescription échouée : ${prescriptionRes.status} ${prescriptionRes.text}`);
    }
    prescriptionId = prescriptionRes.json.data.id;
    ok(`Prescription labo créée id=${prescriptionId}`);

    // 3. Labo tente upload SANS consentement -> 403
    section(3, 'Upload labo SANS consentement (attendu 403)');
    const labToken = makeToken(lab);
    const formNoConsent = new FormData();
    formNoConsent.append('lab_prescription_id', prescriptionId);
    formNoConsent.append('patient_phone', testPhone);
    formNoConsent.append('lab_phone', lab.phone);
    formNoConsent.append('doctor_phone', doctor.phone);
    formNoConsent.append('resultats', 'Résultat glycémie normal');
    const blobNoConsent = new Blob([Buffer.from('fake result no consent')], { type: 'application/pdf' });
    formNoConsent.append('fichier', blobNoConsent, 'resultat_no_consent.pdf');

    const uploadNoConsent = await api('POST', '/api/v1/lab/results/submit', labToken, formNoConsent, true);
    if (uploadNoConsent.status === 403) {
      ok(`Refus 403 reçu : ${uploadNoConsent.json?.message || 'OK'}`);
      results.push({ step: 'refus sans consentement', status: 'OK' });
    } else {
      throw new Error(`Attendu 403, reçu ${uploadNoConsent.status} : ${uploadNoConsent.text}`);
    }

    // 4. Patient accorde le consentement prescriptions_labo
    section(4, 'Consentement prescriptions_labo accordé par le patient');
    const patientToken = makeToken(patient);
    const consentRes = await api('POST', '/api/v1/consent/prescriptions_labo', patientToken);
    if (consentRes.status !== 200 || !consentRes.json?.success) {
      throw new Error(`Consentement échoué : ${consentRes.status} ${consentRes.text}`);
    }
    ok('Consentement accordé');

    // 5. Labo re-tente upload AVEC consentement -> 201
    section(5, 'Upload labo AVEC consentement (attendu 201)');
    const formWithConsent = new FormData();
    formWithConsent.append('lab_prescription_id', prescriptionId);
    formWithConsent.append('patient_phone', testPhone);
    formWithConsent.append('lab_phone', lab.phone);
    formWithConsent.append('doctor_phone', doctor.phone);
    formWithConsent.append('resultats', 'Glycémie : 0.92 g/L - NORMALE');
    const blobWithConsent = new Blob([Buffer.from('Résultat glycémie normal')], { type: 'application/pdf' });
    formWithConsent.append('fichier', blobWithConsent, 'resultat_glycemie.pdf');

    const uploadRes = await api('POST', '/api/v1/lab/results/submit', labToken, formWithConsent, true);
    if (uploadRes.status !== 201 || !uploadRes.json?.data?.id) {
      throw new Error(`Upload échoué : ${uploadRes.status} ${uploadRes.text}`);
    }
    const uploadData = uploadRes.json.data;
    labResultId = uploadData.id;
    publicId = uploadData.fichier_public_id;
    if (!publicId) throw new Error('fichier_public_id manquant dans la réponse upload');
    ok(`Résultat labo uploadé id=${labResultId}, public_id=${publicId}`);
    results.push({ step: 'upload avec consentement', status: 'OK' });

    // 6. Médecin prescripteur télécharge
    section(6, 'Téléchargement par le médecin prescripteur');
    const dlDoctor = await api('GET', `/api/v1/doctors/lab-results/${labResultId}/download`, doctorToken);
    if (dlDoctor.status !== 200 || !dlDoctor.json?.download_url) {
      throw new Error(`Téléchargement médecin échoué : ${dlDoctor.status} ${dlDoctor.text}`);
    }
    const doctorUrl = dlDoctor.json.download_url;
    ok(`URL signée médecin reçue (expire dans ${dlDoctor.json.expires_in}s)`);

    const headDoctor = await fetch(doctorUrl, { method: 'HEAD' });
    if (headDoctor.status !== 200) {
      const headDoctorText = await headDoctor.text();
      throw new Error(
        `HEAD médecin échoué : ${headDoctor.status}\nCorps : ${headDoctorText}`
      );
    }
    ok(`HEAD Cloudinary médecin OK (200)`);
    results.push({ step: 'download médecin', status: 'OK' });

    // 7. Patient télécharge
    section(7, 'Téléchargement par le patient');
    const dlPatient = await api('GET', `/api/v1/patients/lab-results/${labResultId}/download`, patientToken);
    if (dlPatient.status !== 200 || !dlPatient.json?.download_url) {
      throw new Error(`Téléchargement patient échoué : ${dlPatient.status} ${dlPatient.text}`);
    }
    const patientUrl = dlPatient.json.download_url;
    ok('URL signée patient reçue');

    const headPatient = await fetch(patientUrl, { method: 'HEAD' });
    if (headPatient.status !== 200) throw new Error(`HEAD patient échoué : ${headPatient.status}`);
    ok(`HEAD Cloudinary patient OK (200)`);
    results.push({ step: 'download patient', status: 'OK' });

    // 8. Autre médecin tente -> 403
    section(8, 'Tentative de téléchargement par un médecin non autorisé (attendu 403)');
    const otherDoctorToken = makeToken(otherDoctor);
    const dlOther = await api('GET', `/api/v1/doctors/lab-results/${labResultId}/download`, otherDoctorToken);
    if (dlOther.status === 403) {
      ok(`Refus 403 reçu : ${dlOther.json?.message || 'OK'}`);
      results.push({ step: 'download non autorisé', status: 'OK' });
    } else {
      throw new Error(`Attendu 403, reçu ${dlOther.status} : ${dlOther.text}`);
    }

    // 9. Vérifier les logs lab_result_downloads
    section(9, 'Vérification des logs lab_result_downloads');
    const logs = await pool.query(
      `SELECT status, accessed_by_role, accessed_by_phone FROM lab_result_downloads WHERE lab_result_id = $1 ORDER BY downloaded_at`,
      [labResultId]
    );
    const granted = logs.rows.filter(r => r.status === 'granted').length;
    const denied = logs.rows.filter(r => r.status === 'denied').length;
    if (granted !== 2 || denied !== 1) {
      throw new Error(`Logs incorrects : ${granted} granted, ${denied} denied (attendu 2 granted, 1 denied)`);
    }
    ok('Logs : 2 granted + 1 denied');
    results.push({ step: 'audit logs', status: 'OK' });

    console.log('\n' + green('=== E2E LABO BHP : SUCCÈS ==='));
    console.log('Résultat :', results);
  } catch (err) {
    console.error('\n' + red('=== E2E LABO BHP : ÉCHEC ==='));
    console.error(err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    // Nettoyage
    section(10, 'Nettoyage des données de test');
    try {
      if (labResultId) {
        await pool.query('DELETE FROM lab_result_downloads WHERE lab_result_id = $1', [labResultId]);
        await pool.query('DELETE FROM lab_results WHERE id = $1', [labResultId]);
      }
      if (prescriptionId) {
        await pool.query('DELETE FROM lab_prescriptions WHERE id = $1', [prescriptionId]);
      }
      if (patient) {
        await pool.query("DELETE FROM patient_consents WHERE patient_id IN (SELECT id FROM users WHERE first_name = 'Patient' AND last_name = 'E2E')");
        await pool.query("UPDATE users SET is_active = false WHERE first_name = 'Patient' AND last_name = 'E2E'");
      }
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { type: 'authenticated' });
      }
      ok('Données de test nettoyées');
    } catch (cleanupErr) {
      console.error(red('  Erreur nettoyage :'), cleanupErr.message);
    }
    await pool.end();
  }
}

run();
