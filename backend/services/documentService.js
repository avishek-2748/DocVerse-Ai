import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import pool from '../config/db.js';
import mammoth from 'mammoth';
import { pdfToPng } from 'pdf-to-png-converter';

const execFileAsync = promisify(execFile);

// Local path to pre-downloaded Tesseract language data (avoids network fetch at runtime)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESSDATA_PATH = path.join(__dirname, '..', 'tessdata');
// Temp dir for intermediate PNG files used by system tesseract binary
const TEMP_OCR_DIR = path.join(__dirname, '..', 'uploads', 'ocr_tmp');

// pdf-parse is a CommonJS package; use createRequire for safe ESM interop
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// Subclass GoogleGenerativeAIEmbeddings to pass outputDimensionality.
// This is necessary because LangChain's wrapper doesn't pass custom properties
// to the Google Gen AI SDK's embedContent method by default.
class CustomGoogleGenerativeAIEmbeddings extends GoogleGenerativeAIEmbeddings {
  outputDimensionality;

  constructor(fields) {
    super(fields);
    this.outputDimensionality = fields?.outputDimensionality;
  }

  _convertToContent(text) {
    const base = super._convertToContent(text);
    if (this.outputDimensionality) {
      base.outputDimensionality = this.outputDimensionality;
    }
    return base;
  }
}

// Minimum character threshold — below this we treat the PDF as image-based/scanned
const MIN_TEXT_LENGTH = 50;

// ─── Text Splitter Configuration ───────────────────────────────────────────────
// chunkSize  : maximum number of characters per chunk
// chunkOverlap: characters shared between consecutive chunks for semantic continuity
const TEXT_SPLITTER = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Runs the system tesseract binary on a given image file path.
 * Returns extracted text or empty string on failure.
 */
async function runTesseractBinary(imagePath) {
  try {
    // tesseract <input> stdout -l eng --tessdata-dir <dir>
    const { stdout } = await execFileAsync('tesseract', [
      imagePath,
      'stdout',
      '-l', 'eng',
      '--tessdata-dir', TESSDATA_PATH,
    ], { maxBuffer: 10 * 1024 * 1024 }); // 10MB output limit
    return stdout || '';
  } catch (err) {
    // tesseract exits non-zero even on partial success; check stderr
    if (err.stdout && err.stdout.trim().length > 0) return err.stdout;
    console.warn(`  [OCR] tesseract binary error: ${err.message}`);
    return '';
  }
}

async function recognizeImageFile(filePath) {
  return normalizeText(await runTesseractBinary(filePath));
}

async function extractTextFromDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const { value } = await mammoth.extractRawText({ buffer });
  return normalizeText(value);
}

async function extractTextFromPDFOCR(filePath, pageCount, onProgress) {
  try {
    const limitPages = Math.min(pageCount, 10);
    console.log(`[documentService] Converting PDF to PNG images (pages 1-${limitPages}) for OCR…`);

    const pngPages = await pdfToPng(filePath, { viewportScale: 2.0 });

    if (!pngPages || pngPages.length === 0) {
      console.warn(`[documentService] PDF conversion produced no image pages.`);
      return '';
    }

    // Check tessdata is available locally
    const tessdataFile = path.join(TESSDATA_PATH, 'eng.traineddata');
    if (!fs.existsSync(tessdataFile)) {
      throw new Error(
        `Tesseract language data not found at ${tessdataFile}. ` +
        `Please run: node backend/scripts/downloadTessdata.js`
      );
    }

    // Ensure temp directory exists
    fs.mkdirSync(TEMP_OCR_DIR, { recursive: true });

    const timestamp = Date.now();
    let combinedText = '';
    const tempFiles = [];

    for (let i = 0; i < Math.min(pngPages.length, limitPages); i++) {
      const page = pngPages[i];
      const tempPng = path.join(TEMP_OCR_DIR, `page_${timestamp}_${i}.png`);
      tempFiles.push(tempPng);

      // Write the PNG buffer to a temp file so the tesseract binary can read it
      fs.writeFileSync(tempPng, page.content);

      console.log(`[documentService] Running OCR on page ${i + 1}/${Math.min(pngPages.length, limitPages)}…`);
      const pageText = await runTesseractBinary(tempPng);

      if (pageText && pageText.trim().length > 0) {
        combinedText += `\n[Page ${i + 1}]\n` + pageText;
        console.log(`  [OCR] Page ${i + 1}: extracted ${pageText.trim().length} chars`);
      } else {
        console.log(`  [OCR] Page ${i + 1}: no text detected`);
      }
      if (onProgress) {
        const percent = 10 + Math.round(((i + 1) / Math.min(pngPages.length, limitPages)) * 40);
        onProgress(percent, 'extracting');
      }
    }

    // Clean up temp PNG files
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch (_) {}
    }

    console.log(`[documentService] OCR extraction complete (${combinedText.length} characters).`);
    return normalizeText(combinedText);

  } catch (ocrErr) {
    console.error(`[documentService] OCR pipeline failed:`, ocrErr);
    return '';
  }
}

