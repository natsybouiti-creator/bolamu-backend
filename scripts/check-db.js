const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkDatabase() {
    try {
        console.log('🔍 Connexion à la base de données...\n');
        
        // Diagnostic : afficher DATABASE_URL masqué
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
            const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
            console.log('📡 DATABASE_URL (masqué) :', maskedUrl, '\n');
        } else {
            console.log('⚠️  DATABASE_URL non trouvé dans .env\n');
        }
        
        // 1. Liste de toutes les tables
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('📋 TABLES EXISTANTES :');
        console.log('─'.repeat(50));
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        console.log(`\nTotal : ${tablesResult.rows.length} tables\n`);
        
        // 2. Liste de tous les ENUMs avec leurs valeurs
        const enumsResult = await pool.query(`
            SELECT t.typname AS enum_name,
                   array_agg(e.enumlabel ORDER BY e.enumsortorder) AS enum_values
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typtype = 'e'
            GROUP BY t.typname
            ORDER BY t.typname
        `);
        
        console.log('📋 ENUMS EXISTANTS :');
        console.log('─'.repeat(50));
        if (enumsResult.rows.length === 0) {
            console.log('  (aucun ENUM trouvé)');
        } else {
            enumsResult.rows.forEach(row => {
                const values = Array.isArray(row.enum_values) ? row.enum_values.join(', ') : String(row.enum_values);
                console.log(`  - ${row.enum_name} : [${values}]`);
            });
        }
        console.log(`\nTotal : ${enumsResult.rows.length} ENUMs\n`);
        
        // 3. Colonnes des tables financières si elles existent
        const financialTables = ['payments', 'partner_conventions', 'transactions_tiers_payant'];
        
        for (const tableName of financialTables) {
            const tableExists = tablesResult.rows.some(row => row.table_name === tableName);
            
            if (tableExists) {
                const columnsResult = await pool.query(`
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = $1 AND table_schema = 'public'
                    ORDER BY ordinal_position
                `, [tableName]);
                
                console.log(`📋 COLONNES DE LA TABLE "${tableName}" :`);
                console.log('─'.repeat(50));
                columnsResult.rows.forEach(col => {
                    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                    const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                    console.log(`  - ${col.column_name} : ${col.data_type} ${nullable}${defaultVal}`);
                });
                console.log(`\nTotal : ${columnsResult.rows.length} colonnes\n`);
            } else {
                console.log(`⚠️  Table "${tableName}" n'existe pas\n`);
            }
        }
        
        console.log('✅ Vérification terminée');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkDatabase();
