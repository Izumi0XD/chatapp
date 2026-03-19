// backend/src/models/Conversation.model.js
import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    // participants holds the IDs of everyone in this chat.
    // For 1-on-1: exactly 2 users. For groups: 2+ users.
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],

    isGroup: {
      type: Boolean,
      default: false,
    },

    // Only used when isGroup is true
    groupName: {
      type: String,
      trim: true,
      default: '',
    },

    groupAvatar: {
      type: String,
      default: '',
    },

    // The user who created and administers the group
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Stores a reference to the most recent message.
    // This is what powers the chat list — sorted by lastMessage time.
    // We could query for it, but storing it here avoids an extra DB call
    // every time we render the conversation list.
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },

    // Tracks unread count per user.
    // Structure: [{ user: ObjectId, count: Number }]
    // We increment when a message is sent, reset to 0 when user opens the chat.
    unreadCount: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────
// Most common query: "find all conversations this user is in"
// The participants array index makes this fast.
conversationSchema.index({ participants: 1 });

// For chat list sorting — we always sort by most recently updated
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;