import { useState, useEffect, useCallback } from 'react';
import { getDocuments, deleteDocument, bulkDeleteDocuments, getStorageUsage } from '../services/api';

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit',
  });
};

export default function HistoryPanel({ activeDocument, onSelectDocument, refreshTrigger }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageData, setStorageData] = useState(null);

  // Bulk delete controls
  const [bulkStrategy, setBulkStrategy] = useState('oldest');
  const [bulkCount, setBulkCount] = useState(5);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, storageRes] = await Promise.all([
        getDocuments(),
        getStorageUsage().catch(() => null)
      ]);
      
      if (res.success) {
        setDocs(res.data || []);
      } else {
        throw new Error(res.message || 'API returned failure');
      }

      if (storageRes && storageRes.success) {
        setStorageData(storageRes.data);
      }
    } catch (err) {
      setError('Could not load document history. ' + (err.message || ''));
      console.error('[HistoryPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and whenever refreshTrigger changes
  useEffect(() => {
    fetchDocs();
  }, [fetchDocs, refreshTrigger]);

  const handleDelete = async (docId) => {
    setDeletingId(docId);
    try {
      await deleteDocument(docId);
      if (activeDocument?.document_id === docId) {
        onSelectDocument(null);
      }
      setDocs((prev) => prev.filter((d) => d.document_id !== docId));
    } catch (err) {
      setError(err.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async (strategy, count) => {
    setBulkLoading(true);
    setError(null);
    try {
      await bulkDeleteDocuments(strategy, count);
      onSelectDocument(null);
      await fetchDocs();
    } catch (err) {
      setError(err.message || 'Bulk delete failed.');
    } finally {
      setBulkLoading(false);
      setShowBulkConfirm(false);
      setDeleteAllConfirm(false);
    }
  };

  return (
    <div className="glass rounded-3xl shadow-xl flex flex-col h-full overflow-hidden">
      {/* Storage Meter */}
      {storageData && (
        <div className="px-5 py-3 border-b border-slate-900 bg-slate-950/20">
          <div className="flex justify-between items-end mb-1.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Storage Usage</span>
            <span className="text-xs font-medium text-slate-300">
              {formatBytes(storageData.used_bytes)} / {formatBytes(storageData.quota_bytes)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                storageData.pct > 85 ? 'bg-red-500' : storageData.pct > 60 ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(storageData.pct, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-900 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Document History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {loading ? 'Loading...' : `${docs.length} document${docs.length !== 1 ? 's' : ''} uploaded`}
          </p>
        </div>
        <button
          onClick={fetchDocs}
          disabled={loading}
          title="Refresh history"
          className="text-slate-500 hover:text-indigo-400 transition-colors p-1.5 rounded-lg hover:bg-slate-800/50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Document List */}
      <div className="flex-grow overflow-y-auto divide-y divide-slate-900/60">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-3">
            <div className="h-5 w-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-xs text-slate-500">Loading history...</span>
          </div>
        ) : error ? (
          <div className="mx-4 my-3 px-3 py-2 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-10 text-center text-slate-600 text-xs px-4 flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-slate-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            No documents yet. Upload a PDF to get started.
          </div>
        ) : (
          docs.map((doc) => {
            const isActive = activeDocument?.document_id === doc.document_id;
            const isDeleting = deletingId === doc.document_id;
            return (
              <div
                key={doc.document_id}
                className={`group flex items-center gap-2 px-4 py-3 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                    : 'hover:bg-slate-900/50 border-l-2 border-transparent'
                }`}
              >
                {/* Clickable area to switch active doc */}
                <button
                  className="flex-grow min-w-0 text-left"
                  onClick={() => onSelectDocument(doc)}
                  title={`Click to switch to: ${doc.filename}`}
                >
                  <p className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-300' : 'text-slate-300'}`}>
                    {doc.filename}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                    <span>{formatDate(doc.created_at)}</span>
                    {doc.file_size_bytes ? <><span>·</span><span>{formatBytes(doc.file_size_bytes)}</span></> : null}
                    {doc.chunk_count ? <><span>·</span><span>{doc.chunk_count} chunks</span></> : null}
                  </p>
                </button>

                {/* Active badge */}
                {isActive && (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold">
                    Active
                  </span>
                )}

                {/* Delete single button — visible on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(doc.document_id); }}
                  disabled={isDeleting || bulkLoading}
                  title="Delete this document"
                  className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                >
                  {isDeleting ? (
                    <div className="h-3.5 w-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Delete Controls — only shown when there are docs */}
      {!loading && !error && docs.length > 0 && (
        <div className="px-4 py-4 border-t border-slate-900 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulk Delete</p>

          {/* Oldest / Newest N */}
          <div className="flex items-center gap-2">
            <select
              value={bulkStrategy}
              onChange={(e) => setBulkStrategy(e.target.value)}
              className="text-xs bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-700"
            >
              <option value="oldest">Oldest</option>
              <option value="newest">Newest</option>
            </select>

            <input
              type="number"
              min={1}
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
              className="w-14 text-xs text-center bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-700"
            />

            <span className="text-xs text-slate-500">docs</span>

            <button
              onClick={() => setShowBulkConfirm(true)}
              disabled={bulkLoading}
              className="flex-grow text-xs font-semibold py-1.5 px-3 rounded-lg bg-red-950/40 text-red-400 border border-red-900/40 hover:bg-red-900/30 disabled:opacity-50 transition-all"
            >
              Delete
            </button>
          </div>

          {showBulkConfirm && (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-xs space-y-2">
              <p className="text-red-300">
                Delete the <strong>{bulkCount}</strong> {bulkStrategy} document{bulkCount > 1 ? 's' : ''}? This is permanent.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkDelete(bulkStrategy, bulkCount)}
                  disabled={bulkLoading}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all disabled:opacity-50"
                >
                  {bulkLoading ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowBulkConfirm(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete All */}
          {!deleteAllConfirm ? (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              disabled={bulkLoading}
              className="w-full text-xs font-semibold py-1.5 rounded-lg bg-slate-900/60 text-red-500 border border-red-900/30 hover:bg-red-950/30 disabled:opacity-50 transition-all"
            >
              ⚠ Delete All History
            </button>
          ) : (
            <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl text-xs space-y-2">
              <p className="text-red-300">
                Permanently delete <strong>all {docs.length}</strong> documents? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkDelete('all')}
                  disabled={bulkLoading}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all disabled:opacity-50"
                >
                  {bulkLoading ? 'Deleting...' : 'Delete All'}
                </button>
                <button
                  onClick={() => setDeleteAllConfirm(false)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
