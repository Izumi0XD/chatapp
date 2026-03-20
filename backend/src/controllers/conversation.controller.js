import Conversation from '../models/Conversation.model.js';
import Message from '../models/Message.model.js';
import User from '../models/User.model.js';

export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] },
      deletedBy: { $nin: [req.user._id] }, // hide deleted conversations
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username avatar' },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getOrCreateConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user._id;

    if (!recipientId) return res.status(400).json({ message: 'Recipient ID is required' });
    if (recipientId === senderId.toString()) return res.status(400).json({ message: 'Cannot chat with yourself' });

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [senderId, recipientId], $size: 2 },
    })
      .populate('participants', 'username avatar isOnline lastSeen')
      .populate('lastMessage');

    if (conversation) {
      // If user had deleted it, restore it
      if (conversation.deletedBy?.includes(req.user._id)) {
        await Conversation.findByIdAndUpdate(conversation._id, {
          $pull: { deletedBy: req.user._id },
        });
      }
      return res.status(200).json(conversation);
    }

    conversation = await Conversation.create({
      participants: [senderId, recipientId],
      isGroup: false,
    });

    await conversation.populate('participants', 'username avatar isOnline lastSeen');
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Get or create conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createGroupConversation = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds || memberIds.length < 2) {
      return res.status(400).json({ message: 'Group name and at least 2 members are required' });
    }

    const participants = [...new Set([req.user._id.toString(), ...memberIds])];
    const conversation = await Conversation.create({
      participants,
      isGroup: true,
      groupName: name,
      admin: req.user._id,
    });

    await conversation.populate('participants', 'username avatar isOnline');

    const io = req.app.get('io');
    participants.forEach(participantId => {
      io.to(participantId.toString()).emit('conversation:new', conversation);
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/v1/conversations/:id
// Soft-delete — only hides it for the current user
export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      participants: { $in: [req.user._id] },
    });

    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    await Conversation.findByIdAndUpdate(req.params.id, {
      $addToSet: { deletedBy: req.user._id },
    });

    res.status(200).json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};