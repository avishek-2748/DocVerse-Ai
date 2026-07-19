# DocVerse AI — Developer Handoff Document

> **Purpose**: This file is the authoritative context document for any AI assistant or developer picking up this project. Read this fully before touching any code.

---

## Project Overview

**DocVerse AI** is an AI-powered document intelligence platform. Users upload PDF documents which are OCR-processed, chunked, embedded using OpenAI's embedding model, and stored in a pgvector-enabled PostgreSQL database. Users can then **chat with their documents** via a streaming RAG pipeline.

### Core Architecture
| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 3 |
| Backend | Node.js (ES Modules) + Express 4 |
| Database | PostgreSQL 16 + pgvector (Docker) |
| AI / RAG | LangChain.js + OpenAI API (`@langchain/openai`) |
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
│   │   └── documentRoutes.js      ← POST /api/documents/upload
│   ├── controllers/
│   │   └── documentController.js  ← Upload lifecycle: insert → extract → update status
│   ├── services/
│   │   └── documentService.js     ← pdf-parse wrapper + scanned doc detection
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
OPENAI_API_KEY=your-api-key-here
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

-- 3. Text chunks + OpenAI embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id            SERIAL PRIMARY KEY,
  document_id   INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text    TEXT NOT NULL,
  embedding     VECTOR(1536)
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
- [x] **Step 2** — Database setup (PostgreSQL pool config, `documents` + `document_chunks` tables, HNSW index on `VECTOR(1536)` column, schema verified and live)
- [x] **Step 3** — Document Upload API (multer middleware, pdf-parse service with scanned-doc detection, controller with full error/status lifecycle, route mounted at `/api/documents/upload`)

---

## Next Steps to Build (Step 3 onwards)

The following features need to be built **in order**. Each step is independent but depends on the previous layer.

### Step 4 — Text Chunking & Embedding Pipeline (NEXT)
**Goal**: Accept PDF uploads via a REST endpoint, extract raw text, store metadata in the DB.

Files to create:
- `backend/routes/documents.js` — POST `/api/documents/upload`
- `backend/controllers/documentController.js` — Handles multer, calls pdf-parse, writes to DB
- `backend/services/pdfService.js` — Wraps pdf-parse for text extraction

Logic:
1. Accept `multipart/form-data` upload via `multer` (store in `/uploads`).
2. Extract text using `pdf-parse`.
3. Insert a row into `documents` table (`filename`, `status: 'processing'`).
4. Return the `document_id` to the client.
5. Register the route in `server.js`: `app.use('/api/documents', documentsRouter)`.

### Step 4 — Text Chunking & Embedding Pipeline
**Goal**: Split extracted text into overlapping chunks, call OpenAI Embeddings API, store vectors in `document_chunks`.

Files to create:
- `backend/services/chunkingService.js` — Splits text into chunks (e.g., 500 tokens, 50 token overlap)
- `backend/services/embeddingService.js` — Calls `OpenAIEmbeddings` from `@langchain/openai`, returns `VECTOR(1536)` arrays
- `backend/services/ingestionService.js` — Orchestrates: chunk → embed → insert into `document_chunks` → update `documents.status` to `'ready'`

Call `ingestionService` from `documentController` after PDF parsing (can be async/background).

### Step 5 — RAG Chat API (Streaming)
**Goal**: Accept a user question, perform cosine similarity vector search, retrieve top-k chunks, send to OpenAI Chat with context, stream the response.

Files to create:
- `backend/routes/chat.js` — POST `/api/chat`
- `backend/controllers/chatController.js` — Orchestrates vector search + LLM call
- `backend/services/ragService.js` — LangChain `ConversationalRetrievalQAChain` or manual retrieval + `ChatOpenAI` with streaming

Key SQL for vector search:
```sql
SELECT chunk_text, 1 - (embedding <=> $1::vector) AS similarity
FROM document_chunks
WHERE document_id = $2
ORDER BY similarity DESC
LIMIT 5;
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
| Vector dimensions | `VECTOR(1536)` | Matches `text-embedding-ada-002` / `text-embedding-3-small` output |
| Vector index type | HNSW (`vector_cosine_ops`) | Best recall/speed for semantic search |
| DB pool events | `pool.on('connect')` / `pool.on('error')` | Centralized DB event logging |
| Tailwind version | v3 (not v4) | Stable with PostCSS plugin pipeline |

---

## Known Issues / Watch-outs

1. **Port conflicts**: The AI assistant may start background Node processes during development. Always run `lsof -i :5000` to check for lingering processes before starting the backend.
2. **Docker DB**: The `docverse-db` container must be **running** before starting the backend. If the backend reports `password auth failed`, run `sudo docker start docverse-db`.
3. **OpenAI API Key**: The `.env` file currently has `OPENAI_API_KEY=your-api-key-here`. **This must be replaced** with a real key before Step 4 (embedding pipeline) can be tested.
4. **pdf-parse ESM warning**: `pdf-parse` is a CommonJS package. It works fine with ES Modules via dynamic import or `createRequire` if you hit import issues.

---

*Last updated: 2026-07-18 — Steps 1 & 2 complete. Steps 3–8 pending.*
