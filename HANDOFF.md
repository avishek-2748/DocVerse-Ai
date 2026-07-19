# DocVerse AI — Developer Handoff Document

> **Purpose**: This file is the authoritative context document for any AI assistant or developer picking up this project. Read this fully before touching any code.

---

## Project Overview

**DocVerse AI** is an AI-powered document intelligence platform. Users upload PDF documents which are parsed, chunked, embedded using the Gemini API, and stored in a pgvector-enabled PostgreSQL database. Users can then **chat with their documents** via a RAG (Retrieval-Augmented Generation) pipeline powered by Gemini.

### Core Architecture
| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 3 |
| Backend | Node.js (ES Modules) + Express 4 |
| Database | PostgreSQL 16 + pgvector (Docker) |
| AI / RAG | LangChain.js + Gemini API (`@langchain/google-genai`) |
| File Handling | Multer (upload) + pdf-parse (text extraction) |
| Infrastructure | Docker (DB), future: AWS |

---

## Monorepo Structure

```
DocVerse AI/                       ← Workspace root
├── HANDOFF.md                     ← THIS FILE
├── README.md
├── package.json                   ← Root scripts (npm run backend / npm run frontend)
├── .gitignore
│
├── backend/                       ← Express API server (ES Modules, "type":"module")
│   ├── server.js                  ← Entry point. Express setup, CORS, /api/health
│   ├── .env                       ← Environment variables (NOT committed to git)
│   ├── .gitignore
│   ├── package.json
│   ├── config/
│   │   └── db.js                  ← pg Pool, loads .env using absolute path
│   ├── scripts/
│   │   └── initDB.js              ← One-time schema setup script (run manually)
│   ├── middleware/
│   │   └── upload.js              ← Multer config: PDF-only, 50MB limit, auto-creates /uploads
│   ├── routes/
│   │   ├── documentRoutes.js      ← POST /api/documents/upload
│   │   └── chatRoutes.js          ← POST /api/chat/ask
│   ├── controllers/
│   │   ├── documentController.js  ← Upload lifecycle: insert → extract → embed → complete
│   │   └── chatController.js      ← Validates body, delegates to chatService, returns JSON
│   ├── services/
│   │   ├── documentService.js     ← pdf-parse + CustomGoogleGenerativeAIEmbeddings pipeline
│   │   └── chatService.js         ← RAG: embed query → pgvector search → Gemini LLM answer
│   └── uploads/                   ← Temp dir for multer (files deleted after processing)
│
└── frontend/                      ← React + Vite SPA
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js         ← Content paths configured for ./src/**
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx               ← App entry point
        ├── index.css              ← Tailwind directives + premium dark theme
        ├── App.jsx                ← Health-check dashboard (fetches /api/health)
        ├── components/            ← (EMPTY — ready for UI components)
        ├── views/                 ← (EMPTY — ready for page views)
        └── hooks/                 ← (EMPTY — ready for custom hooks)
```

---

## Environment Configuration

The file `backend/.env` contains all environment variables. **DO NOT commit it.**

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=docverse
DB_PASSWORD=postgres
DB_PORT=5432
GEMINI_API_KEY=your-gemini-api-key-here
```

> **Critical Note**: Both `config/db.js` and `server.js` use `import.meta.url` + `fileURLToPath` to resolve the `.env` path as an **absolute path**. This is intentional — it ensures environment variables load correctly whether the script is run from the project root (`node backend/scripts/initDB.js`) or from inside `/backend`.

---

## Database State

**Container**: Docker image `pgvector/pgvector:pg16`, named `docverse-db`

```bash
# Start the container (if not running):
sudo docker start docverse-db

# Verify it is up:
sudo docker ps
```

**Initialized Schema** (already applied — DO NOT re-run initDB.js unless rebuilding):

```sql
-- 1. pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Document metadata tracker
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  upload_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status        VARCHAR(50) DEFAULT 'pending'
);

-- 3. Text chunks + Gemini embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id            SERIAL PRIMARY KEY,
  document_id   INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  chunk_text    TEXT NOT NULL,
  embedding     VECTOR(768)
);

-- 4. HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
ON document_chunks USING hnsw (embedding vector_cosine_ops);
```

---

## Running the Project

From the **workspace root**:

```bash
# Terminal 1 — Start the Express API server (port 5000)
npm run backend

