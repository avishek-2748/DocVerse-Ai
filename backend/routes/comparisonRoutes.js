import { Router } from 'express';
import { compareVersions } from '../controllers/comparisonController.js';

const router = Router();

/**
 * POST /api/comparison/compare
 *
 * Compares two documents based on their IDs and returns a structured
 * JSON report of the differences.
 */
router.post('/compare', compareVersions);

export default router;
