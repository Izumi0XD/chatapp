// backend/src/models/Message.model.js
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    // Which conversation this message belongs to
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },

    // Who sent this message
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // The actual message text.
    // For media messages, this can be empty or a caption.
    content: {
      type: String,
      default: '',
      trim: true,
    },

    // Encrypted version of content (Step 9 — E2E encryption)
    // We store both so server can still do search/moderation if needed
    encryptedContent: {
      type: String,
      default: '',
    },

    // What kind of message is this?
    // This drives the frontend rendering logic:
    // 'text' → render content string
    // 'image' → render <img> tag
    // 'file' → render download link
    // 'audio' → render audio player
    // 'system' → render gray system notice (e.g. "John joined the group")
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      default: 'text',
    },

    // For media messages — the URL from Cloudinary
    mediaUrl: {
      type: String,
      default: '',
    },

    // Original filename for file downloads
    fileName: {
      type: String,
      default: '',
    },

    // Array of user IDs who have seen this message.
    // The sender is automatically added on creation.
    // When other participants open the chat, their ID gets added.
    // "Read by all" = readBy.length === conversation.participants.length
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Emoji reactions: [{ user: ObjectId, emoji: '👍' }, ...]
    // Using Mixed type gives flexibility without a sub-schema
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: {
          type: String,
          required: true,
        },
      },
    ],

    // Soft delete — we don't actually remove the document.
    // Why? So we can show "This message was deleted" in the UI,
    // and so other messages that reply to it still have a reference.
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // If message was edited, store the original here
    isEdited: {
      type: Boolean,
      default: false,
    },

    // Reply threading — stores the ID of the message being replied to
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ───────────────────────────────────────────────────
// Most common query: "get all messages in this conversation, newest first"
// Compound index on both fields = one index serves this query perfectly.
messageSchema.index({ conversation: 1, createdAt: -1 });

// For finding unread messages per sender
messageSchema.index({ sender: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;