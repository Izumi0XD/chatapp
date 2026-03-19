// backend/src/controllers/user.controller.js
import User from '../models/User.model.js';
import Conversation from '../models/Conversation.model.js';

// ─── SEARCH USERS ──────────────────────────────────────────────
// GET /api/v1/users/search?q=john
// Used by the "New Chat" search box on the frontend
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // $regex does a case-insensitive partial match
    // e.g. searching "jo" matches "john", "jojo", "majorino"
    // $options: 'i' = case insensitive
    // We exclude the current user from results — you can't chat with yourself
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },           // exclude self
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    })
      .select('username email avatar isOnline lastSeen')
      .limit(10);  // cap at 10 results

    res.status(200).json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET USER BY ID ────────────────────────────────────────────
// GET /api/v1/users/:id
// Used to load a user's profile page
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email avatar bio isOnline lastSeen createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── UPDATE PROFILE ────────────────────────────────────────────
// PUT /api/v1/users/profile
export const updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;

    // Build update object — only include fields that were sent
    const updateFields = {};
    if (username) updateFields.username = username;
    if (bio !== undefined) updateFields.bio = bio;
    if (avatar) updateFields.avatar = avatar;

    // Check username not taken by someone else
    if (username) {
      const existing = await User.findOne({
        username,
        _id: { $ne: req.user._id },
      });
      if (existing) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      {
        new: true,         // return the updated document
        runValidators: true, // run schema validators on update
      }
    ).select('-password');

    res.status(200).json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET SIDEBAR USERS ─────────────────────────────────────────
// GET /api/v1/users
// Returns all users except self — for the contacts/new-chat sidebar
export const getSidebarUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('username avatar isOnline lastSeen')
      .sort({ isOnline: -1, username: 1 }); // online users first

    res.status(200).json(users);
  } catch (error) {
    console.error('Get sidebar users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};