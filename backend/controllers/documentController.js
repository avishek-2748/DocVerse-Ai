import pool from '../config/db.js';
import {
  extractTextFromPDF,
  processAndStoreEmbeddings,
  cleanupFile,
} from '../services/documentService.js';

/**
 * POST /api/documents/upload
 *
 * Handles an incoming PDF upload. Full pipeline:
 *   1. Validate that multer attached a file to the request.
 *   2. Insert a parent row into `documents` with status = 'processing'.
 *   3. Extract raw text from the PDF (pdf-parse).
 *   4. Chunk the text, generate Gemini embeddings, and store every chunk
 *      in `document_chunks` via processAndStoreEmbeddings().
 *   5. Mark the parent document as status = 'completed'.
 *   6. Return document_id, filename, page_count, chunk_count, and scanned flag.
 *
 *   On any error:
 *   - Log the error.
 *   - Mark the parent document row as status = 'failed'.
 *   - Return a structured 500 response.
 *
 *   Always:
 *   - Clean up the temp file from disk (in `finally`).
 */
async function uploadDocument(req, res) {
  // Multer error forwarding (e.g., wrong file type, size exceeded)
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please attach a PDF file with the key "file".',
    });
  }

  const { originalname, path: filePath, size } = req.file;
  let documentId = null;

  try {
    const userId = req.user.id;

    // ── Step 0: Quota check ─────────────────────────────────────────────────
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
      const { cleanupFile: cleanup } = await import('../services/documentService.js');
      await cleanup(filePath).catch(() => {});
      const mbFree = ((quotaBytes - usedBytes) / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        success: false,
        message: `Storage quota exceeded. You have only ${mbFree} MB free. Delete older documents to upload new ones.`,
      });
    }

    // ── Step 1: Insert document record with 'processing' status ──────────────
    const insertResult = await pool.query(
      `INSERT INTO documents (filename, status, user_id, file_size_bytes, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [originalname, 'processing', userId, size]
    );
    documentId = insertResult.rows[0].id;
    console.log(`[documentController] Created document record id=${documentId} for "${originalname}".`);


    // ── Step 2: Extract raw text from the uploaded PDF ───────────────────────
    console.log(`[documentController] Extracting text from "${originalname}"…`);
    const { text: rawText, pageCount, isScanned } = await extractTextFromPDF(filePath);
    console.log(
      `[documentController] Extraction complete — pages: ${pageCount}, scanned: ${isScanned}, text length: ${rawText.length}.`
    );

    // ── Step 3: Chunk, embed, and store the text in document_chunks ──────────
    console.log(`[documentController] Starting embedding pipeline for document ${documentId}…`);
    const chunkCount = await processAndStoreEmbeddings(documentId, rawText);

    // ── Step 4: Mark the document as fully completed and persist all metadata ─
    await pool.query(
      `UPDATE documents 
       SET status = $1, page_count = $2, is_scanned = $3, chunk_count = $4
       WHERE id = $5`,
      ['completed', pageCount, isScanned, chunkCount, documentId]
    );
    console.log(`[documentController] Document ${documentId} marked as 'completed' (${chunkCount} chunks stored).`);

    // ── Step 5: Return success response ──────────────────────────────────────
    return res.status(201).json({
      success: true,
      message: isScanned
        ? `PDF uploaded. Scanned document detected — ${chunkCount} chunk(s) vectorised (OCR text may be sparse).`
        : `PDF uploaded, embedded, and stored successfully. ${chunkCount} chunk(s) vectorised.`,
      data: {
        document_id: documentId,
        filename: originalname,
        file_size_bytes: size,
        page_count: pageCount,
        is_scanned: isScanned,
        status: 'completed',
        chunk_count: chunkCount,
      },
    });

  } catch (error) {
    console.error('[documentController] uploadDocument error:', error);

    // Attempt to mark the document as failed if it was already inserted
    if (documentId !== null) {
      try {
        await pool.query(
          `UPDATE documents SET status = $1 WHERE id = $2`,
          ['failed', documentId]
        );
        console.warn(`[documentController] Document ${documentId} marked as 'failed'.`);
      } catch (dbError) {
        console.error(
          '[documentController] Failed to update document status to failed:',
          dbError.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred during document processing.',
      error: error.message,
    });

  } finally {
    // Always delete the temp file from the uploads directory
    cleanupFile(filePath);
  }
}

/**
 * GET /api/documents
 *
 * Fetches all documents belonging to the authenticated user.
 */
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

/**
 * DELETE /api/documents/:documentId
 *
 * Deletes a single document by ID.
 */
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

/**
 * DELETE /api/documents
 *
 * Handles bulk deletion of documents based on a strategy:
 *   - 'all': Deletes all documents belonging to user.
 *   - 'oldest': Deletes the oldest N documents.
 *   - 'newest': Deletes the newest N documents.
 */
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

export { uploadDocument, getDocuments, deleteDocument, bulkDeleteDocuments };
