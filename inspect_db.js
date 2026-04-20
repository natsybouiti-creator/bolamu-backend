require('dotenv').config();
const pool = require('./src/config/db');

async function inspectTables() {
    console.log('=== INSPECTION DES TABLES BOLAMU ===\n');
    
    try {
        // 1. Table payments
        console.log('1. STRUCTURE TABLE PAYMENTS:');
        const paymentsQuery = `
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'payments' 
            ORDER BY ordinal_position
        `;
        const paymentsResult = await pool.query(paymentsQuery);
        console.log('Colonnes payments:');
        paymentsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 2. Table users
        console.log('\n2. STRUCTURE TABLE USERS:');
        const usersQuery = `
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `;
        const usersResult = await pool.query(usersQuery);
        console.log('Colonnes users:');
        usersResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 3. Vérifier si table subscriptions existe
        console.log('\n3. VERIFICATION TABLE SUBSCRIPTIONS:');
        try {
            const subsCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'subscriptions'
                );
            `);
            if (subsCheck.rows[0].exists) {
                console.log('Table subscriptions existe:');
                const subsQuery = `
                    SELECT column_name, data_type, is_nullable, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'subscriptions' 
                    ORDER BY ordinal_position
                `;
                const subsResult = await pool.query(subsQuery);
                subsResult.rows.forEach(col => {
                    console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
                });
            } else {
                console.log('Table subscriptions n\'existe pas');
            }
        } catch (e) {
            console.log('Erreur vérification subscriptions:', e.message);
        }
        
        // 4. Table platform_config
        console.log('\n4. STRUCTURE TABLE PLATFORM_CONFIG:');
        try {
            const configQuery = `
                SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'platform_config' 
                ORDER BY ordinal_position
            `;
            const configResult = await pool.query(configQuery);
            console.log('Colonnes platform_config:');
            configResult.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
        } catch (e) {
            console.log('Erreur platform_config:', e.message);
        }
        
        // 5. Table appointments
        console.log('\n5. STRUCTURE TABLE APPOINTMENTS:');
        const apptsQuery = `
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'appointments' 
            ORDER BY ordinal_position
        `;
        const apptsResult = await pool.query(apptsQuery);
        console.log('Colonnes appointments:');
        apptsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
        });
        
        // 6. Vérifier tables spécifiques (doctors, pharmacies, laboratories)
        console.log('\n6. VERIFICATION TABLES SPÉCIFIQUES:');
        const specificTables = ['doctors', 'pharmacies', 'laboratories'];
        
        for (const tableName of specificTables) {
            try {
                const existsCheck = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = '${tableName}'
                    );
                `);
                
                if (existsCheck.rows[0].exists) {
                    console.log(`\nTable ${tableName} existe:`);
                    const tableQuery = `
                        SELECT column_name, data_type, is_nullable, column_default 
                        FROM information_schema.columns 
                        WHERE table_name = '${tableName}' 
                        ORDER BY ordinal_position
                    `;
                    const tableResult = await pool.query(tableQuery);
                    
                    // Vérifier colonnes de localisation
                    const locationCols = ['latitude', 'longitude', 'adresse', 'address', 'subscription_plan'];
                    tableResult.rows.forEach(col => {
                        if (locationCols.includes(col.column_name.toLowerCase())) {
                            console.log(`  *** ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
                        } else {
                            console.log(`      ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
                        }
                    });
                } else {
                    console.log(`Table ${tableName} n\'existe pas`);
                }
            } catch (e) {
                console.log(`Erreur vérification ${tableName}:`, e.message);
            }
        }
        
        // 7. Lister toutes les tables
        console.log('\n7. LISTE COMPLÈTE DES TABLES:');
        const allTablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `;
        const allTablesResult = await pool.query(allTablesQuery);
        console.log('Tables disponibles:');
        allTablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });
        
    } catch (error) {
        console.error('Erreur lors de l\'inspection:', error);
    } finally {
        await pool.end();
        console.log('\n=== INSPECTION TERMINÉE ===');
    }
}

inspectTables();
