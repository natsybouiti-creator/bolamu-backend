/**
 * Normalise un numéro de téléphone congolais et africain
 * vers le format E.164 sans zéro après l'indicatif.
 * Exemples :
 *   '069735418'      → '+24269735418'
 *   '0069735418'     → '+24269735418'
 *   '+242069735418'  → '+24269735418'
 *   '+24269735418'   → '+24269735418' (déjà bon)
 *   '242069735418'   → '+24269735418'
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).trim().replace(/\s+/g, '').replace(/-/g, '');

  // Déjà au bon format E.164 sans zéro parasite
  if (/^\+242\d{8,9}$/.test(p)) {
    // Supprime le 0 après +242 si présent (8 ou 9 chiffres)
    p = p.replace(/^(\+242)0(\d{9})$/, '$1$2');
    p = p.replace(/^(\+242)0(\d{8})$/, '$1$2');
    return p;
  }

  // Format +242 avec zéro
  if (/^\+2420\d{8,9}$/.test(p)) {
    p = p.replace(/^(\+242)0(\d{9})$/, '$1$2');
    p = p.replace(/^(\+242)0(\d{8})$/, '$1$2');
    return p;
  }

  // Format 242XXXXXXXX (sans +, sans 0)
  if (/^2420?\d{8}$/.test(p)) {
    p = p.replace(/^2420?(\d{8})$/, '+242$1');
    return p;
  }

  // Format local 0XXXXXXXX (9 chiffres avec 0)
  if (/^0\d{8}$/.test(p)) {
    return '+242' + p.slice(1);
  }

  // Format local XXXXXXXX (8 chiffres sans 0)
  if (/^\d{8}$/.test(p)) {
    return '+242' + p;
  }

  // Autres indicatifs africains : supprime 0 après indicatif
  p = p.replace(/^(\+\d{2,3})0(\d{7,9})$/, '$1$2');

  return p;
}

module.exports = { normalizePhone };
