import Message from '../models/Message.model.js';
import Conversation from '../models/Conversation.model.js';

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: { $in: [req.user._id] },
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username avatar')
      .populate('replyTo')
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $nin: [req.user._id] },
        sender: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    await Conversation.updateOne(
      { _id: conversationId, 'unreadCount.user': req.user._id },
      { $set: { 'unreadCount.$.count': 0 } }
    );

    const total = await Message.countDocuments({ conversation: conversationId });

    res.status(200).json({
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, messageType = 'text', mediaUrl, replyTo } = req.body;

    if (!conversationId || (!content && !mediaUrl)) {
      return res.status(400).json({ message: 'Conversation ID and content are required' });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: { $in: [req.user._id] },
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      content: content || '',
      messageType,
      mediaUrl: mediaUrl || '',
      replyTo: replyTo || null,
      readBy: [req.user._id],
    });

    await message.populate('sender', 'username avatar');
    if (replyTo) await message.populate('replyTo');

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
    });

    const io = req.app.get('io');

    // Emit to ALL participants in the room including sender
    // Frontend deduplication handles the rest
    io.to(conversationId).emit('message:new', message);

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    message.isDeleted = true;
    message.content = '';
    message.mediaUrl = '';
    await message.save();

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message:deleted', {
      messageId: message._id,
      conversationId: message.conversation,
    });

    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ message: 'Cannot edit a deleted message' });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();

    await message.populate('sender', 'username avatar');

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message:edited', message);

    res.status(200).json(message);
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.reactions = message.reactions.filter(
      (r) => r.user.toString() !== req.user._id.toString()
    );

    message.reactions.push({ user: req.user._id, emoji });

    await message.save();

    const io = req.app.get('io');
    io.to(message.conversation.toString()).emit('message:reaction', {
      messageId: message._id,
      reactions: message.reactions,
    });

    res.status(200).json(message);
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};