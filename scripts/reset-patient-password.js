const bcrypt = require('bcrypt');
const pool = require('../src/config/db');

async function resetPassword() {
  const phone = '+242069735418';
  const newPassword = 'TestNouveau2026!';
  
  try {
    const client = await pool.connect();
    
    // 1. Vérifier statut du compte
    console.log('🔍 Vérification statut compte...');
    const checkResult = await client.query(
      'SELECT phone, banned, ban_reason, password_must_change FROM users WHERE phone = $1',
      [phone]
    );
    
    if (checkResult.rows.length === 0) {
      console.log('❌ Compte non trouvé');
      await client.release();
      return;
    }
    
    console.log('✅ Compte trouvé:', checkResult.rows[0]);
    
    // 2. Générer nouveau hash bcrypt
    console.log('🔐 Génération hash bcrypt...');
    const hash = await bcrypt.hash(newPassword, 10);
    console.log('🔐 Hash généré:', hash.substring(0, 30) + '...');
    
    // 3. Mettre à jour le mot de passe et password_must_change
    console.log('🔄 Mise à jour mot de passe et password_must_change...');
    const updateResult = await client.query(
      'UPDATE users SET password_hash = $1, password_must_change = false WHERE phone = $2 RETURNING phone, password_hash, password_must_change',
      [hash, phone]
    );
    
    console.log('✅ Mot de passe mis à jour:', updateResult.rows[0]);
    
    // 4. Vérifier la mise à jour
    console.log('🔍 Vérification mise à jour...');
    const verifyResult = await client.query(
      'SELECT phone, password_hash FROM users WHERE phone = $1',
      [phone]
    );
    
    console.log('✅ Vérification réussie:', verifyResult.rows[0].phone);
    console.log('📝 Nouveau mot de passe en clair:', newPassword);
    
    await client.release();
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    pool.end();
  }
}

resetPassword();
