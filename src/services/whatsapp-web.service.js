const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const pool = require('../config/db');

let clientStatus = 'DISCONNECTED';
let clientInstance = null;

function getClient() {
  if (!clientInstance) {
    clientInstance = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });

    clientInstance.on('qr', (qr) => {
      console.log('\n📱 SCANNEZ CE QR CODE AVEC WHATSAPP :\n');
      qrcode.generate(qr, { small: true });
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
  let message = '';
  if (templateName === 'bolamu_bienvenue_patient_v4') {
    message = `Bienvenue sur Bolamu, ${params[0]} !\nVotre compte patient est activé.\n\nConnectez-vous sur : https://bolamu.co\nIdentifiant : ${params[1]}\nMot de passe : ${params[2]}\n\nL'équipe Bolamu`;
  } else if (templateName === 'bolamu_rdv_confirme') {
    message = `Votre RDV Bolamu est confirmé pour le ${params[0]} à ${params[1]}.`;
  } else {
    message = params.join(' ');
  }
  await sendWhatsAppMessage(phone, message);
}

module.exports = { sendWhatsAppMessage, sendAutoMessage, getClientStatus, client, initializeClient };
