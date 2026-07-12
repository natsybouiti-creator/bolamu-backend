// ============================================================
// BOLAMU — Boucle 2 : Socket.io Service temps réel
// ============================================================

const pool = require('../config/db');
const chatService = require('./chat.service');

let io = null;
const rooms = new Map(); // conversation_id -> Set of socket IDs
const onlineUsers = new Map(); // phone -> Set of socket.id (multi-onglets)

// Vérifie l'appartenance à une conversation (même pattern que
// sendConversationMessage/getConversationMessages dans chat.service.js).
async function isParticipant(conversationId, phone) {
  const check = await pool.query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id = $1 AND participant_phone = $2`,
    [parseInt(conversationId), phone]
  );
  return check.rows.length > 0;
}

function initializeSocket(server) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://bolamu.co', 'https://www.bolamu.co', 'https://api.bolamu.co']
        : ['http://localhost:3000', 'http://localhost:10000'],
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connecté:', socket.id);

    // Rejoindre une room personnelle (notifications réseau social : likes, commentaires, follows)
    socket.on('authenticate', (token) => {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.data.phone = decoded.phone;
        socket.join(`user:${decoded.phone}`);
        socket.emit('authenticated', { status: 'ok' });

        // Présence — Set de socket.id par phone (multi-onglets). user_online
        // émis seulement à la transition offline -> online, pas à chaque
        // nouvel onglet du même utilisateur déjà connecté ailleurs.
        if (!onlineUsers.has(decoded.phone)) {
          onlineUsers.set(decoded.phone, new Set());
        }
        const wasOffline = onlineUsers.get(decoded.phone).size === 0;
        onlineUsers.get(decoded.phone).add(socket.id);
        if (wasOffline) {
          io.emit('user_online', { user_phone: decoded.phone });
        }

        // Présence multi-instances (dette technique post-chat-unifié, item 3) —
        // écrit aussi dans Neon (users.last_seen_at) pour que isOnline() reste
        // correct si une autre instance Render détient la Map in-memory à jour.
        // Non-bloquant : pas de await dans ce handler temps réel.
        pool.query('UPDATE users SET last_seen_at = NOW() WHERE phone = $1', [decoded.phone])
          .catch((err) => console.error('[presence]', err.message));
      } catch (err) {
        socket.emit('auth_error', { message: 'Token invalide' });
      }
    });

    // Rejoindre une room de conversation — appartenance vérifiée contre
    // conversation_participants (même pattern que sendConversationMessage/
    // getConversationMessages dans chat.service.js), socket authentifié requis.
    socket.on('join_conversation', async (conversationId) => {
      if (!socket.data.phone) {
        socket.emit('unauthorized_conversation', { conversationId, reason: 'not_authenticated' });
        return;
      }

      try {
        const authorized = await isParticipant(conversationId, socket.data.phone);
        if (!authorized) {
          socket.emit('unauthorized_conversation', { conversationId, reason: 'not_participant' });
          return;
        }
      } catch (err) {
        console.error('[Socket.io] Erreur vérification appartenance conversation:', err.message);
        socket.emit('unauthorized_conversation', { conversationId, reason: 'server_error' });
        return;
      }

      socket.join(`conversation_${conversationId}`);

      if (!rooms.has(conversationId)) {
        rooms.set(conversationId, new Set());
      }
      rooms.get(conversationId).add(socket.id);

      console.log(`[Socket.io] Socket ${socket.id} rejoint conversation_${conversationId}`);

      // Ack — le client attend cet événement avant d'activer ses listeners
      // new_message/typing/message_read (évite la race condition envoi
      // avant appartenance à la room confirmée). Uniquement à l'émetteur.
      socket.emit('conversation_joined', { conversation_id: conversationId, status: 'ok' });
    });

    // Quitter une room de conversation
    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation_${conversationId}`);
      
      if (rooms.has(conversationId)) {
        rooms.get(conversationId).delete(socket.id);
        if (rooms.get(conversationId).size === 0) {
          rooms.delete(conversationId);
        }
      }
      
      console.log(`[Socket.io] Socket ${socket.id} a quitté conversation_${conversationId}`);
    });

    // Envoyer un message dans une conversation — réutilise
    // sendConversationMessage (chat.service.js), déjà sécurisée (vérifie
    // l'appartenance en interne) et qui émet déjà new_message via emitToRoom
    // (payload {id, sent_at} — cf. commentaire plus bas, pas de réémission
    // ici pour éviter un double événement new_message).
    socket.on('send_message', async ({ conversation_id, content } = {}) => {
      if (!socket.data.phone) {
        socket.emit('unauthorized_conversation', { conversationId: conversation_id, reason: 'not_authenticated' });
        return;
      }
      if (!conversation_id || !content || !String(content).trim()) return;

      try {
        const authorized = await isParticipant(conversation_id, socket.data.phone);
        if (!authorized) {
          socket.emit('unauthorized_conversation', { conversationId: conversation_id, reason: 'not_participant' });
          return;
        }
        // sendConversationMessage émet déjà 'new_message' en interne
        // (emitToRoom) — payload {id, sent_at} uniquement. L'enrichir avec
        // sender_name/sender_avatar_url nécessiterait de modifier
        // chat.service.js, hors scope de cette phase (cf. rapport).
        await chatService.sendConversationMessage(conversation_id, socket.data.phone, String(content).trim());
      } catch (err) {
        console.error('[Socket.io] Erreur send_message:', err.message);
        socket.emit('unauthorized_conversation', { conversationId: conversation_id, reason: 'server_error' });
      }
    });

    // Marquer une conversation comme lue — markAsRead (chat.service.js) est
    // au grain conversation (conversation_participants.last_read_at), pas
    // message par message : messages n'a pas de colonne read_at (vérifié
    // information_schema.columns). message_id renvoyé tel quel pour l'UI.
    socket.on('mark_read', async ({ conversation_id, message_id } = {}) => {
      if (!socket.data.phone || !conversation_id) return;

      try {
        const authorized = await isParticipant(conversation_id, socket.data.phone);
        if (!authorized) {
          socket.emit('unauthorized_conversation', { conversationId: conversation_id, reason: 'not_participant' });
          return;
        }
        await chatService.markAsRead(conversation_id, socket.data.phone);
        const read_at = new Date().toISOString();
        io.to(`conversation_${conversation_id}`).emit('message_read', { conversation_id, message_id, read_at });
      } catch (err) {
        console.error('[Socket.io] Erreur mark_read:', err.message);
      }
    });

    // Indicateur de saisie — lecture seule, aucune écriture en base. Relayé
    // aux AUTRES membres de la room uniquement (socket.to, pas io.to).
    socket.on('typing_start', async ({ conversation_id } = {}) => {
      if (!socket.data.phone || !conversation_id) return;
      try {
        const authorized = await isParticipant(conversation_id, socket.data.phone);
        if (!authorized) return;
        socket.to(`conversation_${conversation_id}`).emit('typing_start', { conversation_id, user_phone: socket.data.phone });
      } catch (err) {
        console.error('[Socket.io] Erreur typing_start:', err.message);
      }
    });

    socket.on('typing_stop', async ({ conversation_id } = {}) => {
      if (!socket.data.phone || !conversation_id) return;
      try {
        const authorized = await isParticipant(conversation_id, socket.data.phone);
        if (!authorized) return;
        socket.to(`conversation_${conversation_id}`).emit('typing_stop', { conversation_id, user_phone: socket.data.phone });
      } catch (err) {
        console.error('[Socket.io] Erreur typing_stop:', err.message);
      }
    });

    // Notification utilisateur rejoint un groupe
    socket.on('user_joined_group', (data) => {
      const { groupId, phone, firstName } = data;
      io.to(`group_${groupId}`).emit('user_joined_group', {
        phone,
        firstName,
        timestamp: new Date()
      });
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Client déconnecté:', socket.id);
      
      // Nettoyer les rooms
      for (const [conversationId, socketSet] of rooms.entries()) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          rooms.delete(conversationId);
        }
      }

      // Présence — retire ce socket.id ; user_offline émis seulement si
      // plus aucun onglet de ce user n'est connecté.
      if (socket.data.phone && onlineUsers.has(socket.data.phone)) {
        const set = onlineUsers.get(socket.data.phone);
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(socket.data.phone);
          io.emit('user_offline', { user_phone: socket.data.phone });
        }
      }

      // Présence multi-instances — dernier "vu" en base, non-bloquant.
      if (socket.data.phone) {
        pool.query('UPDATE users SET last_seen_at = NOW() WHERE phone = $1', [socket.data.phone])
          .catch((err) => console.error('[presence]', err.message));
      }
    });
  });

  console.log('[Socket.io] Service initialisé');
}

