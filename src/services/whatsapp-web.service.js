const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

// Map des titres courts pour notifications
const TEMPLATE_TITRES = {
  'bolamu_bienvenue_patient_v4': 'Bienvenue',
  'bolamu_bienvenue_medecin_v4': 'Bienvenue',
  'bolamu_bienvenue_pharmacie': 'Bienvenue',
  'bolamu_bienvenue_laboratoire': 'Bienvenue',
  'bolamu_bienvenue_secretaire': 'Bienvenue',
  'bolamu_bienvenue_animateur': 'Bienvenue',
  'bolamu_bienvenue_agent': 'Bienvenue',
  'bolamu_bienvenue_rh': 'Bienvenue',
  'bolamu_rdv_confirme': 'RDV confirmé',
  'bolamu_rdv_rappel': 'Rappel RDV',
  'bolamu_rdv_annule': 'RDV annulé',
  'bolamu_groupe_rejoint': 'Groupe rejoint',
  'bolamu_club_bienvenue': 'Bienvenue club',
  'bolamu_leaderboard_top3': 'Classement',
  'bolamu_streak_milestone': 'Streak atteint',
  'bolamu_checkin_confirme': 'Présence confirmée',
  'bolamu_event_inscription': 'Inscription événement',
  'bolamu_event_rappel': 'Rappel événement',
  'bolamu_event_annule': 'Événement annulé',
  'bolamu_club_message': 'Message club',
  'bolamu_consultation_terminee': 'Consultation terminée',
  'bolamu_rdv_confirme_secretaire': 'RDV confirmé',
  'bolamu_ordonnance_prete': 'Ordonnance prête',
  'bolamu_ordonnance_dispensee': 'Ordonnance délivrée',
  'bolamu_ordonnance_dispensee_medecin': 'Ordonnance délivrée',
  'bolamu_resultats_disponibles': 'Résultats disponibles',
  'bolamu_nouvelle_ordonnance_pharmacie': 'Nouvelle ordonnance',
  'bolamu_voucher_genere': 'Voucher généré',
  'bolamu_voucher_utilise': 'Voucher utilisé',
  'bolamu_zora_attribues': 'Zora reçus',
  'bolamu_zora_depense': 'Zora utilisés',
  'bolamu_zora_expiration': 'Expiration Zora',
  'bolamu_zora_cadeau_recu': 'Zora cadeau',
  'bolamu_partenaire_reduction': 'Réduction partenaire',
  'bolamu_renouvellement_abonnement': 'Renouvellement abonnement',
  'bolamu_code_acces': 'Code d\'accès',
  'bolamu_magic_link': 'Lien connexion',
  'bolamu_medecin_nouveau_rdv': 'Nouveau RDV',
  'bolamu_medecin_rdv_annule': 'RDV annulé',
  'bolamu_medecin_rdv_rappel': 'Rappel RDV',
  'bolamu_medecin_patient_checkin': 'Patient arrivé',
  'bolamu_secretaire_nouveau_rdv': 'Nouveau RDV',
  'bolamu_secretaire_patient_arrive': 'Patient arrivé',
  'bolamu_pharmacie_ordonnance': 'Ordonnance reçue',
  'bolamu_pharmacie_validee': 'Pharmacie validée',
  'bolamu_labo_analyse_prescrite': 'Analyse prescrite',
  'bolamu_labo_validee': 'Laboratoire validé',
  'bolamu_animateur_event_cree': 'Événement créé',
  'bolamu_animateur_event_valide': 'Événement validé',
  'bolamu_animateur_event_refuse': 'Événement refusé',
  'bolamu_animateur_rappel_event': 'Rappel événement',
  'bolamu_animateur_checkins': 'Récap check-ins',
  'bolamu_agent_souscription': 'Nouvelle souscription',
  'bolamu_agent_objectif_atteint': 'Objectif atteint',
  'bolamu_rh_rapport_mensuel': 'Rapport mensuel',
  'bolamu_rh_employe_inscrit': 'Employé inscrit',
  'bolamu_admin_nouveau_partenaire': 'Nouveau partenaire',
  'bolamu_admin_event_soumis': 'Événement soumis',
  'bolamu_admin_alerte_zora': 'Alerte Zora'
};

async function sendAutoMessage(phone, templateName, params) {
  try {
    if (!WAHA_BASE_URL || !WAHA_API_KEY) {
      console.error('[WhatsApp-WAHA] Configuration manquante: WAHA_BASE_URL ou WAHA_API_KEY');
      return false;
    }

    const formattedPhone = normalizePhone(phone);
    
    // Construire le message selon le template
    let message = '';
    if (templateName === 'bolamu_bienvenue_patient_v4') {
      message = `Bienvenue sur Bolamu, ${params[0]} !\nVotre compte patient est activé.\n\nConnectez-vous sur : https://bolamu.co\nIdentifiant : ${params[1]}\nMot de passe : ${params[2]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_rdv_confirme') {
      message = `Votre RDV Bolamu est confirmé pour le ${params[0]} à ${params[1]}.`;
    } else if (templateName === 'bolamu_groupe_rejoint') {
      message = `Bienvenue dans le groupe ${params[0]}, ${params[1]} !\nVous faites maintenant partie de l'équipe.\nConnectez-vous sur bolamu.co pour voir le classement.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_club_bienvenue') {
      message = `Bienvenue dans le club ${params[1]}, ${params[0]} !\nVous faites maintenant partie de la communauté.\nConnectez-vous sur bolamu.co pour voir les activités.\n\nL'équipe Bolamu`;
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
    } else if (templateName === 'bolamu_voucher_genere') {
      message = `${params[0]}, votre voucher est prêt !\nCode : ${params[1]}\nValable chez : ${params[2]}\nExpire dans 48h.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_voucher_utilise') {
      message = `${params[0]}, votre voucher a été validé.\nRécompense : ${params[1]}\nPartenaire : ${params[2]}\n\nMerci de votre fidélité — L'équipe Bolamu`;
    } else if (templateName === 'bolamu_event_inscription') {
      message = `Inscription confirmée ✅\nÉvénement : ${params[1]}\nDate : ${params[2]}\nLieu : ${params[3]}\nVotre code de session : ${params[4]}\nPrésentez ce code à l'animateur le jour J.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_animateur_event_valide') {
      message = `Événement validé ✅\nAnimateur : ${params[0]}\nÉvénement : ${params[1]}\nDate : ${params[2]}\nLieu : ${params[3]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_animateur_checkins') {
      message = `Récapitulatif check-ins ✅\nAnimateur : ${params[0]}\nÉvénement : ${params[1]}\nCheck-ins : ${params[2]}\nZora distribués : ${params[3]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_zora_attribues') {
      message = `Zora crédités 🎉\n${params[0]}, vous avez reçu ${params[1]} Zora.\nSolde total : ${params[2]} Zora\nRaison : ${params[3]}\n\nL'équipe Bolamu`;
    } else {
      message = params.join(' ');
    }
    
    const titre = TEMPLATE_TITRES[templateName] || 'Notification Bolamu';
    const chatId = formattedPhone.replace('+', '') + '@c.us';
    
    // Appel WAHA API
    const response = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY
      },
      body: JSON.stringify({
        chatId: chatId,
        text: message,
        session: 'Communaute'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[WhatsApp-WAHA] Erreur envoi:', error);
      return false;
    }
    
    const result = await response.json();
    console.log('[WhatsApp-WAHA] Message envoyé avec succès', { chatId, messageId: result.id });
    
    // INSERT notifications
    await pool.query(
      `INSERT INTO notifications 
       (user_phone, type, titre, message, canal, sent_at, created_at) 
       VALUES ($1, 'whatsapp_message', $2, $3, 'whatsapp', NOW(), NOW())`,
      [formattedPhone, titre, message]
    );
    
    return true;
  } catch (error) {
    console.error('[WhatsApp-WAHA] Erreur sendAutoMessage:', error.message);
    return false;
  }
}

module.exports = { sendAutoMessage };
