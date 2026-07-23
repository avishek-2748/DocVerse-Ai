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
| Infrastructure | Docker (DB), AWS (production deployment target) |

### Team
| Name | Role |
|---|---|
| Avishek | Full-Stack Developer |
| Rimjhim | UI/UX Designer |

---

## Monorepo Structure

```
DocVerse AI/                       ← Workspace root
├── HANDOFF.md                     ← THIS FILE
├── README.md
├── package.json                   ← Root scripts (npm run backend / npm run frontend)
├── docker-compose.yml             ← Full stack orchestration (DB + backend + frontend)
├── .gitignore
│
├── backend/                       ← Express API server (ES Modules, "type":"module")
│   ├── Dockerfile                 ← Production Docker image (node:20-alpine)
│   ├── server.js                  ← Entry point. Express setup, CORS, /api/health
│   ├── .env                       ← Environment variables (NOT committed to git)
│   ├── .gitignore
│   ├── package.json
│   ├── config/
│   │   └── db.js                  ← pg Pool, loads .env using absolute path
│   ├── scripts/
│   │   ├── initDB.js              ← One-time schema setup: users, documents, chunks, conversations
│   │   ├── migrate_v2.js          ← Migration: adds chunk_index + fixes vector dimension to 768
│   │   └── migrate_v3.js          ← Migration: adds progress_percent, progress_stage, summary cols
│   ├── middleware/
│   │   ├── upload.js              ← Multer config: PDF-only, 50MB limit, auto-creates /uploads
│   │   └── authMiddleware.js      ← JWT verification & document ownership checks
│   ├── routes/
│   │   ├── authRoutes.js          ← POST /api/auth/register, /login
│   │   ├── documentRoutes.js      ← POST /api/documents/upload, GET, DELETE
│   │   ├── chatRoutes.js          ← POST /api/chat/ask
│   │   ├── intelligenceRoutes.js  ← GET /api/intelligence/summary/:id, /quiz/:id, /flashcards/:id
│   │   ├── comparisonRoutes.js    ← POST /api/comparison/compare
│   │   ├── conversationRoutes.js  ← GET/DELETE /api/conversations/:documentId
│   │   └── storageRoutes.js       ← GET /api/storage/usage
│   ├── controllers/
│   │   ├── authController.js          ← Registration & login logic (bcrypt + jsonwebtoken)
│   │   ├── documentController.js      ← Upload lifecycle: insert → extract → embed → complete
│   │   ├── chatController.js          ← Validates body, delegates to chatService, persists messages
│   │   ├── intelligenceController.js  ← getSummary, getQuiz, getFlashcards, rewriteText
│   │   ├── comparisonController.js    ← compareVersions coordinating two document comparisons
│   │   ├── conversationController.js  ← Get/clear conversation history per document
│   │   └── storageController.js       ← Get storage usage per user
│   ├── services/
│   │   ├── documentService.js     ← pdf-parse + CustomGoogleGenerativeAIEmbeddings pipeline
│   │   ├── chatService.js         ← RAG: embed query → pgvector search → Gemini LLM answer
│   │   ├── intelligenceService.js ← Map-Reduce summary + JSON quiz + flashcards + rewrite
│   │   └── comparisonService.js   ← Multi-Document JSON diffing service via LLM
│   └── uploads/                   ← Temp dir for multer (files deleted after processing)
│
└── frontend/                      ← React + Vite SPA
    ├── Dockerfile                 ← Multi-stage build: node build → nginx:alpine serve
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx               ← App entry point
        ├── index.css              ← Tailwind directives + premium dark theme + glassmorphism
        ├── App.jsx                ← Root layout: header, auth-gate, dashboard, sticky footer
        ├── services/
        │   └── api.js             ← Centralised API client (attaches JWT, wraps all endpoints)
        └── components/
            ├── AuthScreen.jsx     ← Login/Register form with JWT-based auth flow
            ├── Dashboard.jsx      ← Main layout: left panel + intelligence tabs + history sidebar
            ├── ChatPanel.jsx      ← RAG chat UI with message history, export, clear chat
            ├── SummaryPanel.jsx   ← AI summary with persistent caching + export
            ├── QuizPanel.jsx      ← AI-generated quiz with scoring
            ├── FlashcardPanel.jsx ← 3D flip flashcard deck with shuffle/navigation
            ├── RewritePanel.jsx   ← Multi-style text rewriter (Professional/Simple/Notes/Formal)
            ├── ComparePanel.jsx   ← Multi-document version comparison
            └── HistoryPanel.jsx   ← Document library with storage quota meter
```

