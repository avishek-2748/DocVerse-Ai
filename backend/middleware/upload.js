import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure the uploads directory exists at startup
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage: preserve original filename with timestamp prefix to avoid collisions
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const safeOriginal = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniquePrefix}-${safeOriginal}`);
  },
});

// File filter: allow PDF, DOCX, and common image formats
const allowedExtensions = new Set(['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.bmp', '.tiff']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/bmp',
  'image/tiff',
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExtensions.has(ext) && allowedMimeTypes.has(mime)) {
    cb(null, true);
  } else {
    cb(
      new Error('Invalid file type. Only PDF, DOCX, PNG, JPG, JPEG, BMP, and TIFF files are accepted.'),
      false
    );
  }
};

// 50 MB file size limit
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export default upload;
