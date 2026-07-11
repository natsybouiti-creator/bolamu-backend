// ============================================================
// BOLAMU — Composant Avatar Partagé
// Photo de profil si disponible (object-fit: cover), sinon
// initiales sur fond couleur de rôle (--role-X, bolamu-ds.css).
// Fallback automatique sur échec de chargement image.
// ============================================================

(function () {
  var ROLE_COLOR_VAR = {
    patient: '--role-patient',
    doctor: '--role-medecin',
    medecin: '--role-medecin',
    secretaire: '--role-secretaire',
    pharmacie: '--role-pharmacie',
    laboratoire: '--role-labo',
    labo: '--role-labo',
    admin: '--role-admin',
    content_admin: '--role-admin',
    rh: '--role-rh',
    agence: '--role-agence',
    agent_bolamu: '--role-agent',
    agent: '--role-agent',
    animateur: '--role-animateur'
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function initials(fullName) {
    if (!fullName) return '';
    var parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  /**
   * @param {Object} opts
   * @param {string} [opts.photoUrl] - URL de la photo de profil (colonne photo_url)
   * @param {string} [opts.fullName] - Nom complet, pour générer les initiales de secours
   * @param {string} [opts.role] - Rôle (patient/doctor/pharmacie/laboratoire/secretaire/admin/rh/agence/agent_bolamu/animateur)
   * @param {number} [opts.size] - Taille en px (défaut 72)
   * @param {string} [opts.className] - Classe(s) CSS additionnelle(s)
   * @returns {string} HTML de l'avatar (à injecter via innerHTML)
   */
  function render(opts) {
    opts = opts || {};
    var size = opts.size || 72;
    var photoUrl = opts.photoUrl || '';
    var roleVar = ROLE_COLOR_VAR[opts.role] || '--role-admin';
    var ini = initials(opts.fullName) || '?';
    var extraClass = opts.className ? ' ' + opts.className : '';
    var fontSize = Math.round(size * 0.4);

    var fallback = '<span class="bolamu-avatar__fallback" style="display:' + (photoUrl ? 'none' : 'flex') + ';font-size:' + fontSize + 'px;color:#fff;">' + escapeHtml(ini) + '</span>';
    var img = photoUrl
      ? '<img src="' + escapeHtml(photoUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
      : '';

    // Fallback #0A2463 codé en dur : certaines pages (ex. patient/dashboard.html)
    // n'importent pas bolamu-ds.css, donc var(--role-X) ne résoud à rien et le
    // fond restait blanc/transparent. var(--role-X, #0A2463) garantit un fond
    // plein dans tous les cas — couleur de rôle si le CSS est chargé, navy sinon.
    return '<span class="bolamu-avatar' + extraClass + '" style="width:' + size + 'px;height:' + size + 'px;background:var(' + roleVar + ', #0A2463);color:#fff;">' + img + fallback + '</span>';
  }

  window.BolamuAvatar = { render: render, initials: initials };
})();