function emitToRoom(conversationId, event, data) {
  if (io) {
    io.to(`conversation_${conversationId}`).emit(event, data);
  }
}

function emitToGroup(groupId, event, data) {
  if (io) {
    io.to(`group_${groupId}`).emit(event, data);
  }
}

function emitToAll(event, data) {
  if (!io) {
    console.error('[Socket.io] emitToAll: io est NULL — event ' + event + ' NON émis');
    return;
  }
  console.log('[Socket.io] emitToAll OK — event ' + event);
  io.emit(event, data);
}

function getIo() {
  return io;
}

// Hybride Map+DB (item 3, dette technique post-chat-unifié) : la Map locale
// reste la source rapide pour les users connectés à CETTE instance (pas de
// requête DB par vérification) ; le fallback Neon (last_seen_at < 30s)
// couvre les users connectés à une AUTRE instance quand Render scale à
// plusieurs instances (la Map, par instance, ne les verrait pas sinon).
async function isOnline(phone) {
  if (onlineUsers.has(phone) && onlineUsers.get(phone).size > 0) {
    return true;
  }
  const result = await pool.query(
    `SELECT 1 FROM users WHERE phone = $1 AND last_seen_at > NOW() - INTERVAL '30 seconds'`,
    [phone]
  );
  return result.rows.length > 0;
}

module.exports = {
  initializeSocket,
  emitToRoom,
  emitToGroup,
  emitToAll,
  getIo,
  isOnline
};
