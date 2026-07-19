import { useState } from 'react';
import { compareDocuments } from '../services/api';

export default function ComparePanel({ activeDocument }) {
  const [docBId, setDocBId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!activeDocument || !docBId.trim()) return;
    
    const idB = parseInt(docBId.trim(), 10);
    if (isNaN(idB)) {
      setError("Please enter a valid numeric Document ID for comparison.");
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const data = await compareDocuments(activeDocument.document_id, idB);
      if (data.success) {
        setReport(data.comparison);
      } else {
        throw new Error(data.message || 'Comparison failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during comparison.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeDocument) {
    return (
      <div className="flex-grow flex items-center justify-center text-slate-500">
        <p>Please upload a base document to use the comparison tool.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 flex flex-col">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-200">Version Comparison</h3>
        <p className="text-xs text-slate-500">Compare the active document against another uploaded document.</p>
      </div>

      <form onSubmit={handleCompare} className="mb-6 flex gap-3">
        <input
          type="number"
          value={docBId}
          onChange={(e) => setDocBId(e.target.value)}
          placeholder="Enter Target Document ID (e.g. 10)"
          disabled={loading}
          className="flex-grow bg-slate-900/60 border border-slate-700 focus:border-indigo-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none transition-all"
        />
        <button
          type="submit"
          disabled={loading || !docBId}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-2">Summary of Changes</h4>
            <p className="text-sm text-slate-300 leading-relaxed">{report.summaryOfChanges}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-2xl p-5">
              <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                Additions
              </h4>
              <ul className="space-y-2">
                {report.additions.map((item, idx) => (
                  <li key={idx} className="text-sm text-emerald-200/80 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-emerald-500 before:rounded-full">{item}</li>
                ))}
                {report.additions.length === 0 && <li className="text-sm text-slate-500 italic">No additions detected.</li>}
              </ul>
            </div>

            <div className="bg-red-950/10 border border-red-900/30 rounded-2xl p-5">
              <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                Deletions
              </h4>
              <ul className="space-y-2">
                {report.deletions.map((item, idx) => (
                  <li key={idx} className="text-sm text-red-200/80 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-red-500 before:rounded-full line-through opacity-80">{item}</li>
                ))}
                {report.deletions.length === 0 && <li className="text-sm text-slate-500 italic">No deletions detected.</li>}
              </ul>
            </div>
          </div>

          <div className="bg-amber-950/10 border border-amber-900/30 rounded-2xl p-5">
            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-3">Modifications</h4>
            <div className="space-y-4">
              {report.modifications.map((mod, idx) => (
                <div key={idx} className="bg-slate-900/50 rounded-xl p-4 text-sm border border-slate-800/50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wide block mb-1">Original</span>
                      <span className="text-slate-400 line-through">{mod.original}</span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block mb-1">Updated</span>
                      <span className="text-slate-200">{mod.updated}</span>
                    </div>
                  </div>
                </div>
              ))}
              {report.modifications.length === 0 && <p className="text-sm text-slate-500 italic">No direct modifications detected.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
