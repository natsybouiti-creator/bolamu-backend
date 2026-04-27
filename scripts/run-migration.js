const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Parser SQL pour séparer les instructions (gère les blocs DO $$)
function parseSQL(sql) {
    const instructions = [];
    let current = '';
    let inDoBlock = false;
    let depth = 0;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Détection bloc DO $$
        if (trimmed.startsWith('DO $$')) {
            inDoBlock = true;
            depth = 1;
            current += line + '\n';
            continue;
        }
        
        if (inDoBlock) {
            current += line + '\n';
            // Compter les $$ pour détecter la fin du bloc
            const matches = line.match(/\$\$/g);
            if (matches) {
                depth += matches.length;
                if (depth % 2 === 0) {
                    inDoBlock = false;
                    if (current.trim()) {
                        instructions.push(current.trim());
                    }
                    current = '';
                }
            }
            continue;
        }
        
        // Instructions normales (séparées par ;)
        if (trimmed.endsWith(';')) {
            current += line;
            if (current.trim()) {
                instructions.push(current.trim());
            }
            current = '';
        } else if (trimmed.length > 0) {
            current += line + '\n';
        }
    }
    
    // Ajouter la dernière instruction si elle n'a pas de ;
    if (current.trim()) {
        instructions.push(current.trim());
    }
    
    return instructions;
}

async function runMigration(migrationFile) {
    try {
        console.log('🔄 Exécution de la migration...\n');
        
        // Vérifier que le fichier existe
        const fullPath = path.resolve(migrationFile);
        if (!fs.existsSync(fullPath)) {
            console.error(`❌ Fichier introuvable : ${fullPath}`);
            process.exit(1);
        }
        
        console.log(`📄 Fichier : ${fullPath}\n`);
        
        // Lire le fichier SQL
        const sql = fs.readFileSync(fullPath, 'utf8');
        
        // Parser les instructions
        const instructions = parseSQL(sql);
        console.log(`📊 ${instructions.length} instructions détectées\n`);
        console.log('─'.repeat(60));
        
        let successCount = 0;
        let errorCount = 0;
        
        // Exécuter chaque instruction
        for (let i = 0; i < instructions.length; i++) {
            const instruction = instructions[i];
            const preview = instruction.substring(0, 60).replace(/\n/g, ' ') + (instruction.length > 60 ? '...' : '');
            
            try {
                await pool.query(instruction);
                console.log(`✅ [${i + 1}/${instructions.length}] ${preview}`);
                successCount++;
            } catch (error) {
                console.log(`❌ [${i + 1}/${instructions.length}] ${preview}`);
                console.log(`   Erreur : ${error.message}`);
                errorCount++;
            }
        }
        
        console.log('─'.repeat(60));
        console.log(`\n📊 Résumé : ${successCount} succès / ${errorCount} erreurs\n`);
        
        if (errorCount > 0) {
            console.log('⚠️  Migration terminée avec erreurs');
            process.exit(1);
        } else {
            console.log('✅ Migration exécutée avec succès');
        }
        
    } catch (error) {
        console.error('❌ Erreur fatale :');
        console.error(error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Récupérer le fichier en argument
const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('❌ Usage : node scripts/run-migration.js <fichier_migration.sql>');
    console.error('   Exemple : node scripts/run-migration.js database/migration_005_financial_tracing.sql');
    process.exit(1);
}

runMigration(migrationFile);
