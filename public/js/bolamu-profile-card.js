// ============================================================
// BOLAMU — Composant Popup Profil Partagé
// Injecte dynamiquement son propre HTML/CSS au premier appel.
// API publique : window.BolamuProfileCard.open(phone)
// Réutilise GET /api/v1/patients/profil-social/:phone (existant)
// et POST/DELETE /api/v1/follows/:phone (existant).
// ============================================================

(function () {
  var TOKEN_KEYS = [
    'bolamu_patient_token',
    'bolamu_doctor_token',
    'bolamu_pharmacie_token',
    'bolamu_laboratoire_token',
    'bolamu_animateur_token'
  ];

  function getToken() {
    for (var i = 0; i < TOKEN_KEYS.length; i++) {
      var t = localStorage.getItem(TOKEN_KEYS[i]);
      if (t) return t;
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtNum(n) {
    n = Number(n) || 0;
    return n.toLocaleString('fr-FR');
  }

  var CSS = ''
    + '.bpc-overlay{display:none;position:fixed;inset:0;z-index:1000;align-items:center;justify-content:center;padding:20px;background:rgba(10,36,99,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:"Plus Jakarta Sans",sans-serif;}'
    + '.bpc-overlay.open{display:flex;}'
    + '.bpc-card{position:relative;background:#fff;border-radius:2rem;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(10,36,99,0.25);}'
    + '.bpc-close{position:absolute;top:1rem;right:1rem;z-index:2;background:rgba(255,255,255,0.2);border:none;border-radius:50%;width:36px;height:36px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}'
    + '.bpc-hero{height:96px;border-radius:2rem 2rem 0 0;background:linear-gradient(135deg,#0A2463,#112d6b);position:relative;}'
    + '.bpc-avatar-wrap{position:relative;margin:-40px 0 0 1.5rem;width:80px;height:80px;border-radius:50%;border:4px solid #fff;overflow:hidden;background:#0A2463;box-shadow:0 4px 12px rgba(10,36,99,0.2);}'
    + '.bpc-avatar-wrap img{width:100%;height:100%;object-fit:cover;}'
    + '.bpc-avatar-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem;background:#0A2463;}'
    + '.bpc-body{padding:1.25rem 1.5rem 1.5rem;}'
    + '.bpc-name{margin:0.75rem 0 0.15rem;font-size:1.15rem;font-weight:800;color:#0A2463;}'
    + '.bpc-city{display:flex;align-items:center;gap:4px;font-size:0.8rem;color:#9498a8;font-weight:600;margin-bottom:0.75rem;}'
    + '.bpc-city .material-symbols-outlined{font-size:15px;}'
    + '.bpc-bio{font-size:0.85rem;color:#434654;line-height:1.5;margin-bottom:1rem;}'
    + '.bpc-stats{display:flex;gap:10px;background:#F8F8FC;border-radius:1rem;padding:0.85rem;margin-bottom:1.1rem;}'
    + '.bpc-stat{flex:1;text-align:center;}'
    + '.bpc-stat b{display:block;font-size:1rem;font-weight:800;color:#0A2463;}'
    + '.bpc-stat span{font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#9498a8;}'
    + '.bpc-actions{display:flex;gap:10px;}'
    + '.bpc-btn{flex:1;border:none;border-radius:9999px;padding:12px;font-family:inherit;font-weight:700;font-size:0.86rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;}'
    + '.bpc-btn-follow{background:#003FB1;color:#fff;}'
    + '.bpc-btn-follow.is-following{background:#F3F3FE;color:#434654;}'
    + '.bpc-btn-follow.is-pending{background:#F3F3FE;color:#9498a8;cursor:default;}'
    + '.bpc-btn-rdv{background:#00C9A7;color:#fff;}'
    + '.bpc-locked{padding:2rem 1.5rem;text-align:center;}'
    + '.bpc-locked .material-symbols-outlined{font-size:32px;color:#D1D5DB;margin-bottom:8px;}'
    + '.bpc-locked p{font-size:0.85rem;color:#9498a8;font-weight:600;margin:0 0 1.25rem;}'
    + '.bpc-loading{padding:3rem 1.5rem;text-align:center;color:#9498a8;font-size:0.85rem;font-weight:600;}'
    + '.bpc-error{padding:3rem 1.5rem;text-align:center;color:#BA1A1A;font-size:0.85rem;font-weight:600;}';

  var state = { injected: false, overlay: null, card: null, currentPhone: null };

  function injectDom() {
    if (state.injected) return;
    state.injected = true;

    var styleEl = document.createElement('style');
    styleEl.id = 'bpc-styles';
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    var overlay = document.createElement('div');
    overlay.id = 'bpc-overlay';
    overlay.className = 'bpc-overlay';
    overlay.innerHTML = '<div class="bpc-card" id="bpc-card">'
      + '<button class="bpc-close" id="bpc-close" aria-label="Fermer"><span class="material-symbols-outlined" style="font-size:20px;">close</span></button>'
      + '<div id="bpc-content"></div>'
      + '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    overlay.querySelector('#bpc-card').addEventListener('click', function (e) {
      e.stopPropagation();
    });
    overlay.querySelector('#bpc-close').addEventListener('click', close);

    state.overlay = overlay;
    state.content = overlay.querySelector('#bpc-content');
  }

  function renderLoading() {
    state.content.innerHTML = '<div class="bpc-loading">Chargement du profil…</div>';
  }

  function renderErrorState() {
    state.content.innerHTML = '<div class="bpc-error">Impossible de charger ce profil.</div>';
  }

  function avatarHtml(photoUrl, fullName) {
    if (window.BolamuAvatar && typeof window.BolamuAvatar.render === 'function') {
      return window.BolamuAvatar.render({ photoUrl: photoUrl, fullName: fullName, size: 80 });
    }
    var initials = (fullName || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('') || '?';
    if (photoUrl) {
      return '<img src="' + escapeHtml(photoUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
        + '<span class="bpc-avatar-fallback" style="display:none;">' + escapeHtml(initials) + '</span>';
    }
    return '<span class="bpc-avatar-fallback">' + escapeHtml(initials) + '</span>';
  }

  function renderLocked(phone, data) {
    var html = '<div class="bpc-hero"></div>'
      + '<div class="bpc-avatar-wrap">' + avatarHtml(data.photo_url, data.full_name) + '</div>'
      + '<div class="bpc-body">'
      + '<h2 class="bpc-name">' + escapeHtml(data.full_name || 'Utilisateur') + '</h2>'
      + '<div class="bpc-locked">'
      + '<span class="material-symbols-outlined">lock</span>'
      + '<p>Ce profil est privé.<br>Suivez ce compte pour voir ses informations.</p>'
      + followButtonHtml(data)
      + '</div>'
      + '</div>';
    state.content.innerHTML = html;
    wireFollowButton(phone, data);
  }

  function followButtonHtml(data) {
    if (data.is_self) return '';
    if (data.follow_request_pending) {
      return '<button class="bpc-btn bpc-btn-follow is-pending" id="bpc-follow-btn" disabled>Demande envoyée</button>';
    }
    var following = !!data.is_following;
    return '<button class="bpc-btn bpc-btn-follow' + (following ? ' is-following' : '') + '" id="bpc-follow-btn">'
      + (following ? 'Ne plus suivre' : 'Suivre') + '</button>';
  }

  function renderProfile(phone, data) {
    var showRdv = !data.is_self && (data.role === 'doctor' || data.role === 'medecin');
    var stats = data.stats || {};

    var html = '<div class="bpc-hero"></div>'
      + '<div class="bpc-avatar-wrap">' + avatarHtml(data.photo_url, data.full_name) + '</div>'
      + '<div class="bpc-body">'
      + '<h2 class="bpc-name">' + escapeHtml(data.full_name || 'Utilisateur') + '</h2>'
      + (data.city ? ('<div class="bpc-city"><span class="material-symbols-outlined">location_on</span>' + escapeHtml(data.city) + '</div>') : '')
      + (data.bio ? ('<div class="bpc-bio">' + escapeHtml(data.bio) + '</div>') : '')
      + '<div class="bpc-stats">'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.zora_gagnes) + '</b><span>Zora (7j)</span></div>'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.streak) + '</b><span>Streak</span></div>'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.evenements) + '</b><span>Événements</span></div>'
      + '</div>'
      + '<div class="bpc-actions">'
      + followButtonHtml(data)
      + (showRdv ? '<button class="bpc-btn bpc-btn-rdv" id="bpc-rdv-btn"><span class="material-symbols-outlined" style="font-size:18px;">calendar_month</span>Prendre RDV</button>' : '')
      + '</div>'
      + '</div>';
    state.content.innerHTML = html;
    wireFollowButton(phone, data);
    if (showRdv) wireRdvButton(phone, data);
  }

  function wireFollowButton(phone, data) {
    var btn = document.getElementById('bpc-follow-btn');
    if (!btn || data.is_self || data.follow_request_pending) return;
    btn.addEventListener('click', function () {
      var token = getToken();
      if (!token) return;
      var isFollowing = btn.classList.contains('is-following');
      var method = isFollowing ? 'DELETE' : 'POST';
      btn.disabled = true;
      fetch('/api/v1/follows/' + encodeURIComponent(phone), {
        method: method,
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          btn.disabled = false;
          if (!d || d.success === false) return;
          if (d.status === 'pending_request') {
            btn.outerHTML = '<button class="bpc-btn bpc-btn-follow is-pending" id="bpc-follow-btn" disabled>Demande envoyée</button>';
            return;
          }
          var nowFollowing = !isFollowing;
          btn.classList.toggle('is-following', nowFollowing);
          btn.textContent = nowFollowing ? 'Ne plus suivre' : 'Suivre';
        })
        .catch(function () { btn.disabled = false; });
    });
  }

  // RDV : ouvre le modal RDV existant du dashboard hôte (vide, non pré-rempli — voir plan validé).
  // Le dashboard hôte doit exposer A.openModal(); sinon le bouton est un no-op silencieux.
  function wireRdvButton() {
    var btn = document.getElementById('bpc-rdv-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      close();
      if (window.A && typeof window.A.openModal === 'function') {
        window.A.openModal();
      }
    });
  }

  function fetchProfile(phone) {
    var token = getToken();
    var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    fetch('/api/v1/patients/profil-social/' + encodeURIComponent(phone), { headers: headers })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (state.currentPhone !== phone) return; // popup fermé/rouvert entre-temps
        if (!d || !d.success || !d.data) { renderErrorState(); return; }
        if (d.data.locked) renderLocked(phone, d.data);
        else renderProfile(phone, d.data);
      })
      .catch(function () {
        if (state.currentPhone !== phone) return;
        renderErrorState();
      });
  }

  function open(phone) {
    if (!phone) return;
    injectDom();
    state.currentPhone = phone;
    renderLoading();
    state.overlay.classList.add('open');
    fetchProfile(phone);
  }

  function close() {
    if (state.overlay) state.overlay.classList.remove('open');
    state.currentPhone = null;
  }

  window.BolamuProfileCard = { open: open, close: close };
})();
