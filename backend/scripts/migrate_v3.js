import pool from '../config/db.js';

async function migrate() {
  const client = await pool.connect();
  console.log('[migrate_v3] Connected. Starting migration…');

  try {
    console.log('[migrate_v3] Adding progress_percent, progress_stage, and summary columns to documents table (if absent)…');
    await client.query(`
      ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS progress_stage VARCHAR(100) DEFAULT 'queued',
      ADD COLUMN IF NOT EXISTS summary TEXT;
    `);

    console.log('[migrate_v3] Migration completed successfully.');
  } catch (error) {
    console.error('[migrate_v3] Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('[migrate_v3] Connection pool closed.');
  }
}

migrate();
