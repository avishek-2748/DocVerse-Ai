# DocVerse AI

DocVerse AI is an AI-Powered Document Intelligence Platform utilizing a React (Vite) frontend, Node.js (Express) backend, PostgreSQL with pgvector, and a LangChain RAG pipeline.

## Project Structure

```
DocVerse AI/
├── backend/            # Express API Server
│   ├── config/         # Connection pools (PostgreSQL/pgvector)
│   ├── controllers/    # Route controllers
│   ├── routes/         # API Endpoint definitions
│   ├── services/       # LangChain RAG Logic / PDF parsing
│   └── uploads/        # Staging path for uploaded PDFs
└── frontend/           # React SPA (Vite)
    ├── src/
    │   ├── components/ # Reusable UI components
    │   ├── hooks/      # Custom React hooks
    │   └── views/      # Page/View templates
    └── tailwind.config.js
```

## Docker Deployment (Recommended)

The easiest way to run DocVerse AI is using Docker Compose. This single command will build the frontend, backend, and spin up the PostgreSQL pgvector database automatically.

1. Create a `.env` file in the `/backend` directory containing your Gemini API key and a JWT secret:
   ```env
   OPENAI_API_KEY=your-api-key-here
   JWT_SECRET=your_super_secret_key
   ```
2. Run the platform from the root directory:
   ```bash
   docker-compose up --build -d
   ```

- **Frontend UI**: http://localhost
- **Backend API**: http://localhost:5000

---

## Local Development (Without Docker)

### 1. Install Dependencies
Run npm install in both the root directories:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `/backend` directory containing:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/docverse
OPENAI_API_KEY=your-api-key-here
```

### 3. Run the Servers

From the root directory, you can run both environments:

- **Start Backend API Server**:
  ```bash
  npm run backend
  ```
- **Start Frontend React Client**:
  ```bash
  npm run frontend
  ```

Once running, navigate to the frontend local server at `http://localhost:5173`.
