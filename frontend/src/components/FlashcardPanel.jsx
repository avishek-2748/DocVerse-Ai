import { useState, useEffect } from 'react';
import { getFlashcards } from '../services/api';

export default function FlashcardPanel({ activeDocument }) {
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardCount, setCardCount] = useState(10);

  useEffect(() => {
    setFlashcards([]);
    setError(null);
  }, [activeDocument]);

  const fetchFlashcards = async () => {
    if (!activeDocument) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFlashcards(activeDocument.document_id, cardCount);
      if (data.success) {
        // add a flipped state to each card object
        setFlashcards((data.flashcards || []).map(c => ({ ...c, isFlipped: false })));
      } else {
        throw new Error(data.message || 'Failed to generate flashcards');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while generating flashcards.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFlip = (index) => {
    setFlashcards(prev => prev.map((c, i) => i === index ? { ...c, isFlipped: !c.isFlipped } : c));
  };

  if (!activeDocument) {
    return (
      <div className="flex-grow flex items-center justify-center text-slate-500">
        <p>Please upload a document to generate flashcards.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 flex flex-col h-full">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-200">Flashcards</h3>
          <p className="text-xs text-slate-500">Study key concepts from the document</p>
        </div>
        {!loading && flashcards.length === 0 && (
          <div className="flex items-center gap-3">
            <select
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50"
            >
              <option value={5}>5 Cards</option>
              <option value={10}>10 Cards</option>
              <option value={15}>15 Cards</option>
              <option value={20}>20 Cards</option>
            </select>
            <button
              onClick={fetchFlashcards}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all"
            >
              Generate Cards
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-grow space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-semibold text-sm animate-pulse">Extracting concepts...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          {error}
        </div>
      ) : flashcards.length > 0 ? (
        <div className="flex-grow pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {flashcards.map((card, idx) => {
              // Assign a slight rotation and distinct vibrant colors based on index for a premium look
              const colors = [
                'from-indigo-600 to-purple-600',
                'from-emerald-500 to-teal-600',
                'from-rose-500 to-pink-600',
                'from-amber-500 to-orange-600',
                'from-blue-600 to-cyan-600'
              ];
              const colorClass = colors[idx % colors.length];

              return (
                <div 
                  key={idx}
                  className="w-full h-56 relative perspective-1000 cursor-pointer group"
                  onClick={() => toggleFlip(idx)}
                >
                  <div 
                    className={`w-full h-full absolute transition-transform duration-500 transform-style-3d shadow-xl rounded-2xl ${card.isFlipped ? 'rotate-y-180' : ''}`}
                  >
                    {/* Front */}
                    <div className="w-full h-full absolute backface-hidden bg-slate-900 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-lg group-hover:border-slate-500 transition-colors">
                      <div className="absolute top-4 left-4 bg-slate-800 text-slate-400 text-xs font-bold px-2 py-1 rounded-md">Q {idx + 1}</div>
                      <h4 className="text-lg font-bold text-slate-100">{card.front}</h4>
                      <span className="absolute bottom-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70 group-hover:text-indigo-400 transition-colors">Click to flip</span>
                    </div>
                    
                    {/* Back */}
                    <div className={`w-full h-full absolute backface-hidden rotate-y-180 bg-gradient-to-br ${colorClass} border border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center shadow-lg shadow-indigo-900/20`}>
                      <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">Answer</div>
                      <p className="text-base font-semibold text-white leading-relaxed">{card.back}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
