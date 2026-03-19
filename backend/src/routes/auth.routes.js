// backend/src/routes/auth.routes.js
import { Router } from 'express';
import { signup, login, logout, getMe } from '../controllers/auth.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();

// Public routes — no auth needed
router.post('/signup', signup);
router.post('/login', login);

// Protected routes — must be logged in
// protect middleware runs first, then the controller
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

export default router;