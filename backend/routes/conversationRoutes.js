import express from 'express';
import { getConversations, clearConversations } from '../controllers/conversationController.js';

const router = express.Router();

router.get('/:documentId', getConversations);
router.delete('/:documentId', clearConversations);

export default router;
