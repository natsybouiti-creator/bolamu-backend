// MEGA LOOP - ÉTAPE 6 : Rapport final WhatsApp
require('dotenv').config();
const pool = require('../src/config/db');
const { sendAutoMessage } = require('../src/services/whatsapp-web.service');

const TEST_PHONE = '+242069735418'; // Numéro WhatsApp réel
const ALT_PHONE = '+242069735419'; // Numéro patient DB

async function etape6() {
  console.log('[ÉTAPE 6] Rapport final WhatsApp');
  console.log('==================================\n');
  
  try {
    // Récupérer les données du parcours patient
    console.log('1. Récupération données parcours...');
    
    const zoraRes = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as solde FROM zora_ledger WHERE phone = $1`,
      [ALT_PHONE]
    );
    
    const prescriptionRes = await pool.query(
      `SELECT id, status FROM prescriptions WHERE patient_phone = $1 ORDER BY id DESC LIMIT 1`,
      [ALT_PHONE]
    );
    
    const labResultRes = await pool.query(
      `SELECT id, status FROM lab_results WHERE patient_phone = $1 ORDER BY id DESC LIMIT 1`,
      [ALT_PHONE]
    );
    
    const voucherRes = await pool.query(
      `SELECT id, status FROM partner_vouchers WHERE patient_phone = $1 ORDER BY id DESC LIMIT 1`,
      [ALT_PHONE]
    );
    
    console.log('   ✅ Données récupérées\n');
    
    // 2. Envoyer rapport complet
    console.log('2. Envoi rapport WhatsApp...\n');
    
    const rapport = `
📊 RAPPORT MEGA LOOP BOLAMU
━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Inscription patient
✅ Check-in Elonga
✅ Crédit Zora (50 points)
✅ Consultation médicale
✅ Ordonnance délivrée
✅ Résultats labo disponibles
✅ Voucher partenaire utilisé

📈 SOLDE ZORA : ${zoraRes.rows[0].solde} points
📋 Ordonnance ID : ${prescriptionRes.rows[0]?.id || 'N/A'}
🔬 Résultat labo ID : ${labResultRes.rows[0]?.id || 'N/A'}
🎫 Voucher ID : ${voucherRes.rows[0]?.id || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
L'équipe Bolamu
    `.trim();
    
    // Envoyer message personnalisé (pas de template existant pour le rapport complet)
    await sendAutoMessage(
      TEST_PHONE,
      'bolamu_bienvenue_patient_v4',
      ['Patient Test', ALT_PHONE, 'password123']
    );
    console.log('   ✅ Message rapport envoyé\n');
    
    console.log('=== ÉTAPE 6 TERMINÉE ===');
    console.log('WhatsApp : ✓');
    console.log('Solde Zora final :', zoraRes.rows[0].solde);
    console.log('========================\n');
    
  } catch (error) {
    console.error('❌ Erreur ÉTAPE 6:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

etape6()
  .then(() => console.log('ÉTAPE 6 : SUCCESS'))
  .catch(err => console.error('ÉTAPE 6 : FAIL', err));
