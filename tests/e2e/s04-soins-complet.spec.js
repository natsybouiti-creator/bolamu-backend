const { test, expect } = require('@playwright/test');

/**
 * SCENARIO S04 — Parcours soins complet
 * Teste le flux complet: RDV → Secrétaire → Médecin → Pharmacie → Labo
 * 
 * COMPTES:
 * - Patient : +242069735418 / TestNouveau2026!
 * - Secrétaire : +242077000001 / bolamu2026
 * - Médecin : +242060000001 / bolamu2026
 * - Pharmacie : +242066226116 / WR383LMW
 * - Laboratoire : +242068582563 / bolamu2026
 */

const BASE_URL = 'https://www.bolamu.co';
const API_URL = 'https://api.bolamu.co/api/v1';

const ACCOUNTS = {
  patient: { phone: '+242069735418', password: 'TestNouveau2026!' },
  secretaire: { phone: '+242077000001', password: 'bolamu2026' },
  medecin: { phone: '+242060000001', password: 'bolamu2026' },
  pharmacie: { phone: '+242066226116', password: 'WR383LMW' },
  laboratoire: { phone: '+242068582563', password: 'bolamu2026' }
};

// Helper pour login et récupérer token
async function login(phone, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  const data = await response.json();
  if (!data.success) throw new Error(`Login failed: ${data.message}`);
  return data.accessToken; // Note: accessToken (camelCase) pas access_token
}

// Helper pour API calls avec auth
async function apiCall(endpoint, method, body, token) {
  const headers = { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  return await response.json();
}

test.describe('S04 — Parcours soins complet', () => {
  let patientToken, secretaireToken, medecinToken, pharmacieToken, laboratoireToken;
  let appointmentId, sessionCode, prescriptionId, labPrescriptionId;
  const testDate = new Date().toISOString().split('T')[0]; // Aujourd'hui YYYY-MM-DD

  test.beforeAll(async () => {
    // Login tous les acteurs
    patientToken = await login(ACCOUNTS.patient.phone, ACCOUNTS.patient.password);
    secretaireToken = await login(ACCOUNTS.secretaire.phone, ACCOUNTS.secretaire.password);
    medecinToken = await login(ACCOUNTS.medecin.phone, ACCOUNTS.medecin.password);
    pharmacieToken = await login(ACCOUNTS.pharmacie.phone, ACCOUNTS.pharmacie.password);
    laboratoireToken = await login(ACCOUNTS.laboratoire.phone, ACCOUNTS.laboratoire.password);
    
    console.log('✅ Tous les logins réussis');
  });

  test('Étape 1: Patient prend RDV', async ({ page }) => {
    await page.goto(`${BASE_URL}/patient/dashboard.html`);
    await page.waitForTimeout(3000);

    // Vérifier protocole
    const ok = await page.evaluate(() => !!window.__bolamu_test);
    if (!ok) throw new Error('Protocole absent — vérifier le dashboard');

    // Naviguer vers accueil
    await page.evaluate(() => window.__bolamu_test.goAccueil());
    await page.waitForTimeout(3000);

    // Ouvrir modal RDV
    await page.evaluate(() => window.__bolamu_test.openModal());
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 's04-01-modal-rdv.png' });

    // Sélectionner médecin (ID 1 = Dr. Mbemba Jean)
    await page.evaluate(() => window.__bolamu_test.rdvSelectDoctor('1'));
    await page.waitForTimeout(1500);

    // Sélectionner date demain
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.evaluate((d) => window.__bolamu_test.rdvSelectDate(d), dateStr);
    await page.waitForTimeout(2000);

    // Sélectionner créneau 09:00
    await page.evaluate(() => window.__bolamu_test.rdvSelectSlot('09:00'));
    await page.waitForTimeout(1000);

    // Confirmer RDV via API directe
    const rdvResult = await apiCall('/appointments/book', 'POST', {
      patient_phone: ACCOUNTS.patient.phone,
      doctor_id: 1,
      date: dateStr,
      time: '09:00'
    }, patientToken);

    console.log('📋 RDV créé:', JSON.stringify(rdvResult));
    expect(rdvResult.success).toBe(true);
    
    appointmentId = rdvResult.appointment.id;
    sessionCode = rdvResult.appointment.session_code;
    
    await page.screenshot({ path: 's04-02-rdv-confirme.png' });
    await page.evaluate(() => window.__bolamu_test.closeModal());
  });

  test('Étape 2: Secrétaire confirme RDV', async ({ page }) => {
    await page.goto(`${BASE_URL}/secretaire/dashboard.html`);
    await page.waitForTimeout(3000);

    // Login secrétaire via API
    await page.evaluate(async (phone, password) => {
      const r = await fetch('/api/v1/secretariat/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('bolamu_secretaire_token', data.token);
        localStorage.setItem('bolamu_secretaire_phone', phone);
      }
    }, ACCOUNTS.secretaire.phone, ACCOUNTS.secretaire.password);
    await page.waitForTimeout(2000);

    // Confirmer RDV via API
    const confirmResult = await apiCall(`/secretariat/rdv/${appointmentId}/status`, 'PATCH', {
      status: 'confirme'
    }, secretaireToken);

    console.log('✅ RDV confirmé par secrétaire:', JSON.stringify(confirmResult));
    expect(confirmResult.success).toBe(true);
    
    await page.screenshot({ path: 's04-03-secretaire-confirme.png' });
  });

  test('Étape 3: Vérifier WhatsApp confirmation_rdv envoyé', async () => {
    // Note: Cette vérification nécessiterait accès aux logs WhatsApp
    // Pour l'instant, on vérifie que l'appointment a le bon statut
    const rdvCheck = await apiCall(`/appointments/patient/${encodeURIComponent(ACCOUNTS.patient.phone)}`, 'GET', null, patientToken);
    
    console.log('📱 Statut RDV après confirmation:', JSON.stringify(rdvCheck));
    expect(rdvCheck.success).toBe(true);
    expect(rdvCheck.appointments[0].status).toBe('confirme');
    
    // TODO: Vérifier logs WhatsApp quand endpoint disponible
    console.log('⚠️  Vérification WhatsApp logs: endpoint non disponible (à implémenter)');
  });

  test('Étape 4: Secrétaire fait check-in patient', async ({ page }) => {
    await page.goto(`${BASE_URL}/secretaire/dashboard.html`);
    await page.waitForTimeout(3000);

    // Marquer RDV en attente (check-in)
    const checkinResult = await apiCall(`/appointments/${appointmentId}/open`, 'POST', {}, secretaireToken);
    
    console.log('🚶 Check-in patient:', JSON.stringify(checkinResult));
    expect(checkinResult.success).toBe(true);
    expect(checkinResult.appointment.status).toBe('en_cours');
    
    await page.screenshot({ path: 's04-04-checkin-patient.png' });
  });

  test('Étape 5: Médecin remplit compte rendu + ordonnance + prescription labo', async ({ page }) => {
    await page.goto(`${BASE_URL}/medecin/dashboard.html`);
    await page.waitForTimeout(3000);

    // Login médecin via API
    await page.evaluate(async (phone, password) => {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('bolamu_doctor_token', data.data.access_token);
        localStorage.setItem('bolamu_doctor_phone', phone);
      }
    }, ACCOUNTS.medecin.phone, ACCOUNTS.medecin.password);
    await page.waitForTimeout(2000);

    // 5a. Valider consultation avec session_code
    const validateResult = await apiCall(`/appointments/${appointmentId}/validate`, 'POST', {
      session_code: sessionCode
    }, medecinToken);
    
    console.log('✅ Consultation validée:', JSON.stringify(validateResult));
    expect(validateResult.success).toBe(true);

    // 5b. Soumettre compte rendu
    const reportResult = await apiCall('/consultation-report/submit', 'POST', {
      appointment_id: appointmentId,
      subjective: 'Patient se plaint de maux de tête',
      objective: 'TA 120/80, FC 72, Temp 37°C',
      assessment: 'Céphalée tensionnelle légère',
      plan: 'Repos, hydratation, antalgique si nécessaire'
    }, medecinToken);
    
    console.log('📝 Compte rendu soumis:', JSON.stringify(reportResult));
    expect(reportResult.success).toBe(true);

    // 5c. Créer ordonnance (1 SSP + 1 hors catalogue)
    const prescriptionResult = await apiCall('/prescriptions/create', 'POST', {
      appointment_id: appointmentId,
      patient_phone: ACCOUNTS.patient.phone,
      medications: [
        {
          name: 'Paracétamol 500mg',
          dosage: '1 comprimé matin et soir',
          duration: '3 jours',
          is_ssp: true, // SSP = gratuit
          price: 0
        },
        {
          name: 'Ibuprofène 400mg',
          dosage: '1 comprimé si douleur',
          duration: '5 jours',
          is_ssp: false, // Hors catalogue = prix partenaire
          price: 2500
        }
      ]
    }, medecinToken);
    
    console.log('💊 Ordonnance créée:', JSON.stringify(prescriptionResult));
    expect(prescriptionResult.success).toBe(true);
    prescriptionId = prescriptionResult.prescription.id;

    // 5d. Créer prescription labo
    const labPrescriptionResult = await apiCall('/lab/prescribe', 'POST', {
      appointment_id: appointmentId,
      patient_phone: ACCOUNTS.patient.phone,
      tests: [
        {
          test_name: 'NFS (Numération Formule Sanguine)',
          urgency: 'normal'
        },
        {
          test_name: 'Glycémie à jeun',
          urgency: 'normal'
        }
      ]
    }, medecinToken);
    
    console.log('🔬 Prescription labo créée:', JSON.stringify(labPrescriptionResult));
    expect(labPrescriptionResult.success).toBe(true);
    labPrescriptionId = labPrescriptionResult.prescription.id;
    
    await page.screenshot({ path: 's04-05-medecin-complete.png' });
  });

  test('Étape 6: Vérifier ordonnance visible dossier patient', async ({ page }) => {
    await page.goto(`${BASE_URL}/patient/dashboard.html`);
    await page.waitForTimeout(3000);

    // Récupérer ordonnances du patient
    const prescriptions = await apiCall(`/prescriptions/patient/${encodeURIComponent(ACCOUNTS.patient.phone)}`, 'GET', null, patientToken);
    
    console.log('📋 Ordonnances patient:', JSON.stringify(prescriptions));
    expect(prescriptions.success).toBe(true);
    expect(prescriptions.prescriptions.length).toBeGreaterThan(0);
    
    await page.evaluate(() => window.__bolamu_test.goSuivre());
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__bolamu_test.suivreDossier());
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 's04-06-dossier-ordonnance.png' });
  });

  test('Étape 7: Pharmacien scanne QR ordonnance', async ({ page }) => {
    await page.goto(`${BASE_URL}/pharmacie/dashboard.html`);
    await page.waitForTimeout(3000);

    // Login pharmacie via API
    await page.evaluate(async (phone, password) => {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('bolamu_pharmacie_token', data.data.access_token);
        localStorage.setItem('bolamu_pharmacie_phone', phone);
      }
    }, ACCOUNTS.pharmacie.phone, ACCOUNTS.pharmacie.password);
    await page.waitForTimeout(2000);

    // Scanner QR = récupérer ordonnance par session_code
    const ordonnanceScan = await apiCall(`/prescriptions/by-session/${sessionCode}`, 'GET', null, pharmacieToken);
    
    console.log('📷 Ordonnance scannée:', JSON.stringify(ordonnanceScan));
    expect(ordonnanceScan.success).toBe(true);
    
    await page.screenshot({ path: 's04-07-pharmacie-scan.png' });
  });

  test('Étape 8: Vérifier SSP = gratuit / hors catalogue = prix partenaire', async () => {
    // Récupérer l'ordonnance complète
    const ordonnance = await apiCall(`/prescriptions/by-session/${sessionCode}`, 'GET', null, pharmacieToken);
    
    console.log('💰 Détails ordonnance:', JSON.stringify(ordonnance));
    
    const medications = ordonnance.prescription.medications;
    const ssp = medications.find(m => m.is_ssp === true);
    const horsCatalogue = medications.find(m => m.is_ssp === false);
    
    console.log('✅ SSP (gratuit):', ssp);
    console.log('💵 Hors catalogue (prix partenaire):', horsCatalogue);
    
    expect(ssp).toBeDefined();
    expect(ssp.price).toBe(0);
    expect(horsCatalogue).toBeDefined();
    expect(horsCatalogue.price).toBeGreaterThan(0);
  });

  test('Étape 9: Ordonnance marquée délivrée', async ({ page }) => {
    await page.goto(`${BASE_URL}/pharmacie/dashboard.html`);
    await page.waitForTimeout(3000);

    // Confirmer délivrance
    const deliverResult = await apiCall('/prescriptions/deliver', 'POST', {
      prescription_id: prescriptionId,
      pharmacy_phone: ACCOUNTS.pharmacie.phone
    }, pharmacieToken);
    
    console.log('✅ Ordonnance délivrée:', JSON.stringify(deliverResult));
    expect(deliverResult.success).toBe(true);
    
    await page.screenshot({ path: 's04-09-ordonnance-livree.png' });
  });

  test('Étape 10: Labo reçoit prescription', async ({ page }) => {
    await page.goto(`${BASE_URL}/laboratoire/dashboard.html`);
    await page.waitForTimeout(3000);

    // Login laboratoire via API
    await page.evaluate(async (phone, password) => {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await r.json();
      if (data.success) {
        localStorage.setItem('bolamu_laboratoire_token', data.data.access_token);
        localStorage.setItem('bolamu_laboratoire_phone', phone);
      }
    }, ACCOUNTS.laboratoire.phone, ACCOUNTS.laboratoire.password);
    await page.waitForTimeout(2000);

    // Récupérer prescriptions en attente
    const pending = await apiCall('/lab/pending', 'GET', null, laboratoireToken);
    
    console.log('🔬 Prescriptions labo en attente:', JSON.stringify(pending));
    expect(pending.success).toBe(true);
    
    await page.screenshot({ path: 's04-10-labo-prescriptions.png' });
  });

  test('Étape 11: Labo saisit résultats', async ({ page }) => {
    await page.goto(`${BASE_URL}/laboratoire/dashboard.html`);
    await page.waitForTimeout(3000);

    // Soumettre résultats (simulation sans fichier upload)
    const resultsResult = await apiCall('/lab/results/submit', 'POST', {
      prescription_id: labPrescriptionId,
      results: [
        {
          test_name: 'NFS',
          status: 'normal',
          values: 'Hémoglobine: 13.5 g/dL, GB: 7500/mm³, Plaquettes: 250000/mm³'
        },
        {
          test_name: 'Glycémie',
          status: 'normal',
          values: '0.95 g/L (à jeun)'
        }
      ],
      comments: 'Résultats dans les normes'
    }, laboratoireToken);
    
    console.log('📊 Résultats labo soumis:', JSON.stringify(resultsResult));
    expect(resultsResult.success).toBe(true);
    
    await page.screenshot({ path: 's04-11-labo-resultats.png' });
  });

  test('Étape 12: Vérifier résultats dans dossier patient', async ({ page }) => {
    await page.goto(`${BASE_URL}/patient/dashboard.html`);
    await page.waitForTimeout(3000);

    // Récupérer résultats labo du patient
    const labResults = await apiCall(`/lab/results/patient/${encodeURIComponent(ACCOUNTS.patient.phone)}`, 'GET', null, patientToken);
    
    console.log('📋 Résultats labo patient:', JSON.stringify(labResults));
    expect(labResults.success).toBe(true);
    expect(labResults.results.length).toBeGreaterThan(0);
    
    await page.evaluate(() => window.__bolamu_test.goSuivre());
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__bolamu_test.suivreDossier());
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 's04-12-dossier-resultats.png' });
  });
});
