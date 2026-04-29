const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditDossierMedical() {
    try {
        // Étape 1 — Structure tables dossier médical
        console.log('🔍 ÉTAPE 1 — Structure tables dossier médical\n');
        const tables = ['consultation_reports', 'lab_results', 'lab_prescriptions', 'prescriptions', 'dossier_access_log'];
        
        for (const table of tables) {
            console.log(`────────────────────────────────────────────────────────────`);
            console.log(`Table : ${table}`);
            console.log(`────────────────────────────────────────────────────────────`);
            
            const res = await pool.query(
                `SELECT column_name, data_type, is_nullable, column_default
                 FROM information_schema.columns
                 WHERE table_name = $1
                 ORDER BY ordinal_position`,
                [table]
            );
            
            if (res.rows.length === 0) {
                console.log('  ❌ Table non trouvée');
            } else {
                res.rows.forEach((row, i) => {
                    const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
                    const def = row.column_default ? ` DEFAULT ${row.column_default}` : '';
                    console.log(`  ${String(i+1).padStart(2)}. ${row.column_name.padEnd(30)} : ${row.data_type.padEnd(20)} ${nullable}${def}`);
                });
                console.log(`  Total : ${res.rows.length} colonnes`);
            }
        }
        
        // Étape 2 — Colonnes dossier médical dans users
        console.log(`\n\n🔍 ÉTAPE 2 — Colonnes dossier médical dans users\n`);
        console.log(`────────────────────────────────────────────────────────────`);
        
        const userColsRes = await pool.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_name = 'users'
             AND column_name IN ('groupe_sanguin', 'allergies', 'traitement_en_cours', 'birth_date', 'antecedents', 'height', 'weight', 'blood_pressure', 'emergency_contact_name', 'emergency_contact_phone')
             ORDER BY ordinal_position`
        );
        
        if (userColsRes.rows.length === 0) {
            console.log('  ❌ Aucune colonne dossier médical trouvée dans users');
        } else {
            userColsRes.rows.forEach((row, i) => {
                const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
                const def = row.column_default ? ` DEFAULT ${row.column_default}` : '';
                console.log(`  ${String(i+1).padStart(2)}. ${row.column_name.padEnd(30)} : ${row.data_type.padEnd(20)} ${nullable}${def}`);
            });
            console.log(`  Total : ${userColsRes.rows.length} colonnes`);
        }
        
        // Étape 6 — Table notifications
        console.log(`\n\n🔍 ÉTAPE 6 — Table notifications\n`);
        console.log(`────────────────────────────────────────────────────────────`);
        
        const notifRes = await pool.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_name = 'notifications'
             ORDER BY ordinal_position`
        );
        
        if (notifRes.rows.length === 0) {
            console.log('  ❌ Table notifications NON TROUVÉE');
        } else {
            notifRes.rows.forEach((row, i) => {
                const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
                const def = row.column_default ? ` DEFAULT ${row.column_default}` : '';
                console.log(`  ${String(i+1).padStart(2)}. ${row.column_name.padEnd(30)} : ${row.data_type.padEnd(20)} ${nullable}${def}`);
            });
            console.log(`  Total : ${notifRes.rows.length} colonnes`);
        }
        
        console.log(`\n────────────────────────────────────────────────────────────`);
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    } finally {
        await pool.end();
    }
}

auditDossierMedical();