---

## Environment Configuration

The file `backend/.env` contains all environment variables. **DO NOT commit it.**

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost        # Use 'db' when running inside Docker Compose
DB_NAME=docverse
DB_PASSWORD=postgrespassword
DB_PORT=5432
GEMINI_API_KEY=your-gemini-api-key-here
JWT_SECRET=your-jwt-secret-here
```

> **Critical Note**: Both `config/db.js` and `server.js` use `import.meta.url` + `fileURLToPath` to resolve the `.env` path as an **absolute path**. This is intentional — it ensures environment variables load correctly whether the script is run from the project root (`node backend/scripts/initDB.js`) or from inside `/backend`.

---

## Database State

**Container**: Docker image `ankane/pgvector:latest`, named `docverse-db`

```bash
# Start the container (if not running):
docker start docverse-db

# Verify it is up:
docker ps
```

**Full Schema** (applied via `node backend/scripts/initDB.js`):

```sql
-- 1. pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  storage_quota_bytes BIGINT DEFAULT 1073741824  -- 1 GB
);

-- 3. Document metadata tracker
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  page_count INTEGER DEFAULT 0,
  is_scanned BOOLEAN DEFAULT FALSE,
  chunk_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  progress_percent INTEGER DEFAULT 0,
  progress_stage VARCHAR(100) DEFAULT 'queued',
  summary TEXT,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Text chunks + Gemini embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768)
);

-- 5. HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 6. Persistent conversation/chat history
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Initialize Schema (Fresh Database)
```bash
# Run ONCE after starting the database container for the first time:
node backend/scripts/initDB.js
```

---

## Running the Project

### Local Development
```bash
# Terminal 1 — Start the database container
docker start docverse-db

# Terminal 2 — Start the Express API server (port 5000)
npm run backend

# Terminal 3 — Start the Vite frontend dev server (port 5173)
npm run frontend
```

### Docker Compose (Full Stack)
```bash
# Build and run all services: db + backend + frontend
docker compose up --build

# Or to run existing images in background:
docker compose up -d
```

> **Note**: `docker compose up --build` requires Docker Compose v2+ (the `docker compose` plugin, not the legacy `docker-compose` binary).

**Expected backend startup output (when DB is running):**
```
Server running on port 5000
Database connected successfully.
Database pool is active and ready to accept queries.
```

---

## Completed Steps

