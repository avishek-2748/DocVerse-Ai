import fs from 'fs';
import { createRequire } from 'module';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import pool from '../config/db.js';

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

/**
 * Reads a PDF file at the given path and extracts plain text from it.
 *
 * @param {string} filePath - Absolute path to the PDF file on disk.
 * @returns {Promise<{ text: string, pageCount: number, isScanned: boolean }>}
 */
async function extractTextFromPDF(filePath) {
  // Read file buffer synchronously — file is already on disk via multer
  const fileBuffer = fs.readFileSync(filePath);

  const parsed = await pdfParse(fileBuffer);

  const rawText = parsed.text?.trim() ?? '';
  const pageCount = parsed.numpages ?? 0;
  const isScanned = rawText.length < MIN_TEXT_LENGTH;

  if (isScanned) {
    // ----------------------------------------------------------------
    // SCANNED DOCUMENT DETECTED
    // The extracted text is empty or too short, which typically means
    // this PDF contains scanned image pages rather than selectable text.
    //
    // TODO — Step 7 (OCR Integration):
    //   1. Install: npm install tesseract.js
    //   2. Convert PDF pages to images (e.g. via `pdf-poppler` or `pdf2pic`).
    //   3. Pass each page image to Tesseract:
    //
    //      import Tesseract from 'tesseract.js';
    //      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    //
    //   4. Concatenate OCR text from all pages and return it here.
    // ----------------------------------------------------------------
    console.warn(
      `[documentService] Scanned PDF detected (text length: ${rawText.length}). OCR pipeline not yet implemented.`
    );
  }

  return {
    text: rawText,
    pageCount,
    isScanned,
  };
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
async function processAndStoreEmbeddings(documentId, rawText) {
  // ── Step 1: Split the raw text into overlapping chunks ──────────────────────
  console.log(`[documentService] Splitting text for document ${documentId}…`);
  const chunks = await TEXT_SPLITTER.splitText(rawText);
  console.log(`[documentService] Produced ${chunks.length} chunk(s) from document ${documentId}.`);

  if (chunks.length === 0) {
    console.warn(`[documentService] No chunks produced for document ${documentId} — skipping embedding.`);
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
  // We process chunks sequentially to stay well within the Gemini API
  // rate limits and to keep each DB insert atomic and observable in logs.
  let storedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];

    console.log(`[documentService] Embedding chunk ${i + 1}/${chunks.length} for document ${documentId}…`);

    // Generate a float[] embedding vector from the Gemini API.
    // embedQuery returns a plain number[] (e.g. [0.003, -0.142, …]).
    const embeddingVector = await embeddingsModel.embedQuery(chunkText);

    // Format the float array into a PostgreSQL-compatible vector literal.
    // pgvector expects the string '[0.003,-0.142,…]' — no spaces required,
    // though they are permitted.
    const pgVectorString = `[${embeddingVector.join(',')}]`;

    // Insert the chunk row; chunk_index is 0-based to match array indexing.
    await pool.query(
      `INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding)
       VALUES ($1, $2, $3, $4::vector)`,
      [documentId, i, chunkText, pgVectorString]
    );

    storedCount++;
    console.log(`[documentService] Stored chunk ${i + 1}/${chunks.length} (document ${documentId}).`);
  }

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

export { extractTextFromPDF, processAndStoreEmbeddings, cleanupFile };
