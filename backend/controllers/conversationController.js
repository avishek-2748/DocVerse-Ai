import pool from '../config/db.js';

/**
 * GET /api/conversations/:documentId
 * Returns all persisted messages for a specific document owned by the user.
 */
async function getConversations(req, res) {
  const userId = req.user.id;
  const { documentId } = req.params;
  const parsedDocId = parseInt(documentId, 10);

  if (isNaN(parsedDocId) || parsedDocId <= 0) {
    return res.status(400).json({ success: false, message: 'documentId must be a positive integer.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, role, content, created_at
       FROM conversations
       WHERE user_id = $1 AND document_id = $2
       ORDER BY created_at ASC`,
      [userId, parsedDocId]
    );
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[conversationController] getConversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve conversations.', error: error.message });
  }
}

/**
 * DELETE /api/conversations/:documentId
 * Clears all chat messages for a specific document for the current user.
 */
async function clearConversations(req, res) {
  const userId = req.user.id;
  const { documentId } = req.params;
  const parsedDocId = parseInt(documentId, 10);

  if (isNaN(parsedDocId) || parsedDocId <= 0) {
    return res.status(400).json({ success: false, message: 'documentId must be a positive integer.' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM conversations WHERE user_id = $1 AND document_id = $2`,
      [userId, parsedDocId]
    );
    return res.status(200).json({ success: true, message: `${result.rowCount} message(s) cleared.` });
  } catch (error) {
    console.error('[conversationController] clearConversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to clear conversations.', error: error.message });
  }
}

export { getConversations, clearConversations };
