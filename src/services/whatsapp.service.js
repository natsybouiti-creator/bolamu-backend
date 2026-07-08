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
  'bolamu_voucher_payout': 'Règlement voucher',
  'bolamu_bon_zora_reglement': 'Règlement Bon Zora',
  'bolamu_zora_attribues': 'Zora reçus',
  'bolamu_zora_depense': 'Zora utilisés',
  'bolamu_zora_expiration': 'Expiration Zora',
  'bolamu_zora_cadeau_recu': 'Zora cadeau',
  'bolamu_partenaire_reduction': 'Réduction partenaire',
  'bolamu_renouvellement_abonnement': 'Renouvellement abonnement',
  'bolamu_code_acces': 'Code d\'accès',
  'bolamu_mot_de_passe_oublie': 'Mot de passe',
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
  'bolamu_admin_alerte_zora': 'Alerte Zora',
  'bolamu_urgence_dossier_consulte': 'Alerte urgence',
  'bolamu_secretaire_bienvenue_v4': 'Bienvenue',
  'bolamu_inscription_patient_id': 'Inscription confirmée',
  'bolamu_inscription_medecin_pending': 'Inscription reçue',
  'bolamu_inscription_pharmacie_pending': 'Inscription reçue',
  'bolamu_inscription_labo_pending': 'Inscription reçue',
  'rappel_rdv_24h': 'Rappel RDV',
  'bolamu_labo_valide': 'Laboratoire validé',
  'bolamu_labo_rejete': 'Inscription rejetée',
  'bolamu_medecin_valide': 'Médecin validé',
  'bolamu_medecin_rejete': 'Inscription rejetée',
  'bolamu_pharmacie_rejetee': 'Inscription rejetée',
  'bolamu_pharmacie_suspendue': 'Compte suspendu',
  'bolamu_hors_catalogue_patient': 'Acte hors catalogue',
  'bolamu_hors_catalogue_rh': 'Acte hors catalogue employé',
  'abonnement_expire': 'Abonnement expiré',
  'voucher_expirant': 'Voucher expirant',
  'bolamu_souscription_a_valider': 'Souscription à valider',
  'bolamu_abonnement_active': 'Abonnement activé',
  'bolamu_credits_ajoutes': 'Crédits ajoutés',
  'bolamu_credits_ajoutes_solde': 'Crédits ajoutés',
  'bolamu_credits_mensuels': 'Crédits mensuels',
  'bolamu_credits_depenses': 'Crédits dépensés',
  'bolamu_compte_valide': 'Compte validé',
  'bolamu_compte_rejete': 'Compte rejeté',
  'bolamu_compte_suspendu': 'Compte suspendu',
  'bolamu_compte_banni': 'Compte banni',
  'bolamu_compte_suspendu_fraude': 'Compte suspendu',
  'bolamu_compte_banni_admin': 'Compte banni',
  'bolamu_compte_reactive': 'Compte réactivé',
  'bolamu_secretaire_reactive': 'Compte réactivé',
  'bolamu_secretaire_desactive': 'Compte désactivé',
  'gain_jeu_zora': 'Zora gagnés',
  'gain_zora_consultation': 'Zora gagnés',
  'bolamu_batch_notification': 'Notification Bolamu',
  'bolamu_notification_fallback': 'Notification Bolamu'
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
      message = `Bonjour ${params[0]},\nVotre RDV Bolamu est confirmé.\nMédecin : Dr ${params[3]}\nDate : ${params[1]} à ${params[2]}\nLieu : ${params[4]}\nCode session : ${params[5]}\n\nL'équipe Bolamu`;
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
      message = `Rappel, ${params[0]} !\nL'événement ${params[1]} approche : demain à ${params[2]}.\nLieu : ${params[3]}\n\nL'équipe Bolamu`;
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
    } else if (templateName === 'bolamu_voucher_payout') {
      message = `Règlement voucher Bolamu en préparation.\nMontant : ${params[0]} FCFA\nRéférence : ${params[1]}\nVous recevrez le virement sous peu.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_bon_zora_reglement') {
      message = `Bonjour ${params[0]},\n` 
        + `Un règlement de ${params[1]} FCFA a été ` 
        + `initié par Bolamu pour les bons Zora ` 
        + `honorés dans votre établissement.\n\n` 
        + `Référence de virement : ${params[2]}\n\n` 
        + `Pour toute question : support@bolamu.co\n\n` 
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_event_inscription') {
      message = `Inscription confirmée ✅\nÉvénement : ${params[1]}\nLieu : ${params[2]}\nDate : ${params[3]}\nHeure : ${params[4]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_animateur_event_valide') {
      message = `Événement validé ✅\nAnimateur : ${params[0]}\nÉvénement : ${params[1]}\nDate : ${params[2]}\nLieu : ${params[3]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_animateur_checkins') {
      message = `Récapitulatif check-ins ✅\nAnimateur : ${params[0]}\nÉvénement : ${params[1]}\nCheck-ins : ${params[2]}\nZora distribués : ${params[3]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_zora_attribues') {
      message = `Zora crédités 🎉\n${params[0]}, vous avez reçu ${params[1]} Zora.\nSolde total : ${params[2]} Zora\nRaison : ${params[3]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_mot_de_passe_oublie') {
      message = `Bonjour ${params[0]},\n`
        + `Votre mot de passe Bolamu a été réinitialisé.\n\n`
        + `Connectez-vous en un clic (lien valide 24h) :\n${params[1]}\n\n`
        + `Si ce n'est pas vous, contactez-nous immédiatement.\n\n`
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_bienvenue_medecin_v4') {
      message = `Bienvenue sur Bolamu, Dr ${params[0]} !\n`
        + `Votre compte médecin est activé.\n\n`
        + `Connectez-vous ici (lien valide 24h) :\n${params[2]}\n\n`
        + `Identifiant : ${params[1]}\n\n`
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_bienvenue_pharmacie') {
      message = `Bienvenue sur Bolamu, ${params[0]} !\n`
        + `Votre compte pharmacie est activé.\n\n`
        + `Connectez-vous ici (lien valide 24h) :\n${params[2]}\n\n`
        + `Identifiant : ${params[1]}\n\n`
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_bienvenue_laboratoire') {
      message = `Bienvenue sur Bolamu, ${params[0]} !\n`
        + `Votre compte laboratoire est activé.\n\n`
        + `Connectez-vous ici (lien valide 24h) :\n${params[2]}\n\n`
        + `Identifiant : ${params[1]}\n\n`
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_urgence_dossier_consulte') {
      message = `Alerte Bolamu\n` 
        + `Le dossier médical d'urgence de ${params[0]} vient d'être ` 
        + `consulté le ${params[1]} à ${params[2]}.\n\n` 
        + `Si vous n'êtes pas à l'origine de cet accès ou si la ` 
        + `situation vous inquiète, contactez immédiatement le patient ` 
        + `ou les secours.\n\n` 
        + `L'équipe Bolamu`;
    } else if (templateName === 'bolamu_secretaire_bienvenue_v4') {
      message = `Bienvenue sur Bolamu, ${params[0]} !\nVotre compte secrétaire est activé.\nVotre mot de passe temporaire vous suit dans un message séparé.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_code_acces') {
      message = `Voici votre code d'accès Bolamu : ${params[0]}\nConnectez-vous sur bolamu.co et changez-le dès votre première connexion.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_magic_link') {
      message = `Bonjour ${params[0]},\nVotre lien de connexion Bolamu (valide 24h) :\n${params[1]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_inscription_patient_id') {
      message = `Bonjour ${params[0]},\nVotre inscription Bolamu est confirmée.\nVotre identifiant patient : ${params[1]}\nConservez-le précieusement.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_inscription_medecin_pending') {
      message = `Bonjour Dr ${params[0]},\nVotre inscription Bolamu a été reçue.\nScore de confiance initial : ${params[1]}/100.\nVérification sous 24h avant activation.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_inscription_pharmacie_pending') {
      message = `Cher partenaire,\nL'inscription de ${params[0]} a été reçue.\nScore de confiance initial : ${params[1]}/100.\nVérification sous 24h avant activation.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_inscription_labo_pending') {
      message = `Cher partenaire,\nL'inscription de ${params[0]} a été reçue.\nScore de confiance initial : ${params[1]}/100.\nVérification sous 24h avant activation.\n\nL'équipe Bolamu`;
    } else if (templateName === 'rappel_rdv_24h') {
      message = `Rappel : votre RDV Bolamu est demain à ${params[0]}.\nMédecin : Dr ${params[1]}\nLieu : ${params[2]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_labo_valide') {
      message = `Cher partenaire,\nLe laboratoire ${params[0]} est validé sur Bolamu.\nCode membre : ${params[1]}\nVous pouvez désormais recevoir des prescriptions.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_labo_rejete') {
      message = `Cher partenaire,\nVotre inscription laboratoire n'a pas été validée.\nMotif : ${params[0]}\nContactez le support Bolamu pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_medecin_valide') {
      message = `Bonjour Dr ${params[0]},\nVotre compte médecin est validé sur Bolamu.\nCode membre : ${params[1]}\nVous pouvez désormais recevoir des patients.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_medecin_rejete') {
      message = `Bonjour,\nVotre inscription médecin n'a pas été validée.\nMotif : ${params[0]}\nContactez le support Bolamu pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_pharmacie_validee') {
      message = `Cher partenaire,\nLa pharmacie ${params[0]} est validée sur Bolamu.\nCode membre : ${params[1]}\nVous pouvez désormais recevoir des ordonnances.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_pharmacie_rejetee') {
      message = `Cher partenaire,\nL'inscription de ${params[0]} n'a pas été validée.\nMotif : ${params[1]}\nContactez le support Bolamu pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_pharmacie_suspendue') {
      message = `Cher partenaire,\nLe compte de ${params[0]} a été suspendu sur Bolamu.\nContactez le support pour connaître le motif et les suites.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_hors_catalogue_patient') {
      message = `Bonjour,\nActe hors catalogue SSP : ${params[0]}\nMontant à régler directement au prestataire : ${params[1]} FCFA\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_hors_catalogue_rh') {
      message = `Cher partenaire RH,\nActe hors catalogue pour l'employé ${params[2]} : ${params[0]}\nMontant : ${params[1]} FCFA\n\nL'équipe Bolamu`;
    } else if (templateName === 'abonnement_expire') {
      message = `Bonjour,\nVotre abonnement Bolamu a expiré.\nRenouvelez-le sur bolamu.co pour continuer à profiter de vos avantages santé.\n\nL'équipe Bolamu`;
    } else if (templateName === 'voucher_expirant') {
      message = `Bonjour,\nVotre voucher "${params[0]}" chez ${params[1]} expire le ${params[2]}.\nPensez à l'utiliser avant cette date.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_souscription_a_valider') {
      message = `Nouvelle souscription à valider.\nPlan : ${params[0]}\nOpérateur : ${params[1]}\nRéférence paiement : ${params[2]}\n\nBolamu Admin`;
    } else if (templateName === 'bolamu_abonnement_active') {
      message = `Bonjour,\nVotre abonnement Bolamu ${params[0]} est maintenant actif.\nProfitez de vos avantages santé dès aujourd'hui.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_credits_ajoutes') {
      message = `Bonjour,\n${params[0]} crédits Bolamu ont été ajoutés à votre compte.\nMotif : ${params[1]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_credits_ajoutes_solde') {
      message = `Bonjour,\n${params[0]} crédits ajoutés (motif : ${params[2]}).\nNouveau solde : ${params[1]} crédits.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_credits_mensuels') {
      message = `Bonjour,\nVos ${params[0]} crédits Bolamu mensuels ont été crédités.\nBonne santé avec Bolamu !\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_credits_depenses') {
      message = `Bonjour,\n${params[0]} crédits utilisés chez ${params[1]} (réduction ${params[2]} FCFA).\nSolde restant : ${params[3]} crédits.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_valide') {
      message = `Bonjour ${params[0]},\nVotre compte Bolamu est validé.\nVous pouvez désormais vous connecter et profiter de tous les services.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_rejete') {
      message = `Bonjour,\nVotre compte Bolamu n'a pas été validé.\nMotif : ${params[0]}\nContactez le support Bolamu pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_suspendu') {
      message = `Bonjour,\nVotre compte Bolamu a été suspendu.\nMotif : ${params[0]}\nContactez le support Bolamu pour connaître les suites.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_banni') {
      message = `Bonjour,\nVotre compte Bolamu a été banni automatiquement suite à une détection de fraude.\nMotif : ${params[0]}\nContactez le support Bolamu si vous contestez cette décision.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_suspendu_fraude') {
      message = `Bonjour,\nVotre compte Bolamu a été suspendu suite à une activité suspecte détectée automatiquement.\nContactez le support Bolamu pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_banni_admin') {
      message = `Bonjour,\nVotre compte Bolamu a été banni par décision d'un administrateur.\nMotif : ${params[0]}\nContactez le support Bolamu si vous contestez cette décision.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_compte_reactive') {
      message = `Bonjour,\nVotre compte Bolamu a été réactivé.\nVous pouvez de nouveau vous connecter.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_secretaire_reactive') {
      message = `Bonjour,\nVotre compte secrétaire Bolamu a été réactivé.\nConnectez-vous dès maintenant.\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_secretaire_desactive') {
      message = `Bonjour,\nVotre compte secrétaire Bolamu a été désactivé.\nContactez votre partenaire pour plus d'informations.\n\nL'équipe Bolamu`;
    } else if (templateName === 'gain_jeu_zora') {
      message = `Bravo !\nVous avez gagné ${params[0]} Zora au jeu ${params[1]}.\nSolde total : ${params[2]} Zora\n\nL'équipe Bolamu`;
    } else if (templateName === 'gain_zora_consultation') {
      message = `Consultation terminée avec Dr ${params[0]}.\n+${params[1]} Zora crédités.\nSolde total : ${params[2]} Zora\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_batch_notification') {
      message = `${params[0]}\n\nL'équipe Bolamu`;
    } else if (templateName === 'bolamu_notification_fallback') {
      message = `${params[0]}\n\nL'équipe Bolamu`;
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

async function sendImageMessage(phone, imageBuffer, caption) {
  try {
    if (!WAHA_BASE_URL || !WAHA_API_KEY) {
      console.error('[WhatsApp-WAHA] Configuration manquante: WAHA_BASE_URL ou WAHA_API_KEY');
      return false;
    }

    const formattedPhone = normalizePhone(phone);
    if (!formattedPhone) {
      console.error('[WhatsApp-WAHA] Numéro invalide pour sendImageMessage:', phone);
      return false;
    }

    const chatId = formattedPhone.replace('+', '') + '@c.us';

    // Appel WAHA API
    const response = await fetch(`${WAHA_BASE_URL}/api/sendImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY
      },
      body: JSON.stringify({
        chatId: chatId,
        file: {
          mimetype: 'image/png',
          filename: 'bon-zora.png',
          data: imageBuffer.toString('base64')
        },
        caption: caption,
        session: 'Communaute'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[WhatsApp-WAHA] Erreur envoi image:', error);
      return false;
    }

    const result = await response.json();
    console.log('[WhatsApp-WAHA] Image envoyée avec succès', { chatId, messageId: result.id });

    // INSERT notifications
    await pool.query(
      `INSERT INTO notifications
       (user_phone, type, titre, message, canal, sent_at, created_at)
       VALUES ($1, 'whatsapp_image', $2, $3, 'whatsapp', NOW(), NOW())`,
      [formattedPhone, 'Bon Zora généré', caption]
    );

    return true;
  } catch (error) {
    console.error('[WhatsApp-WAHA] Erreur sendImageMessage:', error.message);
    return false;
  }
}

module.exports = { sendAutoMessage, sendImageMessage };
