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
    + '.bpc-error{padding:3rem 1.5rem;text-align:center;color:#BA1A1A;font-size:0.85rem;font-weight:600;}'
    + '.bpc-social-stats{display:flex;gap:10px;padding:0 0 1.1rem;}'
    + '.bpc-social-stat{flex:1;text-align:center;}'
    + '.bpc-social-stat b{display:block;font-size:0.95rem;font-weight:800;color:#0A2463;}'
    + '.bpc-social-stat span{font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#9498a8;}'
    + '.bpc-photos-title{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#9498a8;margin:0 0 0.6rem;}'
    + '.bpc-photos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;}'
    + '.bpc-photo-item{position:relative;border-radius:0.5rem;overflow:hidden;cursor:pointer;}'
    + '.bpc-photo-item img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:0.5rem;background:#F3F3FE;display:block;}'
    + '.bpc-photo-overlay{position:absolute;bottom:0;left:0;right:0;padding:0.35rem 0.3rem;display:flex;justify-content:center;gap:0.5rem;background:linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0));color:#fff;font-size:0.65rem;font-weight:700;pointer-events:none;}'
    + '.bpc-photo-stat{display:flex;align-items:center;gap:0.15rem;}'
    + '.bpc-photo-stat .material-symbols-outlined{font-size:13px;}'
    + '.bpc-lightbox-overlay{display:none;position:fixed;inset:0;z-index:1010;align-items:center;justify-content:center;background:rgba(0,0,0,0.95);}'
    + '.bpc-lightbox-overlay.open{display:flex;}'
    + '.bpc-lightbox-img{max-width:92vw;max-height:80vh;object-fit:contain;border-radius:0.5rem;}'
    + '.bpc-lightbox-close{position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:40px;height:40px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;}'
    + '.bpc-lightbox-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:44px;height:44px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}'
    + '.bpc-lightbox-prev{left:0.75rem;}'
    + '.bpc-lightbox-next{right:0.75rem;}'
    + '.bpc-lightbox-actions{position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);display:flex;gap:1rem;background:rgba(0,0,0,0.4);border-radius:9999px;padding:0.5rem 1rem;color:#fff;}'
    + '.bpc-lightbox-actions button{background:transparent;border:none;color:#fff;font-family:inherit;font-size:0.85rem;font-weight:700;display:flex;align-items:center;gap:0.35rem;cursor:pointer;}'
    + '.bpc-lightbox-actions button.liked{color:#e11d48;}'
    + '.bpc-lightbox-actions .like-count, .bpc-lightbox-actions .comment-count-num{min-width:1rem;}'
    + '.bpc-lightbox-comments{position:absolute;bottom:4.5rem;left:1rem;right:1rem;max-height:35vh;background:#fff;border-radius:1rem;padding:1rem;display:none;overflow:hidden;}'
    + '.bpc-lightbox-comments-list{max-height:calc(35vh - 4rem);overflow-y:auto;margin-bottom:0.75rem;}'
    + '.bpc-lightbox-comment-form{display:flex;gap:0.5rem;}'
    + '.bpc-lightbox-comment-input{flex:1;border:1px solid #E5E7EB;border-radius:9999px;padding:0.5rem 0.75rem;font-family:inherit;font-size:0.85rem;}'
    + '.bpc-lightbox-comment-send{background:#003FB1;color:#fff;border:none;border-radius:9999px;padding:0.5rem 1rem;font-family:inherit;font-weight:700;font-size:0.8rem;cursor:pointer;}';

  var state = { injected: false, overlay: null, card: null, currentPhone: null, photos: [], lightboxIndex: 0, lightboxOverlay: null };

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
    var social = data.social || {};
    var photos = data.photos || [];

    var html = '<div class="bpc-hero"></div>'
      + '<div class="bpc-avatar-wrap">' + avatarHtml(data.photo_url, data.full_name) + '</div>'
      + '<div class="bpc-body">'
      + '<h2 class="bpc-name">' + escapeHtml(data.full_name || 'Utilisateur') + '</h2>'
      + (data.city ? ('<div class="bpc-city"><span class="material-symbols-outlined">location_on</span>' + escapeHtml(data.city) + '</div>') : '')
      + (data.bio ? ('<div class="bpc-bio">' + escapeHtml(data.bio) + '</div>') : '')
      + '<div class="bpc-social-stats">'
      + '<div class="bpc-social-stat"><b>' + fmtNum(social.followers_count) + '</b><span>Abonnés</span></div>'
      + '<div class="bpc-social-stat"><b>' + fmtNum(social.following_count) + '</b><span>Abonnements</span></div>'
      + '<div class="bpc-social-stat"><b>' + fmtNum(social.posts_count) + '</b><span>Posts</span></div>'
      + '</div>'
      + '<div class="bpc-stats">'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.zora_gagnes) + '</b><span>Zora (7j)</span></div>'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.streak) + '</b><span>Streak</span></div>'
      + '<div class="bpc-stat"><b>' + fmtNum(stats.evenements) + '</b><span>Événements</span></div>'
      + '</div>'
      + '<div class="bpc-actions">'
      + followButtonHtml(data)
      + (showRdv ? '<button class="bpc-btn bpc-btn-rdv" id="bpc-rdv-btn"><span class="material-symbols-outlined" style="font-size:18px;">calendar_month</span>Prendre RDV</button>' : '')
      + '</div>'
      + (photos.length ? ('<div class="bpc-photos-title">Derniers posts</div><div id="bpc-photos-grid" class="bpc-photos-grid"></div>') : '')
      + '</div>';
    state.content.innerHTML = html;
    state.photos = photos;
    if (photos.length) renderPhotoGrid();
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

  function renderPhotoGrid() {
    var grid = document.getElementById('bpc-photos-grid');
    if (!grid) return;
    grid.innerHTML = state.photos.map(function (p, i) {
      return '<div class="bpc-photo-item" data-bpc-post-id="' + escapeHtml(p.id || '') + '">'
        + '<img src="' + escapeHtml(p.photo_url) + '" alt="" loading="lazy" onclick="BolamuProfileCard.openLightbox(' + i + ')">'
        + '<div class="bpc-photo-overlay">'
        + '<span class="bpc-photo-stat"><span class="material-symbols-outlined">favorite</span>' + (p.likes_count || 0) + '</span>'
        + '<span class="bpc-photo-stat"><span class="material-symbols-outlined">chat_bubble</span>' + (p.comments_count || 0) + '</span>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  function openLightbox(index) {
    index = parseInt(index, 10) || 0;
    if (index < 0 || !state.photos.length) index = 0;
    if (index >= state.photos.length) index = state.photos.length - 1;
    state.lightboxIndex = index;
    ensureLightboxDom();
    renderLightbox();
  }

  function closeLightbox() {
    if (!state.lightboxOverlay) return;
    state.lightboxOverlay.classList.remove('open');
    state.lightboxOverlay.innerHTML = '';
  }

  function ensureLightboxDom() {
    if (state.lightboxOverlay) return;
    var overlay = document.createElement('div');
    overlay.id = 'bpc-lightbox-overlay';
    overlay.className = 'bpc-lightbox-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
    state.lightboxOverlay = overlay;
    attachSwipe();
  }

  function renderLightbox() {
    if (!state.lightboxOverlay) return;
    var p = state.photos[state.lightboxIndex];
    var liked = !!p.liked_by_me;
    var html = '<button class="bpc-lightbox-close" aria-label="Fermer" onclick="BolamuProfileCard.closeLightbox()"><span class="material-symbols-outlined">close</span></button>'
      + (state.lightboxIndex > 0 ? '<button class="bpc-lightbox-nav bpc-lightbox-prev" aria-label="Précédent" onclick="event.stopPropagation(); BolamuProfileCard.prevLightbox();"><span class="material-symbols-outlined">arrow_back_ios</span></button>' : '')
      + '<img class="bpc-lightbox-img" src="' + escapeHtml(p.photo_url) + '" alt="" onclick="event.stopPropagation()">'
      + (state.lightboxIndex < state.photos.length - 1 ? '<button class="bpc-lightbox-nav bpc-lightbox-next" aria-label="Suivant" onclick="event.stopPropagation(); BolamuProfileCard.nextLightbox();"><span class="material-symbols-outlined">arrow_forward_ios</span></button>' : '')
      + '<div class="bpc-lightbox-actions">'
      + '<button class="bpc-lightbox-like ' + (liked ? 'liked' : '') + '" id="bpc-lightbox-like-btn" onclick="event.stopPropagation(); BolamuProfileCard.handleLike();"><span class="material-symbols-outlined">' + (liked ? 'favorite' : 'favorite_border') + '</span><span class="like-count">' + (p.likes_count || 0) + '</span></button>'
      + '<button class="bpc-lightbox-comment" onclick="event.stopPropagation(); BolamuProfileCard.handleToggleComments();"><span class="material-symbols-outlined">chat_bubble</span><span class="comment-count-num">' + (p.comments_count || 0) + '</span></button>'
      + '</div>'
      + '<div class="bpc-lightbox-comments" id="comments-' + (p.id || '') + '" style="display:none;" onclick="event.stopPropagation()">'
      + '<div id="comments-list-' + (p.id || '') + '" class="bpc-lightbox-comments-list"></div>'
      + '<div class="bpc-lightbox-comment-form">'
      + '<input type="text" id="comment-input-' + (p.id || '') + '" placeholder="Écrire un commentaire..." class="bpc-lightbox-comment-input">'
      + '<button type="button" class="bpc-lightbox-comment-send" onclick="event.stopPropagation(); BolamuProfileCard.handleAddComment();">Envoyer</button>'
      + '</div>'
      + '</div>';
    state.lightboxOverlay.innerHTML = html;
    state.lightboxOverlay.classList.add('open');
  }

  function prevLightbox() {
    if (state.lightboxIndex > 0) {
      state.lightboxIndex -= 1;
      renderLightbox();
    }
  }

  function nextLightbox() {
    if (state.lightboxIndex < state.photos.length - 1) {
      state.lightboxIndex += 1;
      renderLightbox();
    }
  }

  function handleLike() {
    var p = state.photos[state.lightboxIndex];
    var btn = document.getElementById('bpc-lightbox-like-btn');
    if (!p || !btn) return;
    var doLike = window.toggleLike;
    if (typeof doLike !== 'function' && window.A && typeof window.A.toggleLike === 'function') doLike = window.A.toggleLike;
    if (typeof doLike !== 'function') return;
    var ret = doLike(p.id, btn);
    if (ret && typeof ret.then === 'function') {
      ret.then(updateLikeState).catch(updateLikeState);
    } else {
      setTimeout(updateLikeState, 600);
    }
  }

  function updateLikeState() {
    var p = state.photos[state.lightboxIndex];
    var btn = document.getElementById('bpc-lightbox-like-btn');
    if (!p || !btn) return;
    var countSpan = btn.querySelector('.like-count');
    var countText = (countSpan && countSpan.textContent) || btn.textContent || '';
    var count = parseInt(countText.replace(/\D/g, ''), 10) || 0;
    var liked = btn.classList.contains('liked') || btn.classList.contains('text-error') || btn.dataset.liked === 'true';
    p.likes_count = count;
    p.liked_by_me = liked;
    renderPhotoGrid();
  }

  function handleToggleComments() {
    var p = state.photos[state.lightboxIndex];
    if (!p) return;
    var fn = window.toggleComments;
    if (typeof fn !== 'function' && window.A && typeof window.A.openComments === 'function') fn = window.A.openComments;
    if (typeof fn !== 'function') return;
    fn(p.id);
  }

  function handleAddComment() {
    var p = state.photos[state.lightboxIndex];
    var input = document.getElementById('comment-input-' + (p ? p.id : ''));
    if (!p || !input || !input.value.trim()) return;
    var fn = window.addComment;
    if (typeof fn !== 'function' && window.A && typeof window.A.submitComment === 'function') {
      fn = function (pid) {
        var gInput = document.getElementById('comment-input');
        if (gInput) gInput.value = input.value.trim();
        if (window.A) window.A._currentCommentsPostId = pid;
        if (window.A && window.A.submitComment) window.A.submitComment();
      };
    }
    if (typeof fn !== 'function') return;
    input.disabled = true;
    var ret = fn(p.id);
    function done() {
      input.disabled = false;
      input.value = '';
      p.comments_count = (p.comments_count || 0) + 1;
      renderPhotoGrid();
      var num = document.querySelector('.bpc-lightbox-comment .comment-count-num');
      if (num) num.textContent = p.comments_count;
    }
    if (ret && typeof ret.then === 'function') {
      ret.then(done).catch(function () { input.disabled = false; });
    } else {
      setTimeout(done, 300);
    }
  }

  function attachSwipe() {
    var overlay = state.lightboxOverlay;
    if (!overlay || overlay.dataset.swipeAttached) return;
    var startX = null;
    overlay.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var endX = e.changedTouches[0].clientX;
      var diff = startX - endX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) nextLightbox();
        else prevLightbox();
      }
      startX = null;
    }, { passive: true });
    overlay.dataset.swipeAttached = '1';
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

  window.BolamuProfileCard = { open: open, close: close, openLightbox: openLightbox, closeLightbox: closeLightbox, handleLike: handleLike, handleToggleComments: handleToggleComments, handleAddComment: handleAddComment, prevLightbox: prevLightbox, nextLightbox: nextLightbox };
})();
