import pool from '../config/db.js';

const QUOTA_BYTES = 1073741824; // 1 GB default

/**
 * GET /api/storage/usage
 * Returns storage usage stats for the current user.
 */
async function getStorageUsage(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT 
         COALESCE(SUM(file_size_bytes), 0)::BIGINT AS used_bytes,
         u.storage_quota_bytes AS quota_bytes
       FROM users u
       LEFT JOIN documents d ON d.user_id = u.id AND d.status = 'completed'
       WHERE u.id = $1
       GROUP BY u.storage_quota_bytes`,
      [userId]
    );

    const row = result.rows[0] || { used_bytes: 0, quota_bytes: QUOTA_BYTES };
    const usedBytes = parseInt(row.used_bytes, 10);
    const quotaBytes = parseInt(row.quota_bytes, 10);
    const pct = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: { used_bytes: usedBytes, quota_bytes: quotaBytes, pct }
    });
  } catch (error) {
    console.error('[storageController] getStorageUsage error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve storage usage.', error: error.message });
  }
}

export { getStorageUsage };
