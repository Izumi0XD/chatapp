// backend/src/controllers/conversation.controller.js
import Conversation from '../models/Conversation.model.js';
import Message from '../models/Message.model.js';
import User from '../models/User.model.js';

// ─── GET ALL CONVERSATIONS ─────────────────────────────────────
// GET /api/v1/conversations
// Returns the chat list for the logged-in user
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] }, // user is a participant
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username avatar',
        },
      })
      .sort({ updatedAt: -1 }); // most recent first

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET OR CREATE CONVERSATION ────────────────────────────────
// POST /api/v1/conversations
// When user clicks on someone to chat — finds existing or creates new
export const getOrCreateConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id;

    if (!recipientId) {
      return res.status(400).json({ message: 'Recipient ID is required' });
    }

    if (recipientId === senderId.toString()) {
      return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    // Check if a 1-on-1 conversation already exists between these two users
    // $all means the array must contain ALL of these values
    // $size: 2 ensures it's exactly 2 participants (not a group)
    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [senderId, recipientId], $size: 2 },
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate('lastMessage');

    // If it exists, return it
    if (conversation) {
      return res.status(200).json(conversation);
    }

    // Otherwise create a new one
    conversation = await Conversation.create({
      participants: [senderId, recipientId],
      isGroup: false,
    });

    // Populate before returning so frontend gets full user objects
    await conversation.populate('participants', 'username avatar isOnline lastSeen');

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── CREATE GROUP CHAT ─────────────────────────────────────────
// POST /api/v1/conversations/group
export const createGroupConversation = async (req, res) => {
  try {
    const { name, memberIds } = req.body;

    if (!name || !memberIds || memberIds.length < 2) {
      return res.status(400).json({
        message: 'Group name and at least 2 members are required',
      });
    }

    // Always include the creator in the group
    const participants = [...new Set([req.user._id.toString(), ...memberIds])];

    const conversation = await Conversation.create({
      participants,
      isGroup: true,
      groupName: name,
      admin: req.user._id,
    });

    await conversation.populate('participants', 'username avatar isOnline');

    // Notify all members via socket that they were added to a group
    const io = req.app.get('io');
    participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('conversation:new', conversation);
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};