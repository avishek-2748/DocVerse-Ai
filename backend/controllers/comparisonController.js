import { compareDocumentVersions } from '../services/comparisonService.js';

/**
 * POST /api/comparison/compare
 *
 * Compares two documents based on their IDs and returns a structured
 * JSON report detailing additions, deletions, and modifications.
 *
 * Request body:
 *   {
 *     "documentIdA": 1,
 *     "documentIdB": 2
 *   }
 *
 * Success response (200):
 *   {
 *     "success": true,
 *     "comparison": {
 *       "summaryOfChanges": "...",
 *       "additions": [...],
 *       "deletions": [...],
 *       "modifications": [...]
 *     },
 *     "metadata": { "documentIdA": 1, "documentIdB": 2 }
 *   }
 */
async function compareVersions(req, res) {
  const { documentIdA, documentIdB } = req.body;

  // Validate inputs
  if (!documentIdA || !documentIdB) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: documentIdA and documentIdB must both be provided.',
    });
  }

  const parsedIdA = parseInt(documentIdA, 10);
  const parsedIdB = parseInt(documentIdB, 10);

  if (isNaN(parsedIdA) || parsedIdA <= 0 || isNaN(parsedIdB) || parsedIdB <= 0) {
    return res.status(400).json({
      success: false,
      message: 'documentIdA and documentIdB must be positive integers.',
    });
  }
  
  if (parsedIdA === parsedIdB) {
     return res.status(400).json({
      success: false,
      message: 'documentIdA and documentIdB must be different.',
    });
  }

  try {
    console.log(`[comparisonController] compareVersions — A=${parsedIdA}, B=${parsedIdB}`);

    const comparisonReport = await compareDocumentVersions(parsedIdA, parsedIdB);

    return res.status(200).json({
      success: true,
      comparison: comparisonReport,
      metadata: {
        documentIdA: parsedIdA,
        documentIdB: parsedIdB,
      },
    });
  } catch (error) {
    console.error('[comparisonController] compareVersions error:', error);

    return res.status(500).json({
      success: false,
      message: 'An error occurred while comparing the documents.',
      error: error.message,
    });
  }
}

export { compareVersions };
