import { generateRAGResponse } from '../services/chatService.js';
import pool from '../config/db.js';

/**
 * POST /api/chat/ask
 *
 * Accepts a documentId and query, runs the RAG pipeline, auto-persists
 * both the user message and AI answer to the conversations table.
 */
async function askQuestion(req, res) {
  const { documentId, query } = req.body;
  const userId = req.user.id;

  if (!documentId) {
    return res.status(400).json({ success: false, message: 'Missing required field: documentId.' });
  }
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or empty required field: query.' });
  }

  const parsedDocumentId = parseInt(documentId, 10);
  if (isNaN(parsedDocumentId) || parsedDocumentId <= 0) {
    return res.status(400).json({ success: false, message: 'documentId must be a positive integer.' });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const smallTalkReplies = {
    wow: 'Thank you! I’m glad the document was interesting.',
    nice: 'Thanks! If you want, ask another question about the document.',
    good: 'Great! Let me know if you have another question about the document.',
    thanks: 'You’re welcome! I’m here to help with the document.',
    'thank you': 'You’re welcome! I’m here to help with the document.',
    yep: 'Got it! If you want to continue, ask another document question.',
    'yep!': 'Got it! If you want to continue, ask another document question.',
    whoa: 'Thanks! If you’d like, ask another document question.',
    amazing: 'I’m glad you liked it! Ask another document question if you want.',
  };

  try {
    console.log(`[chatController] askQuestion — userId=${userId}, documentId=${parsedDocumentId}, query="${query.slice(0, 60)}…"`);

    if (Object.prototype.hasOwnProperty.call(smallTalkReplies, normalizedQuery)) {
      const reply = smallTalkReplies[normalizedQuery];
      await pool.query(
        `INSERT INTO conversations (user_id, document_id, role, content) VALUES ($1, $2, 'user', $3), ($1, $2, 'ai', $4)`,
        [userId, parsedDocumentId, query.trim(), reply]
      );
      return res.status(200).json({ success: true, answer: reply, metadata: { documentId: parsedDocumentId, smallTalk: true } });
    }

    // Fetch recent conversation history for context
    const historyResult = await pool.query(
      `SELECT role, content FROM conversations WHERE user_id = $1 AND document_id = $2 ORDER BY created_at ASC LIMIT 10`,
      [userId, parsedDocumentId]
    );
    const chatHistory = historyResult.rows;

    // Run the RAG pipeline
    const { answer, metadata } = await generateRAGResponse(parsedDocumentId, query, 8, chatHistory);

    // Auto-persist user message + AI answer to conversations table
    await pool.query(
      `INSERT INTO conversations (user_id, document_id, role, content) VALUES ($1, $2, 'user', $3), ($1, $2, 'ai', $4)`,
      [userId, parsedDocumentId, query.trim(), answer]
    );

    return res.status(200).json({ success: true, answer, metadata });

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
