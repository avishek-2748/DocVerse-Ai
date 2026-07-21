import { useState } from 'react';
import { rewriteText } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

export default function RewritePanel() {
  const [inputText, setInputText] = useState('');
  const [style, setStyle] = useState('Professional');
  const [outputText, setOutputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const styles = ['Professional', 'Simple', 'Notes', 'Formal'];

  const handleRewrite = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setOutputText('');
    try {
      const data = await rewriteText(inputText, style);
      if (data.success) {
        setOutputText(data.rewritten);
      } else {
        throw new Error(data.message || 'Failed to rewrite text');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while rewriting text.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
    }
  };

  const handleExport = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rewritten_${style.toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-grow flex flex-col p-6 overflow-hidden h-full">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-200">AI Rewrite</h3>
        <p className="text-xs text-slate-500">Paste text to rewrite it in a different style</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-grow overflow-hidden">
        {/* Left Side: Input */}
        <div className="flex-1 flex flex-col h-full">
          <label className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Original Text</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste or type text here..."
            className="flex-grow bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 resize-none mb-4"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {styles.map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    style === s
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            
            <button
              onClick={handleRewrite}
              disabled={loading || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Rewriting...
                </>
              ) : (
                'Rewrite'
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Output */}
        <div className="flex-1 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rewritten Text</label>
            {outputText && (
              <div className="flex gap-2">
                <button onClick={handleCopy} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  Copy
                </button>
                <button onClick={handleExport} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Export
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-grow bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-sm text-slate-300 overflow-y-auto">
            {error ? (
              <div className="text-red-400">{error}</div>
            ) : outputText ? (
              <MarkdownRenderer text={outputText} />
            ) : (
              <span className="text-slate-600">The rewritten text will appear here...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