- [x] **Step 1** — Monorepo boilerplate (frontend + backend directories, root scripts, Vite/Tailwind setup, base Express server, health-check UI)
- [x] **Step 2** — Database setup (PostgreSQL pool config, `documents` + `document_chunks` tables, HNSW index, schema verified and live)
- [x] **Step 3** — Document Upload API (multer middleware, pdf-parse service with scanned-doc detection, controller with full error/status lifecycle, route at `/api/documents/upload`)
- [x] **Step 4** — Text Chunking & Embedding Pipeline (`RecursiveCharacterTextSplitter` 1000/200, `CustomGoogleGenerativeAIEmbeddings` subclass with `outputDimensionality=768`, model `gemini-embedding-001`, stored in `document_chunks`)
- [x] **Step 5** — RAG Chat API (`chatService.js` embeds query → pgvector cosine search top-5 → strict grounded prompt → `gemini-3.1-flash-lite` answer; route at `POST /api/chat/ask`)
- [x] **Step 6** — Frontend UI & Chat Component (split-screen drag-and-drop dashboard, reactive active doc info panel, chat message history scroll, interactive suggested questions, and connection failure fallback)
- [x] **Step 7** — Document Intelligence Features (Map-Reduce summarization + structured JSON quiz generation via `intelligenceService.js`; routes at `GET /api/intelligence/summary/:id` and `GET /api/intelligence/quiz/:id?count=N`)
- [x] **Step 8** — Multi-Document Version Comparison API (JSON document diffing and report generation via `comparisonService.js`; route at `POST /api/comparison/compare`)
- [x] **Step 9** — JWT Authentication (User registration, login, protected routes, and multi-tenant document scoping via `authMiddleware.js` and React `AuthScreen.jsx`)
- [x] **Step 10** — Docker Containerization (Backend `node:20-alpine` Dockerfile, Frontend multi-stage `nginx:alpine` Dockerfile, and `docker-compose.yml` for unified pgvector + node + nginx orchestration)
- [x] **Feature Expansion** — Persistent chat history (`conversations` table), 1GB storage quota system with visual meter, AI flashcard generator (3D flip cards), multi-style text rewriter, export functionality, and document history sidebar

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
| Intelligence LLM | `gemini-3.1-flash-lite` (same) | Reuses the same model |
| Summary strategy | Map-Reduce via `PromptTemplate` | Handles arbitrarily long documents without exceeding context window |
| Quiz/Flashcard output | Strict JSON prompt + markdown fence stripping + structural validation | Reliable JSON parsing even when model wraps output in ```json fences |
| RAG top-k | 5 chunks | Balances context richness vs token budget |
| DB pool events | `pool.on('connect')` / `pool.on('error')` | Centralized DB event logging |
| Tailwind version | v3 (not v4) | Stable with PostCSS plugin pipeline |
| Auth | JWT (jsonwebtoken + bcryptjs) | Stateless, scalable, no session storage needed |
| Storage quota | 1 GB per user, tracked via `SUM(file_size_bytes)` | Simple, performant, no extra service needed |

---

## Known Issues / Watch-outs

1. **Port conflicts**: Always run `lsof -i :5000` to check for lingering Node processes before starting the backend.
2. **Docker DB password**: The persistent volume was initialized with password `postgrespassword`. Changing `DB_PASSWORD` in `.env` without recreating the volume will cause auth failures.
3. **Gemini API Key format**: This project uses the newer `AQ.` key format (not `AIza...`). Keys must be created from [aistudio.google.com](https://aistudio.google.com/app/apikey).
4. **Model availability with `AQ.` keys**:
   - ✅ `gemini-embedding-001` — Works for embeddings.
   - ✅ `gemini-3.1-flash-lite` — Works for chat generation.
   - ❌ `text-embedding-004`, `embedding-001` — 404 Not Found.
   - ❌ `gemini-2.0-flash`, `gemini-1.5-flash` — 429 Quota Exceeded (limit: 0).
5. **LangChain `outputDimensionality` limitation**: LangChain JS's `GoogleGenerativeAIEmbeddings` doesn't forward `outputDimensionality` to the SDK. We use `CustomGoogleGenerativeAIEmbeddings` (subclass overriding `_convertToContent`) defined in both `documentService.js` and `chatService.js`. **Both MUST use the same model and dimension** or the pgvector cosine search will throw a dimension mismatch error.
6. **HNSW dimension limit**: pgvector HNSW index supports a maximum of **2000 dimensions**. Always pass `outputDimensionality: 768`.
7. **pdf-parse ESM**: `pdf-parse` is a CommonJS package. Use `createRequire(import.meta.url)` for ESM interop.
8. **Schema initialization**: The DB schema must be initialized manually on a fresh database container using `node backend/scripts/initDB.js`. This is safe to re-run — all statements use `IF NOT EXISTS`.
9. **Docker Compose version**: Use `docker compose` (v2 plugin), not `docker-compose` (legacy). The `--build` flag is supported in Compose v2.

---

*Last updated: 2026-07-24 — All Steps 1–10 + Feature Expansion complete. Project is GitHub-hosted and AWS-deployment-ready.*
