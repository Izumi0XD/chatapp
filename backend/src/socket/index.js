import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import Message from '../models/Message.model.js';
import Conversation from '../models/Conversation.model.js';

const onlineUsers = new Map();
// Track active calls: callKey -> { startedAt, callType, conversationId, answered }
const activeCalls = new Map();

export const initSocket = (io) => {

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1] ||
        socket.handshake.headers?.cookie
          ?.split(';')
          .find(c => c.trim().startsWith('jwt='))
          ?.split('=')[1];
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log('Socket connected: ' + socket.user.username + ' (' + socket.id + ')');

    socket.join(userId);
    onlineUsers.set(userId, socket.id);
    await User.findByIdAndUpdate(userId, { isOnline: true });
    io.emit('user:online', { userId, isOnline: true });
    socket.emit('users:online', Array.from(onlineUsers.keys()));

    const conversations = await Conversation.find({
      participants: { $in: [userId] },
    }).select('_id');
    conversations.forEach(conv => socket.join(conv._id.toString()));

    socket.on('conversation:join', (conversationId) => socket.join(conversationId));
    socket.on('conversation:leave', (conversationId) => socket.leave(conversationId));

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(conversationId).emit('typing:update', {
        conversationId, userId,
        username: socket.user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(conversationId).emit('typing:update', {
        conversationId, userId,
        username: socket.user.username,
        isTyping: false,
      });
    });

    socket.on('message:read', async ({ conversationId }) => {
      try {
        await Message.updateMany(
          { conversation: conversationId, readBy: { $nin: [userId] }, sender: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
        socket.to(conversationId).emit('message:read', { conversationId, userId, readAt: new Date() });
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    socket.on('call:signal', async ({ to, signal, type, callType, conversationId }) => {
      // Always forward signal to recipient
      io.to(to).emit('call:signal', {
        from: userId,
        fromUsername: socket.user.username,
        fromAvatar: socket.user.avatar,
        signal,
        type,
        callType: callType || 'video',
        conversationId,
      });

      // Track call start when offer is sent
      if (type === 'offer' && conversationId) {
        const callKey = [userId, to].sort().join('_') + '_' + conversationId;
        activeCalls.set(callKey, {
          startedAt: Date.now(),
          callType: callType || 'video',
          conversationId,
          callerId: userId,
          answered: false,
        });
      }

      // Mark call as answered when answer signal received
      if (type === 'answer' && conversationId) {
        for (const [key, call] of activeCalls.entries()) {
          if (call.conversationId === conversationId) {
            call.answered = true;
            call.answeredAt = Date.now();
            break;
          }
        }
      }

      // Save call history when call ends
      if (type === 'end' && conversationId) {
        try {
          // Find the call record
          let callRecord = null;
          let callKey = null;
          for (const [key, call] of activeCalls.entries()) {
            if (call.conversationId === conversationId) {
              callRecord = call;
              callKey = key;
              break;
            }
          }

          // Clean up call record
          if (callKey) activeCalls.delete(callKey);

          const conv = await Conversation.findOne({
            _id: conversationId,
            participants: { $in: [userId] },
          });

          if (conv) {
            const emoji = (callRecord?.callType === 'audio' || callType === 'audio') ? '📞' : '📹'
            const callTypeLabel = (callRecord?.callType === 'audio' || callType === 'audio') ? 'Voice' : 'Video'

            let content
            if (!callRecord || !callRecord.answered) {
              // Call was never answered = missed call
              content = emoji + ' Missed ' + callTypeLabel.toLowerCase() + ' call'
            } else {
              // Calculate duration
              const durationMs = Date.now() - (callRecord.answeredAt || callRecord.startedAt)
              const totalSeconds = Math.floor(durationMs / 1000)
              const minutes = Math.floor(totalSeconds / 60)
              const seconds = totalSeconds % 60
              const duration = minutes > 0
                ? minutes + 'm ' + seconds + 's'
                : seconds + 's'
              content = emoji + ' ' + callTypeLabel + ' call · ' + duration
            }

            const callMsg = await Message.create({
              conversation: conversationId,
              sender: userId,
              content,
              messageType: 'system',
              readBy: [userId],
            });

            await callMsg.populate('sender', 'username avatar');
            await Conversation.findByIdAndUpdate(conversationId, {
              lastMessage: callMsg._id,
            });

            io.to(conversationId).emit('message:new', callMsg);
          }
        } catch (err) {
          console.error('Call message error:', err);
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log('Socket disconnected: ' + socket.user.username);
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
      io.emit('user:offline', { userId, isOnline: false, lastSeen: new Date() });
    });
  });
};

export const getOnlineUsers = () => onlineUsers;