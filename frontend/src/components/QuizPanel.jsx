import { useState, useEffect } from 'react';
import { getQuiz } from '../services/api';

export default function QuizPanel({ activeDocument }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    setQuiz(null);
    setError(null);
    setUserAnswers({});
    setShowResults(false);
  }, [activeDocument]);

  const fetchQuiz = async () => {
    if (!activeDocument) return;
    setLoading(true);
    setError(null);
    setShowResults(false);
    setUserAnswers({});
    try {
      const data = await getQuiz(activeDocument.document_id, 5);
      if (data.success) {
        setQuiz(data.quiz);
      } else {
        throw new Error(data.message || 'Failed to generate quiz');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while generating the quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (qIndex, optionIndex) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
  };

  const letterToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

  const calculateScore = () => {
    let score = 0;
    quiz.forEach((q, idx) => {
      const correctIdx = letterToIndex[q.correctAnswer?.charAt(0)] ?? 0;
      if (userAnswers[idx] === correctIdx) score++;
    });
    return score;
  };

  if (!activeDocument) {
    return (
      <div className="flex-grow flex items-center justify-center text-slate-500">
        <p>Please upload a document to generate a quiz.</p>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-200">Interactive Quiz</h3>
          <p className="text-xs text-slate-500">Test your knowledge on this document</p>
        </div>
        {!loading && (
          <button
            onClick={fetchQuiz}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-all"
          >
            {quiz ? 'Regenerate Quiz' : 'Generate Quiz'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center flex-grow space-y-4">
          <div className="h-12 w-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <p className="text-indigo-400 font-semibold text-sm animate-pulse">Crafting questions...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-sm text-red-400">
          {error}
        </div>
      ) : quiz ? (
        <div className="space-y-8">
          {quiz.map((q, qIndex) => (
            <div key={qIndex} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <p className="font-semibold text-slate-200 mb-4">{qIndex + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((option, oIndex) => {
                  const isSelected = userAnswers[qIndex] === oIndex;
                  const correctIdx = letterToIndex[q.correctAnswer?.charAt(0)] ?? 0;
                  const isCorrect = correctIdx === oIndex;
                  
                  let btnClass = "w-full text-left p-3 rounded-xl border text-sm transition-all ";
                  if (!showResults) {
                    btnClass += isSelected 
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" 
                      : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300";
                  } else {
                    if (isCorrect) {
                      btnClass += "border-emerald-500 bg-emerald-500/20 text-emerald-400";
                    } else if (isSelected && !isCorrect) {
                      btnClass += "border-red-500 bg-red-500/20 text-red-400";
                    } else {
                      btnClass += "border-slate-800 bg-slate-900/50 text-slate-500 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={oIndex}
                      disabled={showResults}
                      onClick={() => handleOptionSelect(qIndex, oIndex)}
                      className={btnClass}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {showResults && (
                <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Explanation:</span> {q.explanation}
                </div>
              )}
            </div>
          ))}

          {!showResults ? (
            <button
              onClick={() => setShowResults(true)}
              disabled={Object.keys(userAnswers).length < quiz.length}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
            >
              Submit Answers
            </button>
          ) : (
            <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-2xl p-6 text-center">
              <h4 className="text-xl font-bold text-indigo-300 mb-2">Quiz Completed!</h4>
              <p className="text-2xl font-black text-white">Score: {calculateScore()} / {quiz.length}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center text-slate-500">
          <p>Click "Generate Quiz" to begin.</p>
        </div>
      )}
    </div>
  );
}
