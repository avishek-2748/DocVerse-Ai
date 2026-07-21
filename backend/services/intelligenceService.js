import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';
import pool from '../config/db.js';

// ─── Constants ──────────────────────────────────────────────────────────────────
// The model confirmed working on this project's free tier with AQ. keys.
// Swap to gemini-2.0-flash or gemini-2.5-flash when billing is enabled.
const CHAT_MODEL = 'gemini-3.1-flash-lite';

// ─── Prompt Templates ───────────────────────────────────────────────────────────

// MAP step: summarise a single chunk
const MAP_SUMMARY_TEMPLATE = PromptTemplate.fromTemplate(
  `You are a professional document analyst. Read the following excerpt from a document and provide a concise summary capturing the key facts, figures, and ideas. Do NOT add any information that is not present in the text.

EXCERPT:
{chunkText}

CONCISE SUMMARY:`
);

// REDUCE step: combine chunk summaries into one executive summary
const REDUCE_SUMMARY_TEMPLATE = PromptTemplate.fromTemplate(
  `You are a professional document analyst. Below are individual summaries extracted from different sections of the same document. Combine them into a single, coherent executive summary. The executive summary should:
1. Be well-structured with clear paragraphs.
2. Capture ALL key points from the individual summaries.
3. Eliminate redundancy while preserving important details.
4. Use professional, clear language.
5. Be between 150–400 words.

INDIVIDUAL SUMMARIES:
{combinedSummaries}

EXECUTIVE SUMMARY:`
);

// Quiz generation prompt
const QUIZ_TEMPLATE = PromptTemplate.fromTemplate(
  `You are an expert quiz creator. Based ONLY on the document content provided below, generate exactly {questionCount} multiple-choice quiz questions.

DOCUMENT CONTENT:
{documentText}

RULES:
1. Each question must be directly answerable from the document content.
2. Each question must have exactly 4 options labeled A, B, C, and D.
3. Exactly one option must be the correct answer.
4. Provide a brief explanation for why the correct answer is right.
5. Make questions test genuine understanding, not trivial details.
6. Vary the difficulty — include some easy and some harder questions.

You MUST respond with ONLY a valid JSON array (no markdown fences, no extra text). Each element must have this exact schema:
[
  {{
    "question": "The question text here?",
    "options": ["A) option text", "B) option text", "C) option text", "D) option text"],
    "correctAnswer": "A",
    "explanation": "Brief explanation why A is correct."
  }}
]

JSON OUTPUT:`
);
// Flashcard generation prompt
const FLASHCARD_TEMPLATE = PromptTemplate.fromTemplate(
  `You are an expert educational flashcard creator. Based ONLY on the document content provided below, generate exactly {cardCount} high-quality flashcards.

DOCUMENT CONTENT:
{documentText}

RULES:
1. Each flashcard must extract a key concept, term, or important fact.
2. The "front" should be a clear, concise question or term.
3. The "back" should be the direct answer or definition.
4. Keep the "back" brief (1-3 sentences maximum).
5. Output MUST be a pure JSON array containing objects with "front" and "back" keys.
6. Return EXACTLY a valid JSON array, and nothing else. No markdown formatting.

OUTPUT FORMAT (JSON Array):
[
  {{
    "front": "What does API stand for?",
    "back": "Application Programming Interface."
  }}
]`
);

// Rewrite prompt
const REWRITE_TEMPLATE = PromptTemplate.fromTemplate(
  `You are an expert AI editor. Please rewrite the following text according to the requested style.

STYLE REQUEST: {style}

ORIGINAL TEXT:
{originalText}

REWRITTEN TEXT:`
);

// ─── Helper: Retrieve all chunks for a document ────────────────────────────────

/**
 * Fetches all chunk_text rows for a given documentId, ordered by chunk_index.
 *
 * @param {number} documentId
 * @returns {Promise<string[]>} Array of chunk text strings.
 */
async function getDocumentChunks(documentId) {
  const result = await pool.query(
    `SELECT chunk_text
     FROM document_chunks
     WHERE document_id = $1
     ORDER BY chunk_index ASC`,
    [documentId]
  );

  if (result.rows.length === 0) {
    throw new Error(`No chunks found for document ID ${documentId}. Has it been uploaded and processed?`);
  }

  return result.rows.map((row) => row.chunk_text);
}

// ─── Summary Generation (Map-Reduce) ───────────────────────────────────────────

