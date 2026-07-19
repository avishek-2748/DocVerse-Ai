import jwt from 'jsonwebtoken';

/**
 * Middleware to verify a JWT token in the Authorization header.
 * If valid, the decoded user payload is attached to req.user.
 * If invalid or missing, returns 401 Unauthorized.
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  // Expecting format "Bearer <token>"
  const tokenParts = authHeader.split(' ');
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token format.',
    });
  }

  const token = tokenParts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains { id: ... } from the token signing
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid or expired token.',
    });
  }
}

/**
 * Middleware to verify that the requested document belongs to the authenticated user.
 * Assumes documentId is present in req.params.documentId, req.body.documentId, req.body.documentIdA, or req.body.documentIdB.
 * Requires pool from db.js to query.
 */
import pool from '../config/db.js';

async function verifyDocumentOwnership(req, res, next) {
  const userId = req.user.id;
  
  // Extract all possible document IDs from the request
  const docIds = [];
  if (req.params.documentId) docIds.push(req.params.documentId);
  if (req.body.documentId) docIds.push(req.body.documentId);
  if (req.body.documentIdA) docIds.push(req.body.documentIdA);
  if (req.body.documentIdB) docIds.push(req.body.documentIdB);

  if (docIds.length === 0) {
    return next(); // No document IDs to verify
  }

  try {
    for (const docId of docIds) {
      const parsedId = parseInt(docId, 10);
      if (isNaN(parsedId)) continue;
      
      const result = await pool.query('SELECT user_id FROM documents WHERE id = $1', [parsedId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: `Document ${parsedId} not found.` });
      }
      
      if (result.rows[0].user_id !== userId && result.rows[0].user_id !== null) {
        // We allow null for backward compatibility if existing documents have no user
        return res.status(403).json({ success: false, message: `Access denied. Document ${parsedId} does not belong to you.` });
      }
    }
    next();
  } catch (error) {
    console.error('[verifyDocumentOwnership] error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error verifying document ownership.' });
  }
}

export { verifyToken, verifyDocumentOwnership };
