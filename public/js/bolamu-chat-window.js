// ============================================================
// BOLAMU — Composant ChatWindow mutualisé (Phase 4/12)
// Drawer latéral pour une conversation 1:1 (conversations/messages).
// API publique : window.BolamuChatWindow.open({ conversationId,
// currentUserPhone, recipientName, recipientAvatar, socketInstance })
//                window.BolamuChatWindow.close()
//                window.BolamuChatWindow.isOpen()
//
// Patron suivi : bolamu-profile-card.js — injection DOM unique au premier
// open(), fetch()+token natifs (apiFetch() du dashboard hôte est privée à
// son IIFE, inaccessible ici), couleurs hex codées en dur (bolamu-ds.css
// n'est pas chargé sur toutes les pages, cf. fix bolamu-avatar.js —
// var(--role-x) sans garantie de résolution n'est pas utilisé ici).
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

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 5) return 'à l\'instant';
    if (diff < 60) return 'il y a ' + diff + ' s';
    if (diff < 3600) return 'il y a ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'il y a ' + Math.floor(diff / 3600) + ' h';
    if (diff < 604800) return 'il y a ' + Math.floor(diff / 86400) + ' j';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  function avatarHtml(photoUrl, fullName, size) {
    size = size || 36;
    if (window.BolamuAvatar && typeof window.BolamuAvatar.render === 'function') {
      return window.BolamuAvatar.render({ photoUrl: photoUrl, fullName: fullName, size: size });
    }
    var initials = (fullName || '?').trim().charAt(0).toUpperCase();
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#0A2463;color:#fff;font-weight:800;flex-shrink:0;">' + escapeHtml(initials) + '</span>';
  }

  var state = {
    injected: false,
    drawer: null,
    backdrop: null,
    messagesEl: null,
    emptyEl: null,
    inputEl: null,
    typingEl: null,
    conversationId: null,
    currentUserPhone: null,
    recipientName: null,
    recipientAvatar: null,
    socket: null,
    isOpenFlag: false,
    messages: [],       // ordre chronologique croissant (ancien -> récent)
    oldestId: null,
    hasMore: true,
    loadingOlder: false,
    isTypingActive: false,
    typingTimer: null,
    tempCounter: 0
  };

  // ─────────────────────────────────────────────────────────────
  // Injection DOM (une seule fois, comme bolamu-profile-card.js)
  // ─────────────────────────────────────────────────────────────
  function injectDom() {
    if (state.injected) return;
    state.injected = true;

    var backdrop = document.createElement('div');
    backdrop.id = 'bcw-backdrop';
    backdrop.className = 'bcw-backdrop';
    document.body.appendChild(backdrop);

    var drawer = document.createElement('aside');
    drawer.id = 'bcw-drawer';
    drawer.className = 'bcw-drawer';
    drawer.innerHTML =
      '<div class="bcw-header">' +
        '<div class="bcw-header-info">' +
          '<span id="bcw-header-avatar"></span>' +
          '<span class="bcw-header-name" id="bcw-header-name"></span>' +
        '</div>' +
        '<button class="bcw-close" id="bcw-close" aria-label="Fermer"><span class="material-symbols-outlined">close</span></button>' +
      '</div>' +
      '<div class="bcw-messages" id="bcw-messages">' +
        '<div class="bcw-empty" id="bcw-empty" style="display:none;">Commencez la conversation</div>' +
      '</div>' +
      '<div class="bcw-typing" id="bcw-typing" style="display:none;"></div>' +
      '<div class="bcw-composer">' +
        '<input type="text" id="bcw-input" class="bcw-input" placeholder="Écrire un message…" autocomplete="off">' +
        '<button class="bcw-send" id="bcw-send" aria-label="Envoyer"><span class="material-symbols-outlined">send</span></button>' +
      '</div>';
    document.body.appendChild(drawer);

    state.drawer = drawer;
    state.backdrop = backdrop;
    state.messagesEl = drawer.querySelector('#bcw-messages');
    state.emptyEl = drawer.querySelector('#bcw-empty');
    state.inputEl = drawer.querySelector('#bcw-input');
    state.typingEl = drawer.querySelector('#bcw-typing');

    backdrop.addEventListener('click', close);
    drawer.querySelector('#bcw-close').addEventListener('click', close);
    drawer.querySelector('#bcw-send').addEventListener('click', sendCurrentMessage);
    state.inputEl.addEventListener('keydown', onInputKeydown);
    state.inputEl.addEventListener('input', onInputTyping);
    state.messagesEl.addEventListener('scroll', onMessagesScroll);
  }

  // ─────────────────────────────────────────────────────────────
  // Handlers socket nommés — retirables individuellement à close()
  // sans toucher aux autres listeners que le dashboard hôte a pu
  // attacher au même socket (ex: 'notification' dans dashboard.html).
  // ─────────────────────────────────────────────────────────────
  function handleNewMessage(payload) {
    if (!payload || String(payload.conversation_id) !== String(state.conversationId)) return;

    // Remplace le message optimiste en attente (même expéditeur + contenu)
    var tempIdx = -1;
    for (var i = 0; i < state.messages.length; i++) {
      if (state.messages[i]._pending && state.messages[i].sender_phone === payload.sender_phone && state.messages[i].content === payload.content) {
        tempIdx = i;
        break;
      }
    }
    if (tempIdx !== -1) {
      state.messages[tempIdx] = payload;
    } else {
      state.messages.push(payload);
    }
    renderMessages();
    scrollToBottom();

    if (payload.sender_phone === state.currentUserPhone) {
      // Mon propre message confirmé par le serveur — le marquer lu me
      // concernant (markAsRead est au grain conversation, cf. rapport).
      emitMarkRead(payload.id);
    } else {
      emitMarkRead(payload.id);
    }
  }

  function handleTypingStart(payload) {
    if (!payload || String(payload.conversation_id) !== String(state.conversationId)) return;
    if (payload.user_phone === state.currentUserPhone) return;
    state.typingEl.textContent = (state.recipientName || 'Contact') + ' écrit…';
    state.typingEl.style.display = 'block';
  }

  function handleTypingStop(payload) {
    if (!payload || String(payload.conversation_id) !== String(state.conversationId)) return;
    if (payload.user_phone === state.currentUserPhone) return;
    state.typingEl.style.display = 'none';
  }

  function handleMessageRead(payload) {
    if (!payload || String(payload.conversation_id) !== String(state.conversationId)) return;
    for (var i = 0; i < state.messages.length; i++) {
      if (String(state.messages[i].id) === String(payload.message_id)) {
        state.messages[i]._read = true;
        renderMessages();
        break;
      }
    }
  }

  function attachSocketListeners() {
    if (!state.socket) return;
    state.socket.on('new_message', handleNewMessage);
    state.socket.on('typing_start', handleTypingStart);
    state.socket.on('typing_stop', handleTypingStop);
    state.socket.on('message_read', handleMessageRead);
  }

  function detachSocketListeners() {
    if (!state.socket) return;
    state.socket.off('new_message', handleNewMessage);
    state.socket.off('typing_start', handleTypingStart);
    state.socket.off('typing_stop', handleTypingStop);
    state.socket.off('message_read', handleMessageRead);
  }

  // ─────────────────────────────────────────────────────────────
  // Chargement des messages (REST, fetch natif — apiFetch() du
  // dashboard hôte est privée à son IIFE, inaccessible ici)
  // ─────────────────────────────────────────────────────────────
  function fetchMessages(beforeId) {
    var token = getToken();
    if (!token) return Promise.resolve([]);
    var url = '/api/v1/chat/conversations/' + encodeURIComponent(state.conversationId) + '/messages?limit=20' +
      (beforeId ? '&before_id=' + encodeURIComponent(beforeId) : '');
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.success && d.data) ? d.data : []; })
      .catch(function () { return []; });
  }

  function loadInitialMessages() {
    state.messagesEl.innerHTML = '<div class="bcw-loading">Chargement…</div>' + state.emptyEl.outerHTML;
    state.emptyEl = state.messagesEl.querySelector('#bcw-empty');
    fetchMessages(null).then(function (rows) {
      // La route renvoie ORDER BY sent_at DESC (récent -> ancien) ;
      // le drawer affiche ancien -> récent, on inverse.
      var ordered = rows.slice().reverse();
      state.messages = ordered;
      state.oldestId = ordered.length ? ordered[0].id : null;
      state.hasMore = rows.length === 20;
      renderMessages();
      scrollToBottom();
    });
  }

  function loadOlderMessages() {
    if (state.loadingOlder || !state.hasMore || !state.oldestId) return;
    state.loadingOlder = true;
    var prevHeight = state.messagesEl.scrollHeight;
    fetchMessages(state.oldestId).then(function (rows) {
      state.loadingOlder = false;
      if (!rows.length) { state.hasMore = false; return; }
      var ordered = rows.slice().reverse();
      state.messages = ordered.concat(state.messages);
      state.oldestId = ordered[0].id;
      state.hasMore = rows.length === 20;
      renderMessages();
      // Conserve la position de lecture (ne saute pas en haut après insertion)
      state.messagesEl.scrollTop = state.messagesEl.scrollHeight - prevHeight;
    });
  }

  function onMessagesScroll() {
    if (state.messagesEl.scrollTop < 40) loadOlderMessages();
  }

  // ─────────────────────────────────────────────────────────────
  // Rendu des bulles
  // ─────────────────────────────────────────────────────────────
  function renderMessages() {
    state.emptyEl.style.display = state.messages.length ? 'none' : 'block';
    var html = state.emptyEl.outerHTML + state.messages.map(function (m) {
      var mine = m.sender_phone === state.currentUserPhone;
      var statusHtml = '';
      if (mine) {
        var statusLabel = m._pending ? 'envoi…' : (m._read ? '✓✓' : '✓');
        statusHtml = '<span class="bcw-status">' + statusLabel + '</span>';
      }
      return '<div class="bcw-row ' + (mine ? 'bcw-mine' : 'bcw-theirs') + '">' +
        '<div class="bcw-bubble">' +
          '<div class="bcw-bubble-content">' + escapeHtml(m.content) + '</div>' +
          '<div class="bcw-bubble-meta">' + timeAgo(m.created_at || m.sent_at) + statusHtml + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    state.messagesEl.innerHTML = html;
    state.emptyEl = state.messagesEl.querySelector('#bcw-empty');
  }

  function scrollToBottom() {
    state.messagesEl.scrollTop = state.messagesEl.scrollHeight;
  }

  // ─────────────────────────────────────────────────────────────
  // Envoi — optimistic update, corrigé par new_message au retour
  // ─────────────────────────────────────────────────────────────
  function sendCurrentMessage() {
    var content = state.inputEl.value.trim();
    if (!content || !state.socket) return;
    state.inputEl.value = '';
    stopTypingNow();

    var optimistic = {
      id: 'temp-' + (++state.tempCounter),
      conversation_id: state.conversationId,
      sender_phone: state.currentUserPhone,
      content: content,
      created_at: new Date().toISOString(),
      _pending: true
    };
    state.messages.push(optimistic);
    renderMessages();
    scrollToBottom();

    state.socket.emit('send_message', { conversation_id: state.conversationId, content: content });
  }

  function onInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  }

  function onInputTyping() {
    if (!state.socket) return;
    if (!state.isTypingActive) {
      state.isTypingActive = true;
      state.socket.emit('typing_start', { conversation_id: state.conversationId });
    }
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(stopTypingNow, 1000);
  }

  function stopTypingNow() {
    clearTimeout(state.typingTimer);
    if (state.isTypingActive && state.socket) {
      state.isTypingActive = false;
      state.socket.emit('typing_stop', { conversation_id: state.conversationId });
    }
  }

  function emitMarkRead(messageId) {
    if (!state.socket) return;
    state.socket.emit('mark_read', { conversation_id: state.conversationId, message_id: messageId });
  }

  // ─────────────────────────────────────────────────────────────
  // API publique
  // ─────────────────────────────────────────────────────────────
  function open(opts) {
    opts = opts || {};
    if (!opts.conversationId || !opts.currentUserPhone || !opts.socketInstance) return;

    injectDom();

    state.conversationId = opts.conversationId;
    state.currentUserPhone = opts.currentUserPhone;
    state.recipientName = opts.recipientName || 'Contact';
    state.recipientAvatar = opts.recipientAvatar || null;
    state.socket = opts.socketInstance;
    state.messages = [];
    state.oldestId = null;
    state.hasMore = true;
    state.isTypingActive = false;

    state.drawer.querySelector('#bcw-header-name').textContent = state.recipientName;
    state.drawer.querySelector('#bcw-header-avatar').innerHTML = avatarHtml(state.recipientAvatar, state.recipientName, 36);
    state.typingEl.style.display = 'none';

    state.backdrop.classList.add('bcw-open');
    state.drawer.classList.add('bcw-open');
    state.isOpenFlag = true;

    // Écoute attachée immédiatement, PAS retardée de 1500ms (déviation
    // volontaire du plan initial — cf. rapport Phase 4 : retarder
    // l'attachement du listener JS n'atténue pas le problème signalé en
    // Phase 3 (absence d'accusé de réception sur join_conversation côté
    // serveur), et ferait perdre tout message reçu pendant ce délai —
    // pas de mécanisme de rejeu socket.io côté client pour un événement
    // sans listener actif au moment de sa réception).
    attachSocketListeners();
    state.socket.emit('join_conversation', state.conversationId);

    loadInitialMessages();
  }

  function close() {
    if (!state.isOpenFlag) return;
    if (state.socket && state.conversationId) {
      state.socket.emit('leave_conversation', state.conversationId);
    }
    detachSocketListeners();
    stopTypingNow();
    if (state.backdrop) state.backdrop.classList.remove('bcw-open');
    if (state.drawer) state.drawer.classList.remove('bcw-open');
    state.isOpenFlag = false;
    state.conversationId = null;
    state.socket = null;
  }

  function isOpen() {
    return state.isOpenFlag;
  }

  window.BolamuChatWindow = { open: open, close: close, isOpen: isOpen };
})();
