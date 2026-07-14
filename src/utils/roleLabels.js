// ============================================================
// BOLAMU — Libellés de rôle affichés dans le feed (posts, commentaires,
// suggestions), à côté du nom de l'auteur.
// Le médecin utilise sa spécialité réelle (doctors.specialty) si renseignée,
// avec ce libellé générique en repli sinon.
// ============================================================
const ROLE_LABELS = {
    patient: null,
    doctor: 'Médecin généraliste',
    pharmacie: 'Pharmacie partenaire',
    laboratoire: 'Laboratoire partenaire',
    secretaire: 'Secrétariat',
    rh: 'RH Entreprise',
    animateur: 'Animateur Elonga',
    admin: 'Administration Bolamu',
    content_admin: 'Équipe éditoriale Bolamu',
    agent_bolamu: 'Agent Bolamu',
    partenaire_commercial: 'Partenaire commercial'
};

function getRoleLabel(role, specialty) {
    if (role === 'doctor' && specialty) return specialty;
    return ROLE_LABELS[role] || null;
}

module.exports = { ROLE_LABELS, getRoleLabel };
