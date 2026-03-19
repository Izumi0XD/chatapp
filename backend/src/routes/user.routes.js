import { Router } from 'express';
import {
  searchUsers,
  getUserById,
  updateProfile,
  getSidebarUsers,
} from '../controllers/user.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();

// All user routes require authentication
router.use(protect);

router.get('/', getSidebarUsers);
router.get('/search', searchUsers);
router.get('/:id', getUserById);
router.put('/profile', updateProfile);

export default router;