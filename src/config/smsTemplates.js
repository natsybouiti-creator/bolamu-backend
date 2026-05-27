// ============================================================
// BOLAMU — Templates SMS Standardisés (Sprint 6)
// ============================================================
// Tous les templates en français, max 160 caractères

module.exports = {
    // Confirmation de rendez-vous
    confirmationRDV: (patientName, doctorName, date, heure) => {
        return `Bolamu: RDV confirmé avec Dr ${doctorName} le ${date} à ${heure}. Merci.`;
    },

    // Activation d'abonnement
    activationAbonnement: (patientName, plan, expiresAt) => {
        const dateStr = new Date(expiresAt).toLocaleDateString('fr-FR');
        return `Bolamu: Abonnement ${plan} activé. Expire le ${dateStr}. Merci.`;
    },

    // Alerte de paiement
    alertePaiement: (patientName, montant, reference) => {
        return `Bolamu: Paiement de ${montant} FCFA reçu (Ref: ${reference}). Merci.`;
    },

    // Suspension de compte
    suspensionCompte: (userName, raison) => {
        return `Bolamu: Compte suspendu. Raison: ${raison}. Contactez support.`;
    },

    // Validation de partenaire
    validationPartenaire: (partnerName) => {
        return `Bolamu: Compte ${partnerName} validé. Connectez-vous maintenant.`;
    },

    // Code OTP
    codeOTP: (code, expiresMinutes) => {
        return `Bolamu: Votre code OTP est ${code}. Expire dans ${expiresMinutes} min.`;
    },

    // Nouveau mot de passe
    nouveauMotDePasse: (password) => {
        return `Bolamu: Nouveau mot de passe: ${password}. Changez-le dès connexion.`;
    },

    // Bienvenue patient
    bienvenuePatient: (memberCode) => {
        return `Bolamu: Bienvenue! Votre code membre: ${memberCode}. Gardez-le précieusement.`;
    },

    // Bienvenue partenaire
    bienvenuePartenaire: (memberCode) => {
        return `Bolamu: Bienvenue! Code membre: ${memberCode}. Validation en cours.`;
    }
};
