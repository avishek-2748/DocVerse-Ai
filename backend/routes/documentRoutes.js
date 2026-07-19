import { Router } from 'express';
import upload from '../middleware/upload.js';
import { uploadDocument } from '../controllers/documentController.js';

const router = Router();

/**
 * POST /api/documents/upload
 *
 * Accepts a multipart/form-data request with a single PDF file attached
 * under the field name "file".
 *
 * Middleware chain:
 *   1. upload.single('file') — validates type (.pdf only), stores to /uploads,
 *      enforces 50 MB size limit, and attaches req.file.
 *   2. multerErrorHandler — catches multer-specific errors (wrong type, too large)
 *      and returns a clean 400 JSON response instead of crashing.
 *   3. uploadDocument — controller that processes the file and returns results.
 */

// Inline multer error handler to convert multer errors to clean JSON responses
function multerErrorHandler(err, req, res, next) {
  if (err) {
    // MulterError codes: LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, etc.
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'File upload error.',
    });
  }
  next();
}

router.post(
  '/upload',
  upload.single('file'),
  multerErrorHandler,
  uploadDocument
);

export default router;
