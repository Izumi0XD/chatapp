import jwt from 'jsonwebtoken'
import User from '../models/User.model.js'

const protect = async (req, res, next) => {
  try {
    let token

    // Check Authorization header first (Bearer token)
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }
    // Fall back to cookie
    else if (req.cookies?.jwt) {
      token = req.cookies.jwt
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized — no token' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId).select('-password')

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' })
    }
    return res.status(401).json({ message: 'Not authorized — invalid token' })
  }
}

export default protect