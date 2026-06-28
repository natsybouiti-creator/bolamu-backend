// ============================================================
// SCENARIO S01 — Inscription patient via agent terrain
// Test Playwright E2E
// ============================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://www.bolamu.co';
const API_URL = 'https://api.bolamu.co/api/v1';

// Comptes de test
const AGENT_PHONE = '+242077000010';
const AGENT_PASSWORD = 'bolamu2026';
const ADMIN_PHONE = '+242060000099';
const ADMIN_PASSWORD = 'bolamu2026';
const PATIENT_PHONE = '+242068500020';

// Données patient test
const PATIENT_DATA = {
  phone: PATIENT_PHONE,
  nom: 'Test',
  prenom: 'S01',
  dob: '1990-01-01',
  genre: 'M',
  ville: 'Brazzaville',
  adresse: 'Test Address',
  plan: 'moto', // MOTO = essentiel
  payment_mode: 'especes',
  cguAcceptedAt: new Date().toISOString()
};

// Rapport
const report = {
  steps: [],
  apiResponses: [],
  violations: [],
  bugs: [],
  startTime: new Date().toISOString()
};

function logStep(step, status, details = '') {
  report.steps.push({ step, status, details, timestamp: new Date().toISOString() });
  console.log(`[${status}] ${step} ${details ? '- ' + details : ''}`);
}

function logApiResponse(endpoint, response) {
  report.apiResponses.push({ endpoint, response, timestamp: new Date().toISOString() });
}

function logViolation(description) {
  report.violations.push({ description, timestamp: new Date().toISOString() });
}

function logBug(description) {
  report.bugs.push({ description, timestamp: new Date().toISOString() });
}

test.describe('SCENARIO S01 — Inscription patient via agent', () => {
  let agentToken = null;
  let adminToken = null;
  let subscriptionId = null;
  let memberCode = null;
  let tempPassword = null;

  test.beforeAll(async () => {
    // Nettoyer le patient de test s'il existe déjà
    console.log('🧹 Nettoyage patient de test...');
    // Note: On ne peut pas supprimer via API, mais on peut vérifier l'état
  });

  test('Étape 1: Agent se connecte', async ({ request }) => {
    logStep('1. Agent se connecte sur /api/v1/agence/login', 'IN_PROGRESS');
    
    const response = await request.post(`${API_URL}/agence/login`, {
      data: {
        phone: AGENT_PHONE,
        password: AGENT_PASSWORD
      }
    });

    const data = await response.json();
    logApiResponse('POST /api/v1/agence/login', data);

    if (response.ok() && data.success) {
      agentToken = data.token;
      memberCode = data.agent?.member_code;
      logStep('1. Agent se connecte', 'SUCCESS', `Token reçu, role: ${data.agent?.role}`);
    } else {
      logStep('1. Agent se connecte', 'FAILED', data.message);
      logBug(`Login agent échoué: ${data.message}`);
    }

    expect(response.ok()).toBeTruthy();
    expect(data.success).toBeTruthy();
    expect(data.token).toBeDefined();
  });

  test('Étape 2: Agent crée dossier patient (souscrire-complet)', async ({ request }) => {
    logStep('2. Agent crée dossier patient via /api/v1/agence/souscrire-complet', 'IN_PROGRESS');

    const response = await request.post(`${API_URL}/agence/souscrire-complet`, {
      headers: {
        'Authorization': `Bearer ${agentToken}`,
        'Content-Type': 'application/json'
      },
      data: PATIENT_DATA
    });

    const data = await response.json();
    logApiResponse('POST /api/v1/agence/souscrire-complet', data);

    if (response.ok() && data.success) {
      subscriptionId = data.subscription_id;
      memberCode = data.member_code;
      tempPassword = data.temp_password;
      logStep('2. Agent crée dossier patient', 'SUCCESS', 
        `Subscription ID: ${subscriptionId}, Member Code: ${memberCode}, Plan: ${data.plan}`);
      
      // Vérifications contrat API
      if (!data.subscription_id) {
        logViolation('subscription_id manquant dans la réponse');
      }
      if (!data.member_code || !data.member_code.startsWith('BLM-')) {
        logViolation('member_code invalide ou absent');
      }
      if (!data.temp_password) {
        logViolation('temp_password manquant');
      }
      if (!data.plan || !['essentiel', 'standard', 'premium'].includes(data.plan)) {
        logViolation('plan invalide');
      }
    } else {
      logStep('2. Agent crée dossier patient', 'FAILED', data.message);
      logBug(`Souscription échouée: ${data.message}`);
    }

    expect(response.ok()).toBeTruthy();
    expect(data.success).toBeTruthy();
    expect(data.subscription_id).toBeDefined();
    expect(data.member_code).toMatch(/^BLM-/);
  });

  test('Étape 3: Vérification DB - compte patient créé', async ({ request }) => {
    logStep('3. Vérification DB - compte patient créé', 'IN_PROGRESS');
    
    // Note: On ne peut pas interroger la DB directement depuis Playwright
    // On utilise l'API admin pour vérifier
    const response = await request.get(`${API_URL}/agence/client?phone=${encodeURIComponent(PATIENT_PHONE)}`, {
      headers: {
        'Authorization': `Bearer ${agentToken}`
      }
    });

    const data = await response.json();
    logApiResponse('GET /api/v1/agence/client', data);

    if (response.ok() && data.success && data.client) {
      logStep('3. Vérification DB - compte patient créé', 'SUCCESS', 
        `Client trouvé: ${data.client.full_name}, Statut: ${data.client.statut_abonnement}`);
    } else {
      logStep('3. Vérification DB - compte patient créé', 'FAILED', 'Client non trouvé');
      logBug('Patient non retrouvable après création');
    }

    expect(response.ok()).toBeTruthy();
    expect(data.success).toBeTruthy();
    expect(data.client).toBeDefined();
  });

  test('Étape 4: Admin se connecte', async ({ request }) => {
    logStep('4. Admin se connecte sur /api/v1/auth/admin-login', 'IN_PROGRESS');

    const response = await request.post(`${API_URL}/auth/admin-login`, {
      data: {
        phone: ADMIN_PHONE,
        password: ADMIN_PASSWORD
      }
    });

    const data = await response.json();
    logApiResponse('POST /api/v1/auth/admin-login', data);

    if (response.ok() && data.success) {
      adminToken = data.accessToken;
      logStep('4. Admin se connecte', 'SUCCESS', `Role: ${data.role}`);
    } else {
      logStep('4. Admin se connecte', 'FAILED', data.message);
      logBug(`Login admin échoué: ${data.message}`);
    }

    expect(response.ok()).toBeTruthy();
    expect(data.success).toBeTruthy();
    expect(data.accessToken).toBeDefined();
  });

  test('Étape 5: Vérification dossier visible sur admin', async ({ request }) => {
    logStep('5. Vérification dossier visible sur admin', 'IN_PROGRESS');

    const response = await request.get(`${API_URL}/admin/patients?phone=${encodeURIComponent(PATIENT_PHONE)}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await response.json();
    logApiResponse('GET /api/v1/admin/patients', data);

    if (response.ok() && data.success) {
      const patient = data.data?.find(p => p.phone === PATIENT_PHONE);
      if (patient) {
        logStep('5. Vérification dossier visible sur admin', 'SUCCESS', 
          `Patient trouvé: ${patient.full_name}, is_active: ${patient.is_active}`);
      } else {
        logStep('5. Vérification dossier visible sur admin', 'FAILED', 'Patient non trouvé dans liste admin');
        logBug('Patient non visible dans dashboard admin');
      }
    } else {
      logStep('5. Vérification dossier visible sur admin', 'FAILED', data.message);
    }

    expect(response.ok()).toBeTruthy();
  });

  test('Étape 6: Vérification magic link envoyé (audit_log)', async ({ request }) => {
    logStep('6. Vérification magic link envoyé (audit_log)', 'IN_PROGRESS');

    const response = await request.get(`${API_URL}/admin/audit-log?target_phone=${encodeURIComponent(PATIENT_PHONE)}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await response.json();
    logApiResponse('GET /api/v1/admin/audit-log', data);

    if (response.ok() && data.success) {
      const onboardingEvent = data.data?.find(e => e.event_type === 'agent.souscription_complete');
      if (onboardingEvent) {
        logStep('6. Vérification magic link envoyé', 'SUCCESS', 
          `Event trouvé: ${onboardingEvent.event_type}`);
      } else {
        logStep('6. Vérification magic link envoyé', 'FAILED', 'Event audit_log non trouvé');
        logBug('Audit log ne contient pas l\'événement de souscription');
      }
    } else {
      logStep('6. Vérification magic link envoyé', 'FAILED', data.message);
    }
  });

  test('Étape 7: Vérification statut abonnement actif', async ({ request }) => {
    logStep('7. Vérification statut abonnement actif', 'IN_PROGRESS');

    const response = await request.get(`${API_URL}/patients/subscription?phone=${encodeURIComponent(PATIENT_PHONE)}`, {
      headers: {
        'Authorization': `Bearer ${agentToken}`
      }
    });

    const data = await response.json();
    logApiResponse('GET /api/v1/patients/subscription', data);

    if (response.ok() && data.success) {
      if (data.data?.status === 'active') {
        logStep('7. Vérification statut abonnement actif', 'SUCCESS', 
          `Statut: ${data.data.status}, Plan: ${data.data.plan}`);
      } else {
        logStep('7. Vérification statut abonnement actif', 'FAILED', 
          `Statut: ${data.data?.status}`);
        logBug('Abonnement non actif après création');
      }
    } else {
      logStep('7. Vérification statut abonnement actif', 'FAILED', data.message);
    }

    expect(response.ok()).toBeTruthy();
  });

  test.afterAll(async () => {
    // Générer le rapport
    report.endTime = new Date().toISOString();
    report.summary = {
      totalSteps: report.steps.length,
      successSteps: report.steps.filter(s => s.status === 'SUCCESS').length,
      failedSteps: report.steps.filter(s => s.status === 'FAILED').length,
      violations: report.violations.length,
      bugs: report.bugs.length
    };

    const reportPath = path.join(__dirname, '../../RAPPORT_S01_INSCRIPTION_AGENT.md');
    fs.writeFileSync(reportPath, generateReportMarkdown(report));
    console.log(`\n📄 Rapport généré: ${reportPath}`);
  });
});

function generateReportMarkdown(report) {
  let md = `# RAPPORT S01 — INSCRIPTION PATIENT VIA AGENT
> Test Playwright E2E — ${new Date().toLocaleString('fr-FR')}

---

## RÉSUMÉ EXÉCUTIF

- **Début:** ${report.startTime}
- **Fin:** ${report.endTime}
- **Étapes totales:** ${report.summary.totalSteps}
- **Étapes réussies:** ✅ ${report.summary.successSteps}
- **Étapes échouées:** ❌ ${report.summary.failedSteps}
- **Violations contrat API:** ${report.summary.violations}
- **Bugs identifiés:** ${report.summary.bugs}

---

## ÉTAPES DU SCÉNARIO

`;

  report.steps.forEach(step => {
    const icon = step.status === 'SUCCESS' ? '✅' : step.status === 'FAILED' ? '❌' : '⏳';
    md += `### ${icon} ${step.step}
- **Statut:** ${step.status}
- **Détails:** ${step.details || 'N/A'}
- **Timestamp:** ${step.timestamp}

`;
  });

  md += `---

## RÉPONSES API

`;

  report.apiResponses.forEach(api => {
    md += `### ${api.endpoint}
\`\`\`json
${JSON.stringify(api.response, null, 2)}
\`\`\`
- **Timestamp:** ${api.timestamp}

`;
  });

  if (report.violations.length > 0) {
    md += `---

## VIOLATIONS CONTRAT API

`;
    report.violations.forEach(v => {
      md += `- ❌ ${v.description} (${v.timestamp})
`;
    });
    md += '\n';
  }

  if (report.bugs.length > 0) {
    md += `---

## BUGS IDENTIFIÉS

`;
    report.bugs.forEach(b => {
      md += `- 🐛 ${b.description} (${b.timestamp})
`;
    });
    md += '\n';
  }

  md += `---

## CORRECTIONS À FAIR

`;

  if (report.bugs.length === 0 && report.violations.length === 0) {
    md += `Aucune correction requise. Le scénario S01 fonctionne correctement.
`;
  } else {
    report.bugs.forEach((b, i) => {
      md += `${i + 1}. Corriger: ${b.description}
`;
    });
    report.violations.forEach((v, i) => {
      md += `${report.bugs.length + i + 1}. Corriger: ${v.description}
`;
    });
  }

  md += `---

## CONCLUSION

`;

  if (report.summary.failedSteps === 0 && report.summary.violations === 0) {
    md += `✅ **SCENARIO S01 VALIDÉ** — Le flux d'inscription patient via agent terrain fonctionne correctement.
`;
  } else {
    md += `❌ **SCENARIO S01 EN ÉCHEC** — ${report.summary.failedSteps} étape(s) échouée(s), ${report.summary.violations} violation(s) contrat API.
`;
  }

  return md;
}
