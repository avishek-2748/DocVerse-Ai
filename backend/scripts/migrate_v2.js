/**
 * Migration: v2 — Add chunk_index to document_chunks and correct vector dimension
 *
 * Run this ONCE against your existing database if you initialised it with
 * the previous schema (VECTOR(1536), no chunk_index column).
 *
 * Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS guards.
 *
 * Usage:
 *   node backend/scripts/migrate_v2.js
 */
import pool from '../config/db.js';

async function migrate() {
  const client = await pool.connect();
  console.log('[migrate_v2] Connected. Starting migration…');

  try {
    // 1. Add chunk_index column if it doesn't already exist
    console.log('[migrate_v2] Adding chunk_index column to document_chunks (if absent)…');
    await client.query(`
      ALTER TABLE document_chunks
      ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0;
    `);

    // 2. Drop the existing embedding column and re-create it with the correct
    //    dimension for Gemini text-embedding-004 (768 dims, not 1536).
    //    NOTE: This drops all previously stored embeddings.
    console.log('[migrate_v2] Dropping old 1536-dim embedding column…');
    await client.query(`
      ALTER TABLE document_chunks DROP COLUMN IF EXISTS embedding;
    `);

    console.log('[migrate_v2] Adding new 768-dim embedding column…');
    await client.query(`
      ALTER TABLE document_chunks ADD COLUMN embedding VECTOR(768);
    `);

    // 3. Drop the old HNSW index (dimension mismatch would make it invalid)
    //    and recreate it for the new column.
    console.log('[migrate_v2] Recreating HNSW index for 768-dim embeddings…');
    await client.query(`
      DROP INDEX IF EXISTS document_chunks_embedding_hnsw_idx;
    `);
    await client.query(`
      CREATE INDEX document_chunks_embedding_hnsw_idx
      ON document_chunks USING hnsw (embedding vector_cosine_ops);
    `);

    console.log('[migrate_v2] Migration completed successfully.');
  } catch (error) {
    console.error('[migrate_v2] Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('[migrate_v2] Connection pool closed.');
  }
}

migrate();
