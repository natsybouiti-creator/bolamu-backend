const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveFinale() {
  const client = await pool.connect();
  try {
    console.log('=== PREUVE FINALE B6 ===\n');
    
    // Check 1: Tables B6 existent
    const tablesResult = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('zora_vouchers', 'zora_rewards', 'zora_points', 'zora_ledger', 'zora_partners')
       ORDER BY table_name`
    );
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`Check 1 - Tables B6: ${tables.length}/5 existent (${tables.join(', ')})`);
    
    // Check 2: zora_vouchers structure
    const vouchersColumns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'zora_vouchers' ORDER BY ordinal_position`
    );
    const voucherCols = vouchersColumns.rows.map(r => r.column_name);
    const requiredVoucherCols = ['id', 'uuid', 'phone', 'reward_id', 'partner_id', 'points_spent', 'discount_value', 'status', 'issued_at', 'expires_at'];
    const missingVoucherCols = requiredVoucherCols.filter(c => !voucherCols.includes(c));
    console.log(`Check 2 - zora_vouchers structure: ${missingVoucherCols.length === 0 ? '✓' : '❌'} (${missingVoucherCols.length} manquants)`);
    
    // Check 3: zora_rewards structure
    const rewardsColumns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'zora_rewards' ORDER BY ordinal_position`
    );
    const rewardCols = rewardsColumns.rows.map(r => r.column_name);
    const requiredRewardCols = ['id', 'title', 'points_cost', 'discount_value', 'discount_type', 'partner_id', 'is_active'];
    const missingRewardCols = requiredRewardCols.filter(c => !rewardCols.includes(c));
    console.log(`Check 3 - zora_rewards structure: ${missingRewardCols.length === 0 ? '✓' : '❌'} (${missingRewardCols.length} manquants)`);
    
    // Check 4: zora_points structure
    const pointsColumns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'zora_points' ORDER BY ordinal_position`
    );
    const pointCols = pointsColumns.rows.map(r => r.column_name);
    const requiredPointCols = ['phone', 'balance', 'updated_at'];
    const missingPointCols = requiredPointCols.filter(c => !pointCols.includes(c));
    console.log(`Check 4 - zora_points structure: ${missingPointCols.length === 0 ? '✓' : '❌'} (${missingPointCols.length} manquants)`);
    
    // Check 5: zora_ledger structure
    const ledgerColumns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'zora_ledger' ORDER BY ordinal_position`
    );
    const ledgerCols = ledgerColumns.rows.map(r => r.column_name);
    const requiredLedgerCols = ['phone', 'points', 'category', 'action_type', 'earned_at'];
    const missingLedgerCols = requiredLedgerCols.filter(c => !ledgerCols.includes(c));
    console.log(`Check 5 - zora_ledger structure: ${missingLedgerCols.length === 0 ? '✓' : '❌'} (${missingLedgerCols.length} manquants)`);
    
    // Check 6: Routes partenaire créées
    const fs = require('fs');
    const path = require('path');
    const partenaireRoutesPath = path.join(__dirname, '../src/routes/partenaire.routes.js');
    const partenaireRoutesExists = fs.existsSync(partenaireRoutesPath);
    const partenaireRoutesContent = partenaireRoutesExists ? fs.readFileSync(partenaireRoutesPath, 'utf8') : '';
    const hasVoucherValidate = partenaireRoutesContent.includes('/voucher/validate');
    const hasValidations = partenaireRoutesContent.includes('/validations');
    console.log(`Check 6 - Routes partenaire: ${partenaireRoutesExists && hasVoucherValidate && hasValidations ? '✓' : '❌'}`);
    
    // Check 7: Service zora-voucher créé
    const servicePath = path.join(__dirname, '../src/services/zora-voucher.service.js');
    const serviceExists = fs.existsSync(servicePath);
    const serviceContent = serviceExists ? fs.readFileSync(servicePath, 'utf8') : '';
    const hasGenerateVoucher = serviceContent.includes('generateVoucher');
    const hasValidateVoucher = serviceContent.includes('validateVoucher');
    console.log(`Check 7 - Service zora-voucher: ${serviceExists && hasGenerateVoucher && hasValidateVoucher ? '✓' : '❌'}`);
    
    // Check 8: Controller partenaire créé
    const controllerPath = path.join(__dirname, '../src/controllers/partenaire.controller.js');
    const controllerExists = fs.existsSync(controllerPath);
    const controllerContent = controllerExists ? fs.readFileSync(controllerPath, 'utf8') : '';
    const hasValidateVoucherHandler = controllerContent.includes('validateVoucherHandler');
    console.log(`Check 8 - Controller partenaire: ${controllerExists && hasValidateVoucherHandler ? '✓' : '❌'}`);
    
    // Check 9: Dashboard partenaire mis à jour
    const dashboardPath = path.join(__dirname, '../public/partenaire/dashboard.html');
    const dashboardExists = fs.existsSync(dashboardPath);
    const dashboardContent = dashboardExists ? fs.readFileSync(dashboardPath, 'utf8') : '';
    const hasPartenaireValidate = dashboardContent.includes('/partenaire/voucher/validate');
    const hasPartenaireValidations = dashboardContent.includes('/partenaire/validations');
    console.log(`Check 9 - Dashboard partenaire: ${dashboardExists && hasPartenaireValidate && hasPartenaireValidations ? '✓' : '❌'}`);
    
    // Check 10: Templates WhatsApp ajoutés
    const whatsappPath = path.join(__dirname, '../src/services/whatsapp-web.service.js');
    const whatsappExists = fs.existsSync(whatsappPath);
    const whatsappContent = whatsappExists ? fs.readFileSync(whatsappPath, 'utf8') : '';
    const hasVoucherGenere = whatsappContent.includes('bolamu_voucher_genere');
    const hasVoucherUtilise = whatsappContent.includes('bolamu_voucher_utilise');
    console.log(`Check 10 - Templates WhatsApp: ${whatsappExists && hasVoucherGenere && hasVoucherUtilise ? '✓' : '❌'}`);
    
    console.log('\n=== RÉSUMÉ ===');
    const allPassed = tables.length === 5 && 
                      missingVoucherCols.length === 0 && 
                      missingRewardCols.length === 0 && 
                      missingPointCols.length === 0 && 
                      missingLedgerCols.length === 0 &&
                      partenaireRoutesExists && hasVoucherValidate && hasValidations &&
                      serviceExists && hasGenerateVoucher && hasValidateVoucher &&
                      controllerExists && hasValidateVoucherHandler &&
                      dashboardExists && hasPartenaireValidate && hasPartenaireValidations &&
                      whatsappExists && hasVoucherGenere && hasVoucherUtilise;
    
    if (allPassed) {
      console.log('✓ PASS: Boucle 6 complète');
    } else {
      console.log('❌ FAIL: Certains checks échoués');
    }
  } catch (error) {
    console.error('❌ Erreur preuve finale:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveFinale();
