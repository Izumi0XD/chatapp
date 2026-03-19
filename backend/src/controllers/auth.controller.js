import User from '../models/User.model.js'
import generateTokenAndSetCookie from '../utils/generateToken.js'

export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }
    const emailExists = await User.findOne({ email })
    if (emailExists) return res.status(400).json({ message: 'Email already in use' })
    const usernameExists = await User.findOne({ username })
    if (usernameExists) return res.status(400).json({ message: 'Username already taken' })

    const user = await User.create({ username, email, password })
    const token = generateTokenAndSetCookie(user._id, res)

    res.status(201).json({
      token,
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      isOnline: user.isOnline,
      createdAt: user.createdAt,
    })
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message)
      return res.status(400).json({ message: messages[0] })
    }
    console.error('Signup error:', error)
    res.status(500).json({ message: 'Server error during signup' })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }
    const user = await User.findOne({ email }).select('+password')
    if (!user) return res.status(401).json({ message: 'Invalid email or password' })

    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) return res.status(401).json({ message: 'Invalid email or password' })

    user.isOnline = true
    await user.save()

    const token = generateTokenAndSetCookie(user._id, res)

    res.status(200).json({
      token,
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
      isOnline: user.isOnline,
      createdAt: user.createdAt,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error during login' })
  }
}

export const logout = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
      })
    }
    res.cookie('jwt', '', { maxAge: 0 })
    res.status(200).json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Server error during logout' })
  }
}

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    res.status(200).json(user)
  } catch (error) {
    console.error('GetMe error:', error)
    res.status(500).json({ message: 'Server error' })
  }
}