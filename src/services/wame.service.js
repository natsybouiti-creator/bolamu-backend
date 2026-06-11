'use strict';

const SUPPORT_PHONE = process.env.BOLAMU_SUPPORT_PHONE || '242064000000';

function normalizePhone(phone) {
  if (!phone) return null;
  const clean = phone.toString().replace(/\s+/g, '').replace(/^\+/, '');
  if (clean.startsWith('242')) return clean;
  if (clean.startsWith('0')) return '242' + clean.slice(1);
  return '242' + clean;
}

const TEMPLATES = {
  inscription_mdp: (d) =>
    `Bonjour ${d.prenom}, bienvenue sur Bolamu 🌿\nVotre identifiant : ${d.phone}\nMot de passe provisoire : ${d.mdp}\nConnectez-vous sur : https://bolamu.co\nChangez votre mot de passe dès la première connexion.`,

  rdv_pris: (d) =>
    `Bonjour ${d.prenom}, votre RDV est enregistré 📅\nDr ${d.medecin} — ${d.date} à ${d.heure}\nLieu : ${d.clinique}\nPensez à vous munir de votre carte Bolamu.`,

  rdv_confirme: (d) =>
    `Bonjour ${d.prenom}, votre RDV est confirmé ✅\nDr ${d.medecin} — ${d.date} à ${d.heure}\nLieu : ${d.clinique}, Congo-Brazzaville`,

  rdv_annule: (d) =>
    `Bonjour ${d.prenom}, votre RDV du ${d.date} a été annulé.\nContactez-nous pour reprogrammer : ${SUPPORT_PHONE}`,

  resultats_disponibles: (d) =>
    `Bonjour ${d.prenom}, vos résultats d'examens sont disponibles 🔬\nConnectez-vous sur bolamu.co pour les consulter.\nRéférence : ${d.ref_examen}`,

  ordonnance_creee: (d) =>
    `Bonjour ${d.prenom}, votre médecin a établi une ordonnance 📋\nRéférence : ${d.ref_ordonnance}\nValable 30 jours\nPrésentez-vous chez un partenaire Bolamu.`,

  abonnement_expire: (d) =>
    `Bonjour ${d.prenom}, votre abonnement Bolamu expire le ${d.date_expiration}.\nRenouvelez maintenant pour ne pas interrompre vos soins : https://bolamu.co`,

  medecin_nouveau_rdv: (d) =>
    `Bolamu — Nouveau RDV 📅\nPatient : ${d.patient_nom}\nDate : ${d.date} à ${d.heure}\nMotif : ${d.motif}`,

  labo_depot_confirme: (d) =>
    `Bolamu — Résultats enregistrés ✅\nPatient : ${d.patient_nom}\nRéférence : ${d.ref_examen}\nLe patient a été notifié automatiquement.`,
};

function buildWameLink(phone, templateKey, data) {
  try {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      console.warn(`[wame] phone invalide — template: ${templateKey}`);
      return null;
    }
    const tpl = TEMPLATES[templateKey];
    if (!tpl) {
      console.warn(`[wame] template inconnu : ${templateKey}`);
      return null;
    }
    const message = tpl(data);
    const link = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
    console.log(`[wame] ${templateKey} → ${link.substring(0, 80)}...`);
    return link;
  } catch (err) {
    console.error(`[wame] erreur buildWameLink (${templateKey}):`, err.message);
    return null;
  }
}

module.exports = { buildWameLink };