/**
 * Generates a comprehensive executive summary of a document using a
 * Map-Reduce strategy:
 *   1. MAP  — Summarise each chunk independently.
 *   2. REDUCE — Combine chunk summaries into one executive summary.
 *
 * This approach handles arbitrarily long documents without exceeding
 * the model's context window, because each MAP call processes a single
 * chunk (~1000 chars) rather than the full document.
 *
 * @param {number} documentId - Primary key of the document to summarise.
 * @returns {Promise<{ summary: string, chunkCount: number }>}
 */
async function generateSummary(documentId) {
  console.log(`[intelligenceService] Starting summary generation for document ${documentId}…`);

  // ── Step 1: Retrieve chunks ─────────────────────────────────────────────
  const chunks = await getDocumentChunks(documentId);
  console.log(`[intelligenceService] Retrieved ${chunks.length} chunk(s).`);

  // ── Step 2: Initialise the chat model ───────────────────────────────────
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: CHAT_MODEL,
    temperature: 0.2,
    maxOutputTokens: 1024,
  });

  // ── Step 3: MAP — Summarise each chunk individually ─────────────────────
  console.log(`[intelligenceService] MAP phase: summarising ${chunks.length} chunk(s)…`);
  const chunkSummaries = [];

  for (let i = 0; i < chunks.length; i++) {
    const prompt = await MAP_SUMMARY_TEMPLATE.format({ chunkText: chunks[i] });
    const response = await model.invoke([new HumanMessage(prompt)]);
    const summaryText = response.content?.trim() ?? '';
    chunkSummaries.push(summaryText);
    console.log(`[intelligenceService]   MAP chunk ${i + 1}/${chunks.length} done (${summaryText.length} chars).`);
  }

  // ── Step 4: REDUCE — Combine into final executive summary ──────────────
  console.log(`[intelligenceService] REDUCE phase: combining chunk summaries…`);
  const combinedSummaries = chunkSummaries
    .map((s, idx) => `[Section ${idx + 1}]\n${s}`)
    .join('\n\n');

  const reducePrompt = await REDUCE_SUMMARY_TEMPLATE.format({ combinedSummaries });
  const reduceResponse = await model.invoke([new HumanMessage(reducePrompt)]);
  const finalSummary = reduceResponse.content?.trim() ?? 'Summary generation failed.';

  console.log(`[intelligenceService] Summary generated (${finalSummary.length} chars).`);

  return {
    summary: finalSummary,
    chunkCount: chunks.length,
  };
}

// ─── Quiz Generation ────────────────────────────────────────────────────────────

/**
 * Generates a multiple-choice quiz based on the document's content.
 *
 * @param {number} documentId    - Primary key of the document.
 * @param {number} questionCount - Number of quiz questions to generate (default 5).
 * @returns {Promise<{ quiz: Array, chunkCount: number }>}
 */
async function generateQuiz(documentId, questionCount = 5) {
  console.log(`[intelligenceService] Starting quiz generation for document ${documentId} (${questionCount} questions)…`);

  // ── Step 1: Retrieve chunks ─────────────────────────────────────────────
  const chunks = await getDocumentChunks(documentId);
  console.log(`[intelligenceService] Retrieved ${chunks.length} chunk(s).`);

  // ── Step 2: Combine all chunks into a single context ────────────────────
  // For quiz generation, we pass the full document text so the model can
  // create questions that span across sections.
  const documentText = chunks
    .map((text, idx) => `[Section ${idx + 1}]\n${text.trim()}`)
    .join('\n\n---\n\n');

  // ── Step 3: Initialise the chat model ───────────────────────────────────
  // Slightly higher temperature (0.5) for more creative question variation.
  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: CHAT_MODEL,
    temperature: 0.5,
    maxOutputTokens: 4096,
  });

  // ── Step 4: Generate the quiz ───────────────────────────────────────────
  const prompt = await QUIZ_TEMPLATE.format({
    documentText,
    questionCount: String(questionCount),
  });

  console.log(`[intelligenceService] Calling Gemini for quiz generation…`);
  const response = await model.invoke([new HumanMessage(prompt)]);
  const rawOutput = response.content?.trim() ?? '';

  // ── Step 5: Parse the JSON response ─────────────────────────────────────
  // The model may wrap the JSON in markdown code fences. Strip them.
  let cleanedOutput = rawOutput;

  // Remove ```json ... ``` fences
  const jsonFenceMatch = cleanedOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonFenceMatch) {
    cleanedOutput = jsonFenceMatch[1].trim();
  }

  let quiz;
  try {
    quiz = JSON.parse(cleanedOutput);
  } catch (parseError) {
    console.error('[intelligenceService] Failed to parse quiz JSON:', parseError.message);
    console.error('[intelligenceService] Raw output:', rawOutput.slice(0, 500));
    throw new Error(
      'The AI returned an invalid quiz format. Please try again. ' +
        `Parse error: ${parseError.message}`
    );
  }

  // ── Step 6: Validate structure ──────────────────────────────────────────
  if (!Array.isArray(quiz)) {
    throw new Error('Quiz response is not a JSON array.');
  }

  // Light validation — ensure each item has required keys
  const validatedQuiz = quiz.map((item, idx) => {
    if (!item.question || !Array.isArray(item.options) || !item.correctAnswer) {
      console.warn(`[intelligenceService] Quiz item ${idx} has incomplete fields — patching.`);
    }
    return {
      question: item.question || `Question ${idx + 1}`,
      options: Array.isArray(item.options) ? item.options : ['A) —', 'B) —', 'C) —', 'D) —'],
      correctAnswer: item.correctAnswer || 'A',
      explanation: item.explanation || 'No explanation provided.',
    };
  });

  console.log(`[intelligenceService] Quiz generated: ${validatedQuiz.length} question(s).`);

  return {
    quiz: validatedQuiz,
    chunkCount: chunks.length,
  };
}

