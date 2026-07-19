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
    // ── Step 1: Insert document record with 'processing' status ──────────────
    const userId = req.user.id;
    const insertResult = await pool.query(
      `INSERT INTO documents (filename, status, user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [originalname, 'processing', userId]
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
    // processAndStoreEmbeddings handles all Gemini API calls and DB inserts.
    // It throws on any failure, which is caught below.
    console.log(`[documentController] Starting embedding pipeline for document ${documentId}…`);
    const chunkCount = await processAndStoreEmbeddings(documentId, rawText);

    // ── Step 4: Mark the document as fully completed ─────────────────────────
    await pool.query(
      `UPDATE documents SET status = $1 WHERE id = $2`,
      ['completed', documentId]
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

export { uploadDocument };
