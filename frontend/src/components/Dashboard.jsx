import { useState, useRef, useEffect } from 'react';
import { uploadDocument } from '../services/api';

export default function Dashboard({
  activeDocument,
  setActiveDocument,
  messages,
  onSendMessage,
  chatLoading,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll chat to the bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const response = await uploadDocument(file);
      if (response.success && response.data) {
        setActiveDocument(response.data);
      } else {
        throw new Error(response.message || 'Failed to upload document');
      }
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'An error occurred during file upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || chatLoading || !activeDocument) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const suggestedQuestions = [
    'What is the main topic of this document?',
    'Summarize this document in 3 bullet points.',
    'Are there any key action items or deadlines mentioned?',
  ];

  return (
    <div className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6 overflow-hidden h-[calc(100vh-130px)] min-h-[500px]">
      {/* ─── LEFT PANEL: DOCUMENT MANAGEMENT ─── */}
      <div className="w-full md:w-5/12 flex flex-col gap-6 h-full overflow-y-auto pr-0 md:pr-2">
        {/* Upload Container */}
        <div className="glass rounded-3xl p-6 shadow-xl flex flex-col">
          <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span>Document Ingestion</span>
          </h2>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 relative ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />

            {uploading ? (
              <div className="flex flex-col items-center space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                  <svg
                    className="w-6 h-6 text-indigo-400 absolute"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-indigo-400 font-semibold text-sm animate-pulse">
                    Uploading & Vectorizing...
                  </p>
                  <p className="text-xs text-slate-500">
                    Chunking text and storing vectors
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-slate-950/80 flex items-center justify-center text-slate-400 border border-slate-900 group-hover:scale-105 transition-transform">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <button
                    onClick={onButtonClick}
                    className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Click to upload
                  </button>
                  <span className="text-sm text-slate-400"> or drag and drop</span>
                  <p className="text-xs text-slate-500 mt-1">PDF files only (Max 50MB)</p>
                </div>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mt-4 p-3.5 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-start space-x-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Active Document Details */}
        {activeDocument ? (
          <div className="glass rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold flex items-center justify-between border-b border-slate-900 pb-3">
              <span>Active Document</span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/50 rounded-full">
                Ready
              </span>
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-900/40">
                <span className="text-slate-500">Filename</span>
                <span className="text-slate-200 font-medium truncate max-w-[200px]" title={activeDocument.filename}>
                  {activeDocument.filename}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/40">
                <span className="text-slate-500">File Size</span>
                <span className="text-slate-200">{formatBytes(activeDocument.file_size_bytes)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/40">
                <span className="text-slate-500">Pages Detected</span>
                <span className="text-slate-200">{activeDocument.page_count}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-900/40">
                <span className="text-slate-500">Vector Chunks</span>
                <span className="text-slate-200">{activeDocument.chunk_count}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Document ID</span>
                <span className="text-slate-200 font-mono text-xs">{activeDocument.document_id}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-6 shadow-xl text-center py-12 flex flex-col items-center justify-center text-slate-500">
            <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium">No active document</p>
            <p className="text-xs text-slate-600 mt-1">Upload a PDF file to begin asking queries.</p>
          </div>
        )}
      </div>

      {/* ─── RIGHT PANEL: INTERACTIVE AI CHAT ─── */}
      <div className="flex-grow w-full md:w-7/12 glass rounded-3xl shadow-xl flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-slate-900 flex items-center justify-between bg-slate-950/20">
          <div className="flex items-center space-x-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">Interactive Document AI</h3>
              <p className="text-xs text-slate-500">Gemini-backed context query engine</p>
            </div>
          </div>
        </div>

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
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md leading-relaxed whitespace-pre-wrap ${
                      message.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-900 text-slate-200 border border-slate-900 rounded-bl-none'
                    }`}
                  >
                    {message.text}
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
        <form onSubmit={handleSend} className="p-4 border-t border-slate-900 bg-slate-950/20 flex gap-3">
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
    </div>
  );
}
