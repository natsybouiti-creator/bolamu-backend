const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkTables() {
    try {
        console.log('🔍 Vérification structure tables appointments et prescriptions\n');
        
        // 1. Colonnes de appointments
        console.log('────────────────────────────────────────────────────────────');
        console.log('1. Colonnes de la table appointments :');
        console.log('────────────────────────────────────────────────────────────');
        const appointmentsRes = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'appointments' ORDER BY ordinal_position`
        );
        appointmentsRes.rows.forEach(row => {
            console.log(`  - ${row.column_name}`);
        });
        console.log(`Total : ${appointmentsRes.rows.length} colonnes\n`);
        
        // 2. Colonnes de prescriptions
        console.log('────────────────────────────────────────────────────────────');
        console.log('2. Colonnes de la table prescriptions :');
        console.log('────────────────────────────────────────────────────────────');
        const prescriptionsRes = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'prescriptions' ORDER BY ordinal_position`
        );
        prescriptionsRes.rows.forEach(row => {
            console.log(`  - ${row.column_name}`);
        });
        console.log(`Total : ${prescriptionsRes.rows.length} colonnes\n`);
        
        // 3. Vérifier si doctor_phone existe
        console.log('────────────────────────────────────────────────────────────');
        console.log('3. Présence de doctor_phone :');
        console.log('────────────────────────────────────────────────────────────');
        const hasDoctorPhoneAppointments = appointmentsRes.rows.some(row => row.column_name === 'doctor_phone');
        const hasDoctorPhonePrescriptions = prescriptionsRes.rows.some(row => row.column_name === 'doctor_phone');
        
        console.log(`  - appointments.doctor_phone : ${hasDoctorPhoneAppointments ? '✅ EXISTS' : '❌ NOT EXISTS'}`);
        console.log(`  - prescriptions.doctor_phone : ${hasDoctorPhonePrescriptions ? '✅ EXISTS' : '❌ NOT EXISTS'}`);
        
        console.log('\n✅ Vérification terminée');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkTables();
