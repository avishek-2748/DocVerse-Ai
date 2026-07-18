import pool from '../config/db.js';

async function initDB() {
  console.log('Starting database schema initialization...');
  
  // Get a client from the pool to run everything in a transaction if needed,
  // or just run queries sequentially.
  const client = await pool.connect();
  
  try {
    // 1. Enable pgvector extension
    console.log('Enabling vector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    // 2. Create documents table
    console.log('Creating documents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'pending'
      );
    `);
    
    // 3. Create document_chunks table
    console.log('Creating document_chunks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        embedding VECTOR(1536)
      );
    `);
    
    // 4. Create HNSW index for cosine distance vector search
    console.log('Creating HNSW index on document_chunks(embedding)...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
      ON document_chunks USING hnsw (embedding vector_cosine_ops);
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
