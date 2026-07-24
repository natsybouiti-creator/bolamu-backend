require('dotenv').config();
const jwt = require('jsonwebtoken');

const API = process.env.API || 'http://localhost:3005/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;
const PATIENT_PHONE = '+242069735418';
const DOCTOR_PHONE = '+242060000001';

if (!JWT_SECRET) {
  console.error('JWT_SECRET manquant. Vérifiez votre .env');
  process.exit(1);
}

function signToken(phone, role) {
  return jwt.sign(
    { phone, role, validated_at: new Date().toISOString() },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

const patientToken = signToken(PATIENT_PHONE, 'patient');
const doctorToken = signToken(DOCTOR_PHONE, 'doctor');

async function api(method, path, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function assert(condition, message, details) {
  if (!condition) {
    console.error('❌', message, details || '');
    throw new Error(message);
  }
  console.log('✅', message);
}

(async () => {
  let requestId = null;
  let patient = null;

  try {
    console.log('API cible :', API);
    console.log('Patient :', PATIENT_PHONE);
    console.log('Docteur :', DOCTOR_PHONE);

    // 1. Génération du QR patient
    const gen = await api('GET', '/qr/generate', undefined, patientToken);
    assert(gen.status === 200 && gen.body.success, 'Génération QR', gen);
    const token = gen.body.data && gen.body.data.token;
    assert(token, 'QR token présent', gen.body);
    console.log('   QR token :', token.slice(0, 32) + '...');

    // 2. Vérification initiale par le médecin
    const verify1 = await api('GET', '/qr/verify?token=' + encodeURIComponent(token), undefined, doctorToken);
    assert(verify1.status === 200 && verify1.body.success, 'Vérification QR', verify1);
    patient = verify1.body.data;
    assert(patient && patient.phone, 'Profil patient retourné', verify1.body);
    assert(['granted', 'pending', 'none'].includes(patient.dossier_access), 'Statut accès DMN présent', patient);
    console.log('   Statut accès initial :', patient.dossier_access);

    // 3. Demande d'accès au dossier
    const reqAccess = await api('POST', '/doctors/patients/' + encodeURIComponent(PATIENT_PHONE) + '/request-access', undefined, doctorToken);
    assert(reqAccess.status === 200 && reqAccess.body.success, 'Demande d\'accès', reqAccess);
    requestId = reqAccess.body.request_id;
    assert(requestId, 'request_id retourné', reqAccess.body);
    console.log('   Demande #', requestId);

    // 4. Vérification QR montre maintenant pending
    const verify2 = await api('GET', '/qr/verify?token=' + encodeURIComponent(token), undefined, doctorToken);
    assert(verify2.status === 200 && verify2.body.success, 'Vérification après demande', verify2);
    assert(verify2.body.data.dossier_access === 'pending', 'Statut pending', verify2.body.data);

    // 5. Patient accorde l'accès
    const grant = await api('PATCH', '/patients/dossier-access/' + requestId, { action: 'grant' }, patientToken);
    assert(grant.status === 200 && grant.body.success, 'Autorisation patient', grant);

    // 6. Vérification QR montre granted
    const verify3 = await api('GET', '/qr/verify?token=' + encodeURIComponent(token), undefined, doctorToken);
    assert(verify3.status === 200 && verify3.body.success, 'Vérification après autorisation', verify3);
    assert(verify3.body.data.dossier_access === 'granted', 'Statut granted', verify3.body.data);

    // 7. Accès au dossier médical
    const dossier = await api('GET', '/doctors/patients/' + encodeURIComponent(PATIENT_PHONE) + '/dossier', undefined, doctorToken);
    assert(dossier.status === 200 && dossier.body.success, 'Chargement dossier médical', dossier);
    assert(dossier.body.data && dossier.body.data.constantes !== undefined, 'Dossier avec constantes', dossier.body);

    // 8. Refus final pour nettoyer l'état test
    const refuse = await api('PATCH', '/patients/dossier-access/' + requestId, { action: 'refuse' }, patientToken);
    assert(refuse.status === 200 && refuse.body.success, 'Refus final (cleanup)', refuse);

    console.log('\n🎉 Validation E2E du scanner QR réussie.');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 Échec E2E :', err.message);
    if (requestId) {
      try {
        await api('PATCH', '/patients/dossier-access/' + requestId, { action: 'refuse' }, patientToken);
      } catch {}
    }
    process.exit(1);
  }
})();
