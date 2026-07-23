import { useState, useEffect } from 'react';
import { getSummary } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

export default function SummaryPanel({ activeDocument, setActiveDocument }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeDocument && activeDocument.summary) {
      setSummary(activeDocument.summary);
    } else {
      setSummary(null);
    }
    setError(null);
  }, [activeDocument]);

  const fetchSummary = async () => {
    if (!activeDocument) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSummary(activeDocument.document_id);
      if (data.success) {
        setSummary(data.summary);
        if (setActiveDocument) {
          setActiveDocument(prev => ({ ...prev, summary: data.summary }));
        }
      } else {
        throw new Error(data.message || 'Failed to generate summary');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while generating the summary.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDocument?.filename || 'document'}_summary.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeDocument) {
    return (
      <div className="flex-grow flex items-center justify-center text-slate-500">
        <p>Please upload a document to generate a summary.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-200">Document Summary</h3>
          <p className="text-xs text-slate-500">AI-generated overview of the entire document</p>
        </div>
        {!summary && !loading && (
          <button
            onClick={fetchSummary}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all"
          >
            Generate Summary
          </button>
        )}
        {summary && !loading && (
          <button
            onClick={handleExport}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-xl text-sm transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-grow space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="text-center">
            <p className="text-indigo-400 font-semibold text-sm animate-pulse mb-1">Reading and summarizing...</p>
            <p className="text-slate-500 text-xs">Estimated time: 1 - 2 minutes depending on document length</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          {error}
        </div>
      ) : summary ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <MarkdownRenderer text={summary} />
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center text-slate-500">
          <p>Click "Generate Summary" to begin.</p>
        </div>
      )}
    </div>
  );
}
