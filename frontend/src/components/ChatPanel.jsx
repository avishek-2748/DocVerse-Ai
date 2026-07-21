import { useRef, useEffect, useState } from 'react';
import { clearConversations } from '../services/api';
import MarkdownRenderer from './MarkdownRenderer';

export default function ChatPanel({ activeDocument, messages, setMessages, onSendMessage, chatLoading }) {
  const chatEndRef = useRef(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || chatLoading || !activeDocument) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const suggestedQuestions = [
    'What is the main topic of this document?',
    'Summarize this document in 3 bullet points.',
    'Are there any key action items or deadlines mentioned?',
  ];

  const handleExport = () => {
    if (messages.length === 0) return;
    const text = messages.map(m => `${m.sender.toUpperCase()}:\n${m.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDocument?.filename || 'chat'}_history.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!activeDocument) return;
    if (window.confirm('Are you sure you want to clear the chat history for this document?')) {
      try {
        await clearConversations(activeDocument.document_id);
        setMessages([
          {
            sender: 'ai',
            text: `Hello! I have finished analyzing "${activeDocument.filename}". Ask me anything about its contents!`,
          },
        ]);
      } catch (err) {
        console.error('Failed to clear chat:', err);
      }
    }
  };

  return (
    <div className="flex-grow flex flex-col overflow-hidden h-full">
      {/* Header controls */}
      {messages.length > 1 && (
        <div className="px-6 py-2 border-b border-slate-900 bg-slate-950/40 flex justify-end gap-3">
          <button onClick={handleExport} className="text-xs font-semibold text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
          <button onClick={handleClear} className="text-xs font-semibold text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear
          </button>
        </div>
      )}

      {/* Messages Body */}
      <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-slate-950/10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center px-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/5 text-indigo-500/50 flex items-center justify-center mb-4 border border-indigo-500/10 animate-pulse">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="text-base font-bold text-slate-400">Ask your document questions</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6">
              Upload a document to enable queries. Questions will be answered using semantic similarity search.
            </p>

            {activeDocument && (
              <div className="w-full max-w-md space-y-2">
                <p className="text-xs font-semibold text-slate-500 text-left uppercase tracking-wider pl-1">Suggested Questions</p>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputValue(q);
                    }}
                    className="w-full text-left p-3 rounded-xl bg-slate-900/60 border border-slate-900 text-xs text-slate-300 hover:text-white hover:border-slate-800 transition-all text-ellipsis overflow-hidden whitespace-nowrap block"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed ${
                    message.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none whitespace-pre-wrap'
                      : 'bg-slate-900 text-slate-200 border border-slate-900 rounded-bl-none'
                  }`}
                >
                  {message.sender === 'user' ? (
                    message.text
                  ) : (
                    <MarkdownRenderer text={message.text} />
                  )}
                </div>
              </div>
            ))}

            {/* Chat Loading Skeleton */}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-900 text-slate-200 border border-slate-900 rounded-2xl rounded-bl-none px-4 py-3 max-w-[85%] space-y-2">
                  <div className="flex space-x-1.5 py-1 justify-center items-center">
                    <span className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input Footer */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-900 bg-slate-950/20 flex gap-3 mt-auto">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={!activeDocument || chatLoading}
          placeholder={
            activeDocument
              ? "Ask a question about the active document..."
              : "Please upload a document on the left panel to begin chatting..."
          }
          className="flex-grow bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-indigo-500/80 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        />
        <button
          type="submit"
          disabled={!activeDocument || !inputValue.trim() || chatLoading}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-5 py-3 text-sm transition-all flex items-center justify-center shrink-0 border border-indigo-500/10 shadow-lg shadow-indigo-600/15"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
}
