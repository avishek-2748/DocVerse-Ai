import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';
import pool from '../config/db.js';

// ─── Constants ──────────────────────────────────────────────────────────────────
// The user requested gemini-1.5-flash, but due to API key restrictions on this
// project, we default to gemini-3.1-flash-lite. To use 1.5-flash, update this constant.
const CHAT_MODEL = 'gemini-3.1-flash-lite';

// ─── Prompt Template ────────────────────────────────────────────────────────────

const COMPARISON_TEMPLATE = PromptTemplate.fromTemplate(
  `You are a rigorous document auditor. Your task is to compare two versions of a document and provide a detailed analysis of the differences.

Here is Document A (The Original Version):
---
{documentA}
---

Here is Document B (The Updated Version):
---
{documentB}
---

Analyze the two documents and return a structured JSON report containing exactly these four keys:
1. "summaryOfChanges": A high-level overview text string summarizing the overall changes.
2. "additions": An array of strings representing newly added text, concepts, or clauses found in Document B but not Document A.
3. "deletions": An array of strings representing text, concepts, or clauses removed from Document A and absent in Document B.
4. "modifications": An array of objects showing modified text, where each object has exactly two keys: "original" (the text from Document A) and "updated" (the corresponding updated text from Document B).

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include markdown formatting like \`\`\`json or \`\`\`. Do not include any other text before or after the JSON.

JSON OUTPUT:`
);

// ─── Helper: Retrieve all chunks and reconstruct full text ─────────────────────

/**
 * Fetches all chunk_text rows for a given documentId, ordered by chunk_index,
 * and concatenates them into a single string.
 *
 * @param {number} documentId
 * @returns {Promise<string>} Reconstructed full document text.
 */
async function getFullDocumentText(documentId) {
  const result = await pool.query(
    `SELECT chunk_text
     FROM document_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No content found for document ID ${documentId}. Has it been uploaded and processed?`);
  }

  return result.rows.map((row) => row.chunk_text.trim()).join('\\n\\n');
}

// ─── Document Comparison Service ───────────────────────────────────────────────

/**
 * Compares two documents using the Gemini API and returns a structured JSON report.
 *
 * @param {number} docIdA - Primary key of the original document.
 * @param {number} docIdB - Primary key of the updated document.
 * @returns {Promise<Object>} The parsed JSON comparison report.
 */
async function compareDocumentVersions(docIdA, docIdB) {
  console.log(`[comparisonService] Starting comparison between doc ${docIdA} and doc ${docIdB}…`);

  // 1. Reconstruct full texts
  const [documentA, documentB] = await Promise.all([
    getFullDocumentText(docIdA),
    getFullDocumentText(docIdB),
  ]);

  console.log(`[comparisonService] Retrieved texts. Doc A length: ${documentA.length}, Doc B length: ${documentB.length}`);

  // 2. Initialize Gemini Model
  // Using temperature 0.1 for high precision and deterministic output as requested.
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: CHAT_MODEL,
    temperature: 0.1,
    maxOutputTokens: 8192, // High token limit for detailed comparisons
  });

  // 3. Format Prompt
  const prompt = await COMPARISON_TEMPLATE.format({
    documentA,
    documentB,
  });

  // 4. Call LLM
  console.log(`[comparisonService] Calling Gemini for comparison analysis…`);
  const response = await model.invoke([new HumanMessage(prompt)]);
  const rawOutput = response.content?.trim() ?? '';

  // 5. Safely Parse JSON Output
  let cleanedOutput = rawOutput;
  
  // Strip potential markdown fences
  const jsonFenceMatch = cleanedOutput.match(/```(?:json)?\\s*([\\s\\S]*?)```/);
  if (jsonFenceMatch) {
    cleanedOutput = jsonFenceMatch[1].trim();
  }

  let comparisonReport;
  try {
    comparisonReport = JSON.parse(cleanedOutput);
  } catch (parseError) {
    console.error('[comparisonService] Failed to parse comparison JSON:', parseError.message);
    console.error('[comparisonService] Raw output:', rawOutput.slice(0, 500) + '...');
    throw new Error(
      'The AI returned an invalid comparison format. Please try again. ' +
        `Parse error: ${parseError.message}`
    );
  }

  // 6. Validate Output Structure
  if (!comparisonReport || typeof comparisonReport !== 'object') {
    throw new Error('Comparison report is not a valid JSON object.');
  }

  // Ensure default structure if the LLM missed fields
  return {
    summaryOfChanges: comparisonReport.summaryOfChanges || 'No summary provided.',
    additions: Array.isArray(comparisonReport.additions) ? comparisonReport.additions : [],
    deletions: Array.isArray(comparisonReport.deletions) ? comparisonReport.deletions : [],
    modifications: Array.isArray(comparisonReport.modifications) ? comparisonReport.modifications : [],
  };
}

export { compareDocumentVersions };