# Terminal 2 — Start the Vite frontend dev server (port 5173)
npm run frontend
```

**Expected backend startup output (when DB is running):**
```
Server running on port 5000
Database connected successfully.
Database pool is active and ready to accept queries.
```

**Health check endpoint:**
```bash
curl http://localhost:5000/api/health
# → { "status": "ok", "message": "Server is healthy and connected to database", "timestamp": "..." }
```

---

## Completed Steps

- [x] **Step 1** — Monorepo boilerplate (frontend + backend directories, root scripts, Vite/Tailwind setup, base Express server, health-check UI)
- [x] **Step 2** — Database setup (PostgreSQL pool config, `documents` + `document_chunks` tables, HNSW index, schema verified and live)
- [x] **Step 3** — Document Upload API (multer middleware, pdf-parse service with scanned-doc detection, controller with full error/status lifecycle, route at `/api/documents/upload`)
- [x] **Step 4** — Text Chunking & Embedding Pipeline (`RecursiveCharacterTextSplitter` 1000/200, `CustomGoogleGenerativeAIEmbeddings` subclass with `outputDimensionality=768`, model `gemini-embedding-001`, stored in `document_chunks`)
- [x] **Step 5** — RAG Chat API (`chatService.js` embeds query → pgvector cosine search top-5 → strict grounded prompt → `gemini-3.1-flash-lite` answer; route at `POST /api/chat/ask`)

---

## Next Steps to Build (Step 6 onwards)

The following features need to be built **in order**. Each step is independent but depends on the previous layer.

### ✅ Step 5 — RAG Chat API — **COMPLETE**

Live endpoint:
```bash
curl -s -X POST http://localhost:5000/api/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"documentId": 7, "query": "What is this document about?"}'
```
Returns:
```json
{
  "success": true,
  "answer": "This document is an email notification regarding the Account Activation Status...",
  "metadata": { "documentId": 7, "chunksRetrieved": 4, "topSimilarity": 0.5051 }
}
```

### Step 6 — Frontend Feature Build-out
**Goal**: Replace the placeholder health-check UI with the real application interface.

Views to create inside `frontend/src/views/`:
- `UploadView.jsx` — Drag-and-drop PDF upload form, progress indicator
- `ChatView.jsx` — Chat window with streaming text display, document selector
- `DocumentsView.jsx` — List of uploaded documents with status badges

Components to create inside `frontend/src/components/`:
- `DocumentCard.jsx`
- `ChatMessage.jsx`
- `UploadDropzone.jsx`
- `StreamingResponse.jsx`

Add client-side routing with `react-router-dom`.

### Step 7 — Document Intelligence Features
**Goal**: Auto-generate summaries, quizzes, and comparative reports from documents.

- `backend/routes/intelligence.js` — POST `/api/intelligence/summarize`, `/quiz`, `/compare`
- `backend/services/intelligenceService.js` — Separate LangChain chain per feature

### Step 8 — Dockerization & Production Config
**Goal**: Add `Dockerfile` for the backend, `docker-compose.yml` for orchestrating the full stack (backend + frontend + db), configure for AWS deployment.

---

## Key Technical Decisions Already Made

| Decision | Choice | Reason |
|---|---|---|
| Module system | ES Modules (`"type":"module"`) | Future-proof, clean imports |
| `.env` path resolution | Absolute via `import.meta.url` | Works from any CWD |
| Embedding model | `gemini-embedding-001` via `CustomGoogleGenerativeAIEmbeddings` | Only embedding model available to `AQ.` keys |
| Vector dimensions | `VECTOR(768)` with `outputDimensionality: 768` (MRL) | HNSW hard limit is 2000 dims; 768 is efficient & accurate |
| Vector index type | HNSW (`vector_cosine_ops`) | Best recall/speed for semantic search |
| Chat LLM | `gemini-3.1-flash-lite` | Only `generateContent` model confirmed working on this project's free tier |
| RAG top-k | 5 chunks | Balances context richness vs token budget |
| RAG prompt style | Strict system prompt with grounding rules | Prevents hallucination; answers from document only |
| DB pool events | `pool.on('connect')` / `pool.on('error')` | Centralized DB event logging |
| Tailwind version | v3 (not v4) | Stable with PostCSS plugin pipeline |

---

## Known Issues / Watch-outs

1. **Port conflicts**: Always run `lsof -i :5000` to check for lingering Node processes before starting the backend.
2. **Docker DB**: `docverse-db` container must be **running** before starting the backend. Run: `docker start docverse-db`.
3. **Gemini API Key format**: This project uses the newer `AQ.` key format (not `AIza...`). Keys must be created from [aistudio.google.com](https://aistudio.google.com/app/apikey).
4. **Model availability with `AQ.` keys**: Not all Gemini models are available on the free tier of this project:
   - ✅ `gemini-embedding-001` — Works for embeddings.
   - ✅ `gemini-3.1-flash-lite` — Works for chat generation.
   - ❌ `text-embedding-004`, `embedding-001` — 404 Not Found.
   - ❌ `gemini-2.0-flash`, `gemini-1.5-flash` — 429 Quota Exceeded (limit: 0).
5. **LangChain `outputDimensionality` limitation**: LangChain JS's `GoogleGenerativeAIEmbeddings` doesn't forward `outputDimensionality` to the SDK. We use `CustomGoogleGenerativeAIEmbeddings` (subclass overriding `_convertToContent`) defined in both `documentService.js` and `chatService.js`. **Both MUST use the same model and dimension** or the pgvector cosine search will throw a dimension mismatch error.
6. **HNSW dimension limit**: pgvector HNSW index supports a maximum of **2000 dimensions**. Gemini Embedding 2 / Embedding 001 default to 3072 dims — always pass `outputDimensionality: 768`.
7. **pdf-parse ESM**: `pdf-parse` is a CommonJS package. Use `createRequire(import.meta.url)` for ESM interop.

---

*Last updated: 2026-07-19 — Steps 1–5 complete. Steps 6–8 pending.*
