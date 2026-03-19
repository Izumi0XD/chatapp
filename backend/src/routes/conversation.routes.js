import { Router } from 'express';
import {
  getConversations,
  getOrCreateConversation,
  createGroupConversation,
} from '../controllers/conversation.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/', getConversations);
router.post('/', getOrCreateConversation);
router.post('/group', createGroupConversation);

export default router;