const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function finalProof() {
  const client = await pool.connect();
  try {
    console.log('=== LOT 4 — PREUVE FINALE SQL ===\n');

    // 1. Vérifier tables Boucle 4
    const tables = ['rendez_vous', 'consultations', 'ordonnances', 'ordonnance_items', 'medical_records'];
    let tablesOk = 0;
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      if (result.rows[0].exists) {
        console.log(`✓ Table ${table} existe`);
        tablesOk++;
      } else {
        console.log(`✗ Table ${table} manquante`);
      }
    }

    // 2. Vérifier indexes
    const indexes = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('rendez_vous', 'consultations', 'ordonnances', 'medical_records')`
    );
    console.log(`✓ Indexes: ${indexes.rows.length} trouvés`);

    // 3. Vérifier contraintes
    const constraints = await client.query(
      `SELECT conname FROM pg_constraint WHERE conrelid::regclass IN ('rendez_vous', 'consultations', 'ordonnances')`
    );
    console.log(`✓ Contraintes: ${constraints.rows.length} trouvées`);

    // 4. Vérifier routes dans server.js
    const fs = require('fs');
    const serverContent = fs.readFileSync('./src/server.js', 'utf8');
    const hasConsultationRoutes = serverContent.includes('consultationRoutes');
    const hasOrdonnanceRoutes = serverContent.includes('ordonnanceRoutes');
    console.log(`✓ Routes consultation: ${hasConsultationRoutes ? 'OK' : 'MANQUANT'}`);
    console.log(`✓ Routes ordonnance: ${hasOrdonnanceRoutes ? 'OK' : 'MANQUANT'}`);

    // 5. Vérifier services
    const fsPromises = require('fs').promises;
    const services = ['consultation.service.js', 'ordonnance.service.js'];
    let servicesOk = 0;
    for (const service of services) {
      try {
        await fsPromises.access(`./src/services/${service}`);
        console.log(`✓ Service ${service} existe`);
        servicesOk++;
      } catch {
        console.log(`✗ Service ${service} manquant`);
      }
    }

    // 6. Vérifier controllers
    const controllers = ['consultation.controller.js', 'ordonnance.controller.js'];
    let controllersOk = 0;
    for (const controller of controllers) {
      try {
        await fsPromises.access(`./src/controllers/${controller}`);
        console.log(`✓ Controller ${controller} existe`);
        controllersOk++;
      } catch {
        console.log(`✗ Controller ${controller} manquant`);
      }
    }

    // 7. Vérifier dashboard médecin
    const dashboardContent = fs.readFileSync('./public/medecin/dashboard.html', 'utf8');
    const hasQueueSection = dashboardContent.includes('file-attente');
    const hasConsultationAPI = dashboardContent.includes('/consultations/open');
    console.log(`✓ Dashboard file d'attente: ${hasQueueSection ? 'OK' : 'MANQUANT'}`);
    console.log(`✓ Dashboard API consultation: ${hasConsultationAPI ? 'OK' : 'MANQUANT'}`);

    // 8. Vérifier templates WhatsApp
    const whatsappContent = fs.readFileSync('./src/services/whatsapp-web.service.js', 'utf8');
    const hasConsultationTemplate = whatsappContent.includes('bolamu_consultation_terminee');
    const hasOrdonnanceTemplate = whatsappContent.includes('bolamu_ordonnance_prete');
    console.log(`✓ Template consultation: ${hasConsultationTemplate ? 'OK' : 'MANQUANT'}`);
    console.log(`✓ Template ordonnance: ${hasOrdonnanceTemplate ? 'OK' : 'MANQUANT'}`);

    const totalChecks = 9;
    let passedChecks = 0;
    if (tablesOk === tables.length) passedChecks++;
    if (hasConsultationRoutes) passedChecks++;
    if (hasOrdonnanceRoutes) passedChecks++;
    if (servicesOk === services.length) passedChecks++;
    if (controllersOk === controllers.length) passedChecks++;
    if (hasQueueSection) passedChecks++;
    if (hasConsultationAPI) passedChecks++;
    if (hasConsultationTemplate) passedChecks++;
    if (hasOrdonnanceTemplate) passedChecks++;

    console.log(`\nRésultat: ${passedChecks}/${totalChecks} checks validés`);
    if (passedChecks === totalChecks) {
      console.log('✅ LOT 4 — PREUVE FINALE VALIDÉE');
    } else {
      console.log('❌ LOT 4 — CHECKS MANQUANTS');
    }

  } catch (error) {
    console.error('❌ Erreur preuve finale:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

finalProof();
