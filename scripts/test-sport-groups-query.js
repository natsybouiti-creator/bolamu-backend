const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testQuery() {
    try {
        console.log('🔍 Test de la query getGroups...\n');
        
        const phone = '+242069735418';
        const city = 'brazzaville';
        
        let query = `
          SELECT
            sg.id,
            sg.name,
            sg.sport_type,
            sg.icon_name,
            sg.color_token,
            sg.description,
            sg.city,
            sg.member_count,
            sg.weekly_score,
            CASE WHEN sgm.phone IS NOT NULL THEN true ELSE false END as is_member
          FROM sport_groups sg
          LEFT JOIN sport_group_members sgm ON sg.id = sgm.group_id AND sgm.phone = $1
          WHERE sg.is_active = true
        `;
        
        const params = [phone];
        
        if (city) {
            query += ' AND sg.city = $2';
            params.push(city);
        }
        
        query += ' ORDER BY sg.name';
        
        const result = await pool.query(query, params);
        
        console.log('📋 RÉSULTAT DE LA QUERY :');
        console.log('─'.repeat(80));
        console.log(`${result.rows.length} groupes trouvés`);
        
        result.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.sport_type}) | is_member: ${row.is_member}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

testQuery();
