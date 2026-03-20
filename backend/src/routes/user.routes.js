import { Router } from 'express';
import {
  searchUsers,
  getUserById,
  updateProfile,
  getSidebarUsers,
  blockUser,
  unblockUser,
  deleteAccount,
} from '../controllers/user.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();
router.use(protect);

router.get('/', getSidebarUsers);
router.get('/search', searchUsers);
router.get('/:id', getUserById);
router.put('/profile', updateProfile);
router.post('/block/:userId', blockUser);
router.post('/unblock/:userId', unblockUser);
router.delete('/account', deleteAccount);

export default router;