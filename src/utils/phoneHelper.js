/**
 * Helper pour normaliser les numéros de téléphone
 * Évite le mélange entre +24206 et +2426
 */

function normalizePhoneNumber(phone) {
    if (!phone) return phone;
    
    // Nettoyage : espaces, tirets, points
    let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    
    // Si le numéro commence par 0, ajouter +242
    if (cleaned.startsWith('0')) {
        return '+242' + cleaned.substring(1);
    }
    
    // Si le numéro commence par 242 sans +
    if (cleaned.startsWith('242') && !cleaned.startsWith('+242')) {
        return '+' + cleaned;
    }
    
    // Si le numéro n'a pas de préfixe international et fait 9 chiffres (format congolais)
    if (cleaned.length === 9 && !cleaned.startsWith('+')) {
        return '+242' + cleaned;
    }
    
    // Si le numéro commence déjà avec +242, vérifier le format
    if (cleaned.startsWith('+242')) {
        // S'assurer qu'il n'y a pas de double préfixe comme +24206
        if (cleaned.startsWith('+24206')) {
            return cleaned.replace('+24206', '+2426');
        }
        return cleaned;
    }
    
    return cleaned;
}

function isValidCongolesePhone(phone) {
    const normalized = normalizePhoneNumber(phone);
    // Vérifie le format +242 suivi de 9 chiffres
    return /^\+242\d{9}$/.test(normalized);
}

module.exports = {
    normalizePhoneNumber,
    isValidCongolesePhone
};
