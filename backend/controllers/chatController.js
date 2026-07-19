import { generateRAGResponse } from '../services/chatService.js';

/**
 * POST /api/chat/ask
 *
 * Accepts a documentId and query from the request body, runs the full RAG
 * pipeline via chatService, and returns the AI-generated answer.
 *
 * Request body:
 *   {
 *     "documentId": 7,
 *     "query": "What is this document about?"
 *   }
 *
 * Success response (200):
 *   {
 *     "success": true,
 *     "answer": "This document is about...",
 *     "metadata": {
 *       "documentId": 7,
 *       "chunksRetrieved": 5,
 *       "topSimilarity": 0.8921
 *     }
 *   }
 *
 * Error response (400 | 500):
 *   {
 *     "success": false,
 *     "message": "...",
 *     "error": "..."
 *   }
 */
async function askQuestion(req, res) {
  const { documentId, query } = req.body;

  // ── Validate request body ─────────────────────────────────────────────────
  if (!documentId) {
    return res.status(400).json({
      success: false,
      message: 'Missing required field: documentId.',
    });
  }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing or empty required field: query.',
    });
  }

  const parsedDocumentId = parseInt(documentId, 10);
  if (isNaN(parsedDocumentId) || parsedDocumentId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'documentId must be a positive integer.',
    });
  }

  try {
    console.log(
      `[chatController] askQuestion — documentId=${parsedDocumentId}, query="${query.slice(0, 60)}…"`
    );

    // ── Run the RAG pipeline ────────────────────────────────────────────────
    const { answer, sourceChunks, metadata } = await generateRAGResponse(
      parsedDocumentId,
      query
    );

    return res.status(200).json({
      success: true,
      answer,
      metadata,
    });

  } catch (error) {
    console.error('[chatController] askQuestion error:', error);

    return res.status(500).json({
      success: false,
      message: 'An error occurred while generating the answer.',
      error: error.message,
    });
  }
}

export { askQuestion };