async function extractTextFromFile(filePath, enableOCR = false, onProgress = null) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    return extractTextFromPDF(filePath, enableOCR, onProgress);
  }

  if (ext === '.docx') {
    const text = await extractTextFromDocx(filePath);
    return { text, pageCount: 1, isScanned: false };
  }

  if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(ext)) {
    if (!enableOCR) {
      throw new Error(
        'Image uploads require OCR to be enabled. Toggle "Enable OCR" and try again.'
      );
    }

    const text = await recognizeImageFile(filePath);
    
    // Even if OCR produces minimal text, allow the upload (mark as scanned)
    return { 
      text: text || '', 
      pageCount: 1, 
      isScanned: text.length < MIN_TEXT_LENGTH 
    };
  }

  throw new Error('Unsupported file type for text extraction.');
}

/**
 * Reads a PDF file at the given path and extracts plain text from it.
 *
 * @param {string} filePath - Absolute path to the PDF file on disk.
 * @returns {Promise<{ text: string, pageCount: number, isScanned: boolean }>}
 */
async function extractTextFromPDF(filePath, enableOCR, onProgress) {
  const fileBuffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(fileBuffer);

  let rawText = normalizeText(parsed.text ?? '');
  const pageCount = parsed.numpages ?? 0;
  let isScanned = rawText.length < MIN_TEXT_LENGTH;

  // If PDF appears to be scanned and OCR is enabled, attempt OCR (optional, non-blocking)
  if (isScanned && enableOCR) {
    console.log(`[documentService] Scanned PDF detected — attempting OCR extraction…`);
    const ocrText = await extractTextFromPDFOCR(filePath, pageCount, onProgress);
    if (ocrText && ocrText.length > 0) {
      rawText = ocrText;
      isScanned = false;
    }
  }

  return { text: rawText, pageCount, isScanned };
}

/**
 * Splits raw text into semantic chunks, generates vector embeddings for each
 * chunk via the Gemini API, and persists every chunk into the `document_chunks`
 * table linked to the given documentId.
 *
 * On any failure (embedding error or DB insert error), the function logs the
 * error and re-throws it so the caller can mark the parent document as 'failed'.
 *
 * @param {number} documentId - Primary key of the parent row in `documents`.
 * @param {string} rawText    - Full extracted text from the PDF.
 * @returns {Promise<number>} - Total number of chunks successfully stored.
 */
async function processAndStoreEmbeddings(documentId, rawText, onProgress = null) {
  // ── Step 1: Split the raw text into overlapping chunks ──────────────────────
  console.log(`[documentService] Splitting text for document ${documentId}…`);
  const chunks = await TEXT_SPLITTER.splitText(rawText);
  console.log(`[documentService] Produced ${chunks.length} chunk(s) from document ${documentId}.`);

  if (chunks.length === 0) {
    console.warn(`[documentService] No chunks produced for document ${documentId} — text too short or empty.`);
    console.warn(`  Raw text length: ${rawText.length} characters`);
    console.warn(`  Document may be an unreadable scanned image or corrupted file.`);
    return 0;
  }

  // ── Step 2: Initialise the Gemini embeddings model ──────────────────────────
  // We use gemini-embedding-001 (which supports MRL dimensionality reduction)
  // and truncate the output to 768 dimensions so it fits inside the PGVector
  // HNSW index size limit (2000 dimensions).
  const embeddingsModel = new CustomGoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    modelName: 'gemini-embedding-001',
    outputDimensionality: 768,
  });

  // ── Step 3: Embed each chunk and write it to the database ───────────────────
  // We process chunks in parallel with a concurrency limit of 5 to speed up
  // processing while staying within API rate limits and DB connection pool limits.
  let storedCount = 0;

  async function runWithConcurrencyLimit(concurrencyLimit, items, asyncFunction) {
    const results = [];
    const executing = new Set();
    
    for (const item of items) {
      const p = asyncFunction(item).then(res => {
        executing.delete(p);
        return res;
      });
      results.push(p);
      executing.add(p);
      if (executing.size >= concurrencyLimit) {
        await Promise.race(executing);
      }
    }
    return Promise.all(results);
  }

  await runWithConcurrencyLimit(5, chunks.map((text, idx) => ({ text, idx })), async ({ text, idx }) => {
    console.log(`[documentService] Embedding chunk ${idx + 1}/${chunks.length} for document ${documentId}…`);

    const embeddingVector = await embeddingsModel.embedQuery(text);
    const pgVectorString = `[${embeddingVector.join(',')}]`;

    await pool.query(
      `INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [documentId, idx, text, pgVectorString]
    );

    storedCount++;
    console.log(`[documentService] Stored chunk ${idx + 1}/${chunks.length} (document ${documentId}).`);
    
    if (onProgress) {
      const percent = 50 + Math.round((storedCount / chunks.length) * 45);
      onProgress(percent, 'embedding');
    }
  });

  console.log(
    `[documentService] Embedding pipeline complete. Stored ${storedCount} chunk(s) for document ${documentId}.`
  );
  return storedCount;
}

/**
 * Deletes a file from disk after processing is complete.
 * Called regardless of success or failure to prevent disk bloat.
 *
 * @param {string} filePath - Absolute path to the file to remove.
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[documentService] Failed to delete temp file: ${filePath}`, err.message);
  }
}

export { extractTextFromFile, extractTextFromPDF, processAndStoreEmbeddings, cleanupFile };
