// ============================================================
// BOLAMU — Boucle 2 : Socket.io Service temps réel
// ============================================================

const pool = require('../config/db');

let io = null;
const rooms = new Map(); // conversation_id -> Set of socket IDs

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
        const check = await pool.query(
          `SELECT 1 FROM conversation_participants
           WHERE conversation_id = $1 AND participant_phone = $2`,
          [parseInt(conversationId), socket.data.phone]
        );

        if (check.rows.length === 0) {
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

module.exports = {
  initializeSocket,
  emitToRoom,
  emitToGroup,
  emitToAll,
  getIo
};
