import { Router } from 'express';
import { getSummary, getQuiz, getFlashcards, rewriteText } from '../controllers/intelligenceController.js';

const router = Router();

/**
 * GET /api/intelligence/summary/:documentId
 *
 * Runs the Map-Reduce summarization pipeline and returns an
 * executive summary of the uploaded document.
 */
router.get('/summary/:documentId', getSummary);

/**
 * GET /api/intelligence/quiz/:documentId?count=5
 *
 * Generates a multiple-choice quiz from the document content.
 * Optional query param: count (1–20, default 5).
 */
router.get('/quiz/:documentId', getQuiz);

router.get('/flashcards/:documentId', getFlashcards);

router.post('/rewrite', rewriteText);

export default router;
