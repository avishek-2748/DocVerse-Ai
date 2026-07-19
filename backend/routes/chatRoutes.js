import { Router } from 'express';
import { askQuestion } from '../controllers/chatController.js';

const router = Router();

/**
 * POST /api/chat/ask
 *
 * Body: { documentId: number, query: string }
 *
 * Runs the full RAG pipeline:
 *   1. Embeds the query using Gemini.
 *   2. Retrieves top-k relevant chunks from pgvector via cosine similarity.
 *   3. Calls Gemini 2.0 Flash with a grounded prompt to generate the answer.
 */
router.post('/ask', askQuestion);

export default router;
