import { Router } from 'express';
import upload from '../middleware/upload.js';
import { uploadDocument, getDocuments, deleteDocument, bulkDeleteDocuments } from '../controllers/documentController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Inline multer error handler to convert multer errors to clean JSON responses
function multerErrorHandler(err, req, res, next) {
  if (err) {
    const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'File upload error.',
    });
  }
  next();
}

// GET /api/documents — list all documents for the authenticated user
router.get('/', verifyToken, getDocuments);

// POST /api/documents/upload — upload and process a new PDF
router.post(
  '/upload',
  verifyToken,
  upload.single('file'),
  multerErrorHandler,
  uploadDocument
);

// DELETE /api/documents — bulk delete by strategy (all | oldest N | newest N)
router.delete('/', verifyToken, bulkDeleteDocuments);

// DELETE /api/documents/:documentId — delete a single document
router.delete('/:documentId', verifyToken, deleteDocument);

export default router;
