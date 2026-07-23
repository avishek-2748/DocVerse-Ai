import pool from '../config/db.js';

async function initDB() {
  console.log('Starting database schema initialization...');
  
  const client = await pool.connect();
  
  try {
    // 1. Enable pgvector extension
    console.log('Enabling vector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    // 2. Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        storage_quota_bytes BIGINT DEFAULT 1073741824
      );
    `);

    // 3. Create documents table (with user tracking and processing progress columns)
    console.log('Creating documents table...');
    await client.query(`
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
    `);
    
    // 4. Create document_chunks table
    console.log('Creating document_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_text TEXT NOT NULL,
        embedding VECTOR(768)
      );
    `);
    
    // 5. Create HNSW index for cosine distance vector search
    console.log('Creating HNSW index on document_chunks(embedding)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
      ON document_chunks USING hnsw (embedding vector_cosine_ops);
    `);

    // 6. Create conversations table
    console.log('Creating conversations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'ai')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log('Database initialization completed successfully.');
  } catch (error) {
    console.error('Error during database schema initialization:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection pool closed.');
  }
}

initDB();
