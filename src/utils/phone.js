function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).trim().replace(/\s+/g, '').replace(/-/g, '');
  
  // Déjà au format correct +2420XXXXXXXX (12 chiffres total)
  if (/^\+2420\d{8}$/.test(p)) return p;
  
  // Format +24269735418 (sans le 0) — ajoute le 0
  if (/^\+242[1-9]\d{8}$/.test(p)) return '+2420' + p.slice(4);
  
  // Format 242069735418 (sans le +)
  if (/^2420\d{8}$/.test(p)) return '+' + p;
  
  // Format 24269735418 (sans + et sans 0)
  if (/^242[1-9]\d{8}$/.test(p)) return '+2420' + p.slice(3);
  
  // Format local 069735418 (avec 0, sans indicatif)
  if (/^0\d{8}$/.test(p)) return '+242' + p;
  
  // Format local 69735418 (sans 0, sans indicatif)
  if (/^\d{8}$/.test(p)) return '+2420' + p;
  
  // Autres pays — garde tel quel
  return p;
}
module.exports = { normalizePhone };
