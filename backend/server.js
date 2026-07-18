import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173', // Frontend dev server default URL
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple health check route
app.get('/api/health', async (req, res) => {
  try {
    // Optional check: verify if DB is responsive
    const dbCheck = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'ok',
      message: 'Server is healthy and connected to database',
      timestamp: dbCheck.rows[0].now
    });
  } catch (error) {
    console.error('Health check database error:', error);
    // Even if db is down, return server health status but indicate DB is down
    res.status(500).json({
      status: 'error',
      message: 'Server is running, but database connection failed',
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    // Test the database connection pool on startup
    await pool.query('SELECT 1');
    console.log('Database pool is active and ready to accept queries.');
  } catch (error) {
    console.error('Database connection failed on server startup:', error.message);
  }
});
