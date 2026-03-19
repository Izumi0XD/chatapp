import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  addReaction,
} from '../controllers/message.controller.js';
import protect from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/:conversationId', getMessages);
router.post('/', sendMessage);
router.delete('/:messageId', deleteMessage);
router.put('/:messageId', editMessage);
router.post('/:messageId/reaction', addReaction);

export default router;