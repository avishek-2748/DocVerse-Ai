import { generateSummary, generateQuiz, generateFlashcards, rewriteText as rewriteTextService } from '../services/intelligenceService.js';

/**
 * GET /api/intelligence/summary/:documentId
 *
 * Generates an executive summary of the specified document using
 * the Map-Reduce summarization pipeline.
 *
 * Success response (200):
 *   {
 *     "success": true,
 *     "summary": "Executive summary text...",
 *     "metadata": { "documentId": 7, "chunkCount": 4 }
 *   }
 */
async function getSummary(req, res) {
  const { documentId } = req.params;

  const parsedId = parseInt(documentId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'documentId must be a positive integer.',
    });
  }

  try {
    console.log(`[intelligenceController] getSummary — documentId=${parsedId}`);

    const { summary, chunkCount } = await generateSummary(parsedId);

    return res.status(200).json({
      success: true,
      summary,
      metadata: {
        documentId: parsedId,
        chunkCount,
      },
    });
  } catch (error) {
    console.error('[intelligenceController] getSummary error:', error);

    return res.status(500).json({
      success: false,
      message: 'An error occurred while generating the summary.',
      error: error.message,
    });
  }
}

/**
 * GET /api/intelligence/quiz/:documentId
 *
 * Generates a multiple-choice quiz based on the specified document.
 * Optionally accepts ?count=N query parameter (default 5).
 *
 * Success response (200):
 *   {
 *     "success": true,
 *     "quiz": [ { question, options, correctAnswer, explanation } ],
 *     "metadata": { "documentId": 7, "questionCount": 5, "chunkCount": 4 }
 *   }
 */
async function getQuiz(req, res) {
  const { documentId } = req.params;
  const questionCount = parseInt(req.query.count, 10) || 5;

  const parsedId = parseInt(documentId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'documentId must be a positive integer.',
    });
  }

  if (questionCount < 1 || questionCount > 20) {
    return res.status(400).json({
      success: false,
      message: 'Question count must be between 1 and 20.',
    });
  }

  try {
    console.log(
      `[intelligenceController] getQuiz — documentId=${parsedId}, count=${questionCount}`
    );

    const { quiz, chunkCount } = await generateQuiz(parsedId, questionCount);

    return res.status(200).json({
      success: true,
      quiz,
      metadata: {
        documentId: parsedId,
        questionCount: quiz.length,
        chunkCount,
      },
    });
  } catch (error) {
    console.error('[intelligenceController] getQuiz error:', error);

    return res.status(500).json({
      success: false,
      message: 'An error occurred while generating the quiz.',
      error: error.message,
    });
  }
}

/**
 * GET /api/intelligence/flashcards/:documentId
 *
 * Generates flashcards based on the specified document.
 * Optionally accepts ?count=N query parameter (default 10).
 */
async function getFlashcards(req, res) {
  const { documentId } = req.params;
  const cardCount = parseInt(req.query.count, 10) || 10;

  const parsedId = parseInt(documentId, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return res.status(400).json({ success: false, message: 'documentId must be a positive integer.' });
  }

  if (cardCount < 1 || cardCount > 30) {
    return res.status(400).json({ success: false, message: 'Card count must be between 1 and 30.' });
  }

  try {
    console.log(`[intelligenceController] getFlashcards — documentId=${parsedId}, count=${cardCount}`);
    const { flashcards, chunkCount } = await generateFlashcards(parsedId, cardCount);

    return res.status(200).json({
      success: true,
      flashcards,
      metadata: { documentId: parsedId, cardCount: flashcards.length, chunkCount },
    });
  } catch (error) {
    console.error('[intelligenceController] getFlashcards error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate flashcards.', error: error.message });
  }
}

/**
 * POST /api/intelligence/rewrite
 *
 * Rewrites arbitrary text based on a requested style.
 * Request body: { text: string, style: string }
 */
async function rewriteText(req, res) {
  const { text, style } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or empty required field: text.' });
  }

  if (!style || typeof style !== 'string') {
    return res.status(400).json({ success: false, message: 'Missing or empty required field: style.' });
  }

  try {
    console.log(`[intelligenceController] rewriteText — style=${style}, textLength=${text.length}`);
    const rewritten = await rewriteTextService(text, style);

    return res.status(200).json({ success: true, rewritten });
  } catch (error) {
    console.error('[intelligenceController] rewriteText error:', error);
    return res.status(500).json({ success: false, message: 'Failed to rewrite text.', error: error.message });
  }
}

export { getSummary, getQuiz, getFlashcards, rewriteText };