// ─── Flashcard Generation ───────────────────────────────────────────────────────

/**
 * Generates flashcards based on the document's content.
 *
 * @param {number} documentId - Primary key of the document.
 * @param {number} cardCount  - Number of flashcards to generate (default 10).
 * @returns {Promise<{ flashcards: Array, chunkCount: number }>}
 */
async function generateFlashcards(documentId, cardCount = 10) {
  console.log(`[intelligenceService] Starting flashcard generation for document ${documentId} (${cardCount} cards)…`);

  const chunks = await getDocumentChunks(documentId);
  console.log(`[intelligenceService] Retrieved ${chunks.length} chunk(s).`);

  const documentText = chunks
    .map((text, idx) => `[Section ${idx + 1}]\n${text.trim()}`)
    .join('\n\n---\n\n');

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: CHAT_MODEL,
    temperature: 0.4,
    maxOutputTokens: 2048,
  });

  const prompt = await FLASHCARD_TEMPLATE.format({
    documentText,
    cardCount: String(cardCount),
  });

  console.log(`[intelligenceService] Calling Gemini for flashcard generation…`);
  const response = await model.invoke([new HumanMessage(prompt)]);
  const rawOutput = response.content?.trim() ?? '';

  let cleanedOutput = rawOutput;
  const jsonFenceMatch = cleanedOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonFenceMatch) {
    cleanedOutput = jsonFenceMatch[1].trim();
  }

  let flashcards;
  try {
    flashcards = JSON.parse(cleanedOutput);
  } catch (parseError) {
    console.error('[intelligenceService] Failed to parse flashcard JSON:', parseError.message);
    throw new Error('The AI returned an invalid flashcard format.');
  }

  if (!Array.isArray(flashcards)) {
    throw new Error('Flashcard response is not a JSON array.');
  }

  const validatedCards = flashcards.map((item, idx) => ({
    front: item.front || `Card ${idx + 1} Front`,
    back: item.back || `Card ${idx + 1} Back`,
  }));

  console.log(`[intelligenceService] Flashcards generated: ${validatedCards.length} card(s).`);

  return {
    flashcards: validatedCards,
    chunkCount: chunks.length,
  };
}

// ─── AI Rewrite ─────────────────────────────────────────────────────────────────

/**
 * Rewrites a given text according to a specified style.
 *
 * @param {string} text - The original text to rewrite.
 * @param {string} style - The target style (e.g., 'Professional', 'Simple', 'Notes', 'Formal').
 * @returns {Promise<string>} The rewritten text.
 */
async function rewriteText(text, style) {
  console.log(`[intelligenceService] Rewriting text (length: ${text.length}, style: ${style})…`);

  const stylePrompts = {
    'Professional': 'Rewrite the text to be professional, polished, and suitable for a business setting.',
    'Simple': 'Rewrite the text to be simple and easy to understand. Avoid jargon and use plain language.',
    'Notes': 'Rewrite the text as concise bullet points capturing the main ideas.',
    'Formal': 'Rewrite the text using highly formal, academic, or official language.'
  };

  const styleInstruction = stylePrompts[style] || stylePrompts['Professional'];

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: CHAT_MODEL,
    temperature: 0.3, // Lower temperature for rewriting to stay close to original meaning
    maxOutputTokens: 2048,
  });

  const prompt = await REWRITE_TEMPLATE.format({
    style: styleInstruction,
    originalText: text
  });

  const response = await model.invoke([new HumanMessage(prompt)]);
  const rewritten = response.content?.trim() ?? '';

  return rewritten;
}

export { generateSummary, generateQuiz, generateFlashcards, rewriteText };
