// ============================================================
// BOLAMU — Tests Playwright flux critiques
// Connexion, QR pharmacie, prescription med→pharma, paiement
// ============================================================
import { test, expect } from '@playwright/test';

const BASE = 'https://api.bolamu.co';

// ─── Comptes de test (CLAUDE.md §/qa-lead) ──────────────────
const PATIENT   = { phone: '+242069735418', password: 'TestNouveau2026!' };
const DOCTOR    = { phone: '+242060000001', password: 'bolamu2026' };
const PHARMACIE = { phone: '+242066226116', password: 'WR383LMW' };
const ADMIN     = { phone: '+242060000099', password: 'bolamu2026' };

// Helper auth
async function login(request, creds) {
  const res = await request.post(`${BASE}/api/v1/auth/login`, {
    data: { phone: creds.phone, password: creds.password }
  });
  if (!res.ok()) throw new Error(`Login failed for ${creds.phone}: ${res.status()}`);
  const { accessToken } = await res.json();
  return accessToken;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─── FLUX 1 : Connexion patient ──────────────────────────────
test.describe('FLUX 1 — Connexion patient', () => {
  test('login renvoie accessToken JWT valide', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { phone: PATIENT.phone, password: PATIENT.password }
    });
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.accessToken).toBeTruthy();
    // JWT = 3 segments séparés par des points
    expect(body.accessToken.split('.').length).toBe(3);
  });

  test('login mauvais mot de passe → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { phone: PATIENT.phone, password: 'mauvais_mdp_123' }
    });
    expect(res.status()).toBe(401);
  });

  test('profil patient accessible avec token', async ({ request }) => {
    const token = await login(request, PATIENT);
    const res = await request.get(`${BASE}/api/v1/patients/profil`, {
      headers: authHeaders(token)
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.phone || body.patient?.phone).toBeTruthy();
  });

  test('profil sans token → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/patients/profil`);
    expect(res.status()).toBe(401);
  });
});

// ─── FLUX 2 : Scan QR pharmacie (tiers payant) ───────────────
test.describe('FLUX 2 — QR tiers payant pharmacie', () => {
  let patientToken, pharmacieToken;

  test.beforeAll(async ({ request }) => {
    [patientToken, pharmacieToken] = await Promise.all([
      login(request, PATIENT),
      login(request, PHARMACIE)
    ]);
  });

  test('patient peut générer son QR tiers payant', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/qr/generate`, {
      headers: authHeaders(patientToken)
    });
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.qr_token || body.qr_token).toBeTruthy();
  });

  test('pharmacie peut vérifier un QR token valide', async ({ request }) => {
    // Générer d'abord
    const genRes = await request.get(`${BASE}/api/v1/qr/generate`, {
      headers: authHeaders(patientToken)
    });
    expect(genRes.ok()).toBeTruthy();
    const { data, qr_token } = await genRes.json();
    const token = data?.qr_token || qr_token;
    expect(token).toBeTruthy();

    // Vérifier avec le compte pharmacie
    const verifyRes = await request.post(`${BASE}/api/v1/qr/verify`, {
      headers: authHeaders(pharmacieToken),
      data: { qr_token: token }
    });
    expect(verifyRes.ok(), `HTTP ${verifyRes.status()}`).toBeTruthy();
    const body = await verifyRes.json();
    expect(body.success).toBe(true);
    expect(body.data?.discount_rate ?? body.discount_rate).toBeGreaterThan(0);
  });

  test('vérification token invalide → 404 ou 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/qr/verify`, {
      headers: authHeaders(pharmacieToken),
      data: { qr_token: 'TOKEN_INVALIDE_12345' }
    });
    expect([400, 404]).toContain(res.status());
  });
});

// ─── FLUX 3 : Prescription médecin → pharmacie ───────────────
test.describe('FLUX 3 — Prescription médecin → pharmacie', () => {
  let doctorToken, pharmacieToken;
  let createdPrescriptionId;

  test.beforeAll(async ({ request }) => {
    [doctorToken, pharmacieToken] = await Promise.all([
      login(request, DOCTOR),
      login(request, PHARMACIE)
    ]);
  });

  test('médecin peut créer une ordonnance', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/prescriptions/create`, {
      headers: authHeaders(doctorToken),
      data: {
        patient_phone: PATIENT.phone,
        doctor_phone:  DOCTOR.phone,
        medications:   'Amoxicilline 500mg - 3x/jour - 7 jours',
        instructions:  'Prendre pendant les repas, éviter alcool'
      }
    });
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    const id = body.data?.id || body.prescription?.id || body.id;
    expect(id).toBeTruthy();
    createdPrescriptionId = id;
  });

  test('pharmacie peut lire les ordonnances du patient', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/v1/prescriptions/patient/${encodeURIComponent(PATIENT.phone)}`,
      { headers: authHeaders(pharmacieToken) }
    );
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data || body.prescriptions)).toBeTruthy();
  });

  test('ordonnance créée est visible par la pharmacie', async ({ request }) => {
    if (!createdPrescriptionId) return; // dépend du test précédent

    const res = await request.get(
      `${BASE}/api/v1/prescriptions/patient/${encodeURIComponent(PATIENT.phone)}`,
      { headers: authHeaders(pharmacieToken) }
    );
    const body = await res.json();
    const list = body.data || body.prescriptions || [];
    const found = list.some(p => p.id === createdPrescriptionId);
    expect(found, `Ordonnance ${createdPrescriptionId} non trouvée`).toBeTruthy();
  });
});

// ─── FLUX 4 : Paiement abonnement ────────────────────────────
test.describe('FLUX 4 — Paiement abonnement (initiation + confirmation admin)', () => {
  let patientToken, adminToken;
  let paymentReference;

  test.beforeAll(async ({ request }) => {
    [patientToken, adminToken] = await Promise.all([
      login(request, PATIENT),
      login(request, ADMIN)
    ]);
  });

  test('patient peut initier un paiement d\'abonnement', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/initiate`, {
      headers: authHeaders(patientToken),
      data: {
        plan: 'essentiel',
        montant: 2000,
        canal: 'momo_annuel'
      }
    });
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    const ref = body.data?.reference || body.reference;
    expect(ref).toBeTruthy();
    paymentReference = ref;
  });

  test('admin peut voir la liste des paiements en attente', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/admin/payments/pending`, {
      headers: authHeaders(adminToken)
    });
    // 200 OK ou 404 si pas de paiements en attente
    expect([200, 404]).toContain(res.status());
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('initiation sans token → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/v1/payments/initiate`, {
      data: { plan: 'essentiel', montant: 2000 }
    });
    expect(res.status()).toBe(401);
  });

  test('confirmation paiement par non-admin → 403', async ({ request }) => {
    if (!paymentReference) return;
    const res = await request.post(`${BASE}/api/v1/payments/confirm/${paymentReference}`, {
      headers: authHeaders(patientToken)
    });
    expect(res.status()).toBe(403);
  });
});
