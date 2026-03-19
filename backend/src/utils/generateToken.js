import jwt from 'jsonwebtoken'

const generateTokenAndSetCookie = (userId, res) => {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )

  // Set cookie (works in production with HTTPS)
  res.cookie('jwt', token, {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  })

  // Also return token in response so frontend can store in localStorage
  return token
}

export default generateTokenAndSetCookie