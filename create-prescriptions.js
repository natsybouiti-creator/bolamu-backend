require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    appointment_id INTEGER REFERENCES appointments(id),
    patient_phone VARCHAR(20) NOT NULL,
    doctor_phone VARCHAR(20) NOT NULL,
    medications TEXT NOT NULL,
    instructions TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
)`;

p.query(sql, (err) => {
    if (err) {
        console.log('ERREUR:', err.message);
    } else {
        console.log('OK: table prescriptions créée !');
    }
    p.end();
});