import pool from '../config/db.js';
import {
  extractTextFromFile,
  processAndStoreEmbeddings,
  cleanupFile,
} from '../services/documentService.js';

async function processDocumentInBackground(documentId, filePath, enableOCR, originalname) {
  try {
    const onProgress = async (percent, stage) => {
      try {
        await pool.query(
          `UPDATE documents SET progress_percent = $1, progress_stage = $2 WHERE id = $3`,
          [percent, stage, documentId]
        );
      } catch (err) {
        console.error('Failed to update progress in DB:', err);
      }
    };

    await onProgress(10, 'extracting');
    
    console.log(`[documentController] Extracting text from "${originalname}" (OCR=${enableOCR})…`);
    const { text: rawText, pageCount, isScanned } = await extractTextFromFile(filePath, enableOCR, onProgress);
    
    // Warn if text extraction produced very minimal content, but allow upload
    if (!rawText || rawText.length < 20) {
      console.warn(`[documentController] Document ${documentId} has minimal text (${rawText.length} chars). Limited Q&A results expected.`);
    }

    await onProgress(50, 'embedding');
    
    console.log(`[documentController] Starting embedding pipeline for document ${documentId}…`);
    const chunkCount = await processAndStoreEmbeddings(documentId, rawText, onProgress);

    await pool.query(
      `UPDATE documents 
       SET status = $1, progress_percent = 100, progress_stage = 'completed', page_count = $2, is_scanned = $3, chunk_count = $4
       WHERE id = $5`,
      ['completed', pageCount, isScanned, chunkCount, documentId]
    );
    console.log(`[documentController] Document ${documentId} marked as 'completed' (${chunkCount} chunks stored).`);

  } catch (error) {
    console.error(`[documentController] processDocumentInBackground error for doc ${documentId}:`, error);
    try {
      await pool.query(
        `UPDATE documents SET status = 'failed', progress_stage = 'failed' WHERE id = $1`,
        [documentId]
      );
    } catch (dbError) {
      console.error('[documentController] Failed to update document status to failed:', dbError.message);
    }
  } finally {
    cleanupFile(filePath);
  }
}

async function uploadDocument(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach a supported file with the key "file".',
    });
  }

  const { originalname, path: filePath, size } = req.file;
  let documentId = null;

  try {
    const userId = req.user.id;

    // Quota check
    const quotaResult = await pool.query(
      `SELECT 
         COALESCE(SUM(d.file_size_bytes), 0)::BIGINT AS used_bytes,
         u.storage_quota_bytes AS quota_bytes
       FROM users u
       LEFT JOIN documents d ON d.user_id = u.id AND d.status = 'completed'
       WHERE u.id = $1
       GROUP BY u.storage_quota_bytes`,
      [userId]
    );
    const quotaRow = quotaResult.rows[0] || { used_bytes: 0, quota_bytes: 1073741824 };
    const usedBytes = parseInt(quotaRow.used_bytes, 10);
    const quotaBytes = parseInt(quotaRow.quota_bytes, 10);

    if (usedBytes + size > quotaBytes) {
      cleanupFile(filePath);
      const mbFree = ((quotaBytes - usedBytes) / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        success: false,
        message: `Storage quota exceeded. You have only ${mbFree} MB free. Delete older documents to upload new ones.`,
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO documents (filename, status, progress_percent, progress_stage, user_id, file_size_bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      [originalname, 'processing', 0, 'queued', userId, size]
    );
    documentId = insertResult.rows[0].id;
    console.log(`[documentController] Created document record id=${documentId} for "${originalname}".`);

    const enableOCR = req.body.enableOCR === 'true';
    
    // START BACKGROUND PROCESSING (DO NOT AWAIT)
    processDocumentInBackground(documentId, filePath, enableOCR, originalname).catch(err => {
      console.error(`Background processing failed for ${documentId}:`, err);
    });

    return res.status(201).json({
      success: true,
      message: 'Document accepted for processing.',
      data: {
        document_id: documentId,
        filename: originalname,
        file_size_bytes: size,
        status: 'processing',
        progress_percent: 0,
        progress_stage: 'queued',
      },
    });

  } catch (error) {
    console.error('[documentController] uploadDocument error:', error);
    cleanupFile(filePath);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during document processing.',
      error: error.message,
    });
  }
}

async function getDocumentStatus(req, res) {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT status, progress_percent, progress_stage, page_count, is_scanned, chunk_count 
       FROM documents 
       WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[documentController] getDocumentStatus error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve document status.',
      error: error.message,
    });
  }
}

async function getDocuments(req, res) {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT 
         id AS document_id,
         filename,
         file_size_bytes,
         page_count,
         is_scanned,
         chunk_count,
         status,
         progress_percent,
         progress_stage,
         summary,
         COALESCE(created_at, upload_date) AS created_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY COALESCE(created_at, upload_date) DESC`,
      [userId]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[documentController] getDocuments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents.',
      error: error.message,
    });
  }
}

async function deleteDocument(req, res) {
  try {
    const { documentId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found or unauthorized.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully.',
    });
  } catch (error) {
    console.error('[documentController] deleteDocument error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document.',
      error: error.message,
    });
  }
}

async function bulkDeleteDocuments(req, res) {
  try {
    const userId = req.user.id;
    const { strategy, count } = req.body;

    if (!strategy) {
      return res.status(400).json({
        success: false,
        message: 'Strategy is required (all, oldest, newest).',
      });
    }

    let query = '';
    const params = [userId];

    if (strategy === 'all') {
      query = 'DELETE FROM documents WHERE user_id = $1';
    } else {
      const limit = parseInt(count, 10);
      if (isNaN(limit) || limit <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid count > 0 is required for oldest/newest strategy.',
        });
      }
      params.push(limit);

      const order = strategy === 'oldest' ? 'ASC' : 'DESC';
      query = `
        DELETE FROM documents 
        WHERE id IN (
          SELECT id FROM documents 
          WHERE user_id = $1 
          ORDER BY COALESCE(created_at, upload_date) ${order} 
          LIMIT $2
        )
      `;
    }

    await pool.query(query, params);

    res.status(200).json({
      success: true,
      message: `Documents deleted successfully using strategy: ${strategy}.`,
    });
  } catch (error) {
    console.error('[documentController] bulkDeleteDocuments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk deletion.',
      error: error.message,
    });
  }
}

export { uploadDocument, getDocumentStatus, getDocuments, deleteDocument, bulkDeleteDocuments };
