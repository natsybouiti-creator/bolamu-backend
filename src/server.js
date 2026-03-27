require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db'); // 🟢 Importation pour tester la connexion au démarrage

// 1. IMPORTATION DES ROUTES
const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// 2. ACTIVATION DES ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Route directe vers la Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// TEST DE CONNEXION CLOUD (Vérification Neon)
app.get('/api/v1/patients/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as cloud_time'); 
        res.json({ 
            success: true,
            message: "🚀 Succès ! Ton PC est connecté au Cloud Neon (Francfort).", 
            time: result.rows[0].cloud_time 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            message: "La connexion au Cloud a échoué.", 
            details: err.message 
        });
    }
});

// 3. LANCEMENT DU SERVEUR
const PORT = process.env.PORT || 3005; 
app.listen(PORT, async () => {
    console.log(`✅ Serveur Bolamu en ligne sur le port ${PORT}`);
    
    // 🟢 Test automatique de la connexion Cloud au démarrage
    try {
        await pool.query('SELECT 1');
        // Le message "📡 Connecté à la base de données CLOUD" s'affichera via db.js
    } catch (err) {
        console.error("❌ Impossible de joindre Neon. Vérifie ton .env !");
        console.error(err.message);
    }
});
