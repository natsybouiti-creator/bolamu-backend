const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const PostgresStore = require('./whatsapp-session-store');

const IS_RENDER = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';

let clientStatus = 'DISCONNECTED';
let clientInstance = null;

function getClient() {
  if (!clientInstance) {
    clientInstance = new Client({
      authStrategy: new RemoteAuth({
        store: new PostgresStore(),
        backupSyncIntervalMs: 300000,
        clientId: 'bolamu-whatsapp'
      }),
      puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      }
    });

    clientInstance.on('qr', async (qr) => {
      console.log('\n📱 QR CODE GÉNÉRÉ : qrcode-bolamu.png\n');
      const qrPath = path.join(__dirname, '../../qrcode-bolamu.png');
      await qrcode.toFile(qrPath, qr);
      console.log(`📱 QR code sauvegardé : ${qrPath}`);
    });

    clientInstance.on('ready', () => {
      clientStatus = 'READY';
      console.log('[WhatsApp-Web] Client prêt');
    });

    clientInstance.on('disconnected', () => {
      clientStatus = 'DISCONNECTED';
      console.log('[WhatsApp-Web] Client déconnecté');
    });
  }
  return clientInstance;
}

function initializeClient() {
  if (IS_RENDER) {
    console.log('[WhatsApp-Web] Désactivé sur Render — utilisation API Meta directe');
    clientStatus = 'DISABLED';
    return null;
  }
  const client = getClient();
  if (!client.info) {
    client.initialize();
  }
  return client;
}

// Ne pas initialiser automatiquement
const client = getClient();

async function sendWhatsAppMessage(phone, message) {
  if (clientStatus !== 'READY') {
    throw new Error('Client WhatsApp non connecté');
  }
  const chatId = phone.replace('+', '') + '@c.us';
  await client.sendMessage(chatId, message);
  await pool.query(
    `INSERT INTO notifications 
     (user_phone, type, canal, sent_at, created_at) 
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [phone, 'whatsapp_message', 'whatsapp']
  );
}

function getClientStatus() {
  return clientStatus;
}

async function sendAutoMessage(phone, templateName, params) {
  if (IS_RENDER || clientStatus !== 'READY') {
    // Fallback API Meta sur Render
    const { sendWhatsAppTemplate } = require('./whatsapp.service');
    return await sendWhatsAppTemplate(phone, templateName, params);
  }
  
  // whatsapp-web.js en local
  let message = '';
  if (templateName === 'bolamu_bienvenue_patient_v4') {
    message = `Bienvenue sur Bolamu, ${params[0]} !\nVotre compte patient est activé.\n\nConnectez-vous sur : https://bolamu.co\nIdentifiant : ${params[1]}\nMot de passe : ${params[2]}\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_rdv_confirme') {
    message = `Votre RDV Bolamu est confirmé pour le ${params[0]} à ${params[1]}.`;
  } else if (templateName === 'bolamu_groupe_rejoint') {
    message = `Bienvenue dans le groupe ${params[0]}, ${params[1]} !\nVous faites maintenant partie de l'équipe.\nConnectez-vous sur bolamu.co pour voir le classement.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_leaderboard_top3') {
    message = `Bravo ${params[0]} !\nVous êtes ${params[1]}e du classement du groupe ${params[2]}.\nSolde Zora actuel : ${params[3]} points.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_streak_milestone') {
    message = `${params[1]} jours de streak consecutifs sur Bolamu, ${params[0]} !\nVous gagnez ${params[2]} Zora bonus.\nContinuez comme ca !\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_checkin_confirme') {
    message = `Présence confirmée, ${params[0]} !\nVous avez participé à ${params[1]}.\n+${params[2]} Zora crédités sur votre compte.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_event_rappel') {
    message = `Rappel, ${params[0]} !\nL'événement ${params[1]} commence dans 1 heure.\nLieu : ${params[2]}\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_club_message') {
    message = `Message de votre club ${params[0]} :\n\n${params[1]}\n\nVotre animateur Bolamu`;
  } else if (templateName === 'bolamu_consultation_terminee') {
    message = `Consultation terminée, ${params[0]} !\nMédecin : Dr. ${params[1]}\nDiagnostic : ${params[2]}\n+50 Zora crédités.\n\nTéléchargez votre ordonnance sur bolamu.co\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_rdv_confirme_secretaire') {
    message = `RDV confirmé, ${params[0]} !\nDr. ${params[1]} — ${params[2]}\nLieu : ${params[3]}\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_ordonnance_prete') {
    message = `Votre ordonnance est prête, ${params[0]}.\nPrésentez-vous en pharmacie avec votre\nQR code Bolamu.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_ordonnance_dispensee') {
    message = `Bonne nouvelle, ${params[0]} !\nVotre ordonnance a été dispensée par\nla pharmacie ${params[1]}.\nMédicaments récupérés le ${params[2]}.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_ordonnance_dispensee_medecin') {
    message = `Votre ordonnance pour ${params[0]} a été dispensée\npar la pharmacie ${params[1]}.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_resultats_disponibles') {
    message = `${params[0]}, vos résultats d'analyses\nsont disponibles sur bolamu.co.\nLaboratoire : ${params[1]}\nConsultez-les depuis votre espace patient.\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_nouvelle_ordonnance_pharmacie') {
    message = `Nouvelle ordonnance disponible.\nPatient : ${params[0]}\nMédecin : Dr. ${params[1]}\nConnectez-vous sur bolamu.co pour traiter.\n\nBolamu`;
  } else {
    message = params.join(' ');
  }
  await sendWhatsAppMessage(phone, message);
}

module.exports = { sendWhatsAppMessage, sendAutoMessage, getClientStatus, client, initializeClient };
