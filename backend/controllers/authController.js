import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * POST /api/auth/register
 *
 * Registers a new user with an email and a securely hashed password.
 */
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required.',
    });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into database
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, passwordHash]
    );

    const user = result.rows[0];

    // Optionally generate token on registration to auto-login
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('[authController] register error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration.',
      error: error.message,
    });
  }
}

/**
 * POST /api/auth/login
 *
 * Authenticates a user by email and password, returning a JWT token upon success.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  try {
    // Find user by email
    const result = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const user = result.rows[0];

    // Compare password hashes
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Sign JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '24h',
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error('[authController] login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login.',
      error: error.message,
    });
  }
}

export { register, login };
