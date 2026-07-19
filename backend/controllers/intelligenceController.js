import { generateSummary, generateQuiz } from '../services/intelligenceService.js';

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

export { getSummary, getQuiz };
