// ============================================================
// BOLAMU — Libellés de rôle affichés dans le feed (posts, commentaires,
// suggestions), à côté du nom de l'auteur.
// Le médecin utilise sa spécialité réelle (doctors.specialty) si renseignée,
// avec ce libellé générique en repli sinon.
// ============================================================
const ROLE_LABELS = {
    patient: 'Patient',
    doctor: 'Médecin',
    pharmacie: 'Pharmacie',
    laboratoire: 'Laboratoire',
    secretaire: 'Secrétaire',
    animateur: 'Animateur',
    rh: 'RH',
    admin: 'Admin',
    content_admin: 'Admin contenu',
    agent_bolamu: 'Agent Bolamu',
    partenaire_commercial: 'Partenaire commercial'
};

function getRoleLabel(role, specialty) {
    if (!role) return 'Utilisateur';
    if (role === 'doctor' && specialty) return specialty;
    return ROLE_LABELS[role] || (role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' '));
}

module.exports = { ROLE_LABELS, getRoleLabel };
