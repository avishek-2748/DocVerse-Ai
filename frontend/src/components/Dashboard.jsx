import { useState, useRef, useEffect } from 'react';
import { uploadDocument, getDocumentStatus } from '../services/api';
import ChatPanel from './ChatPanel';
import SummaryPanel from './SummaryPanel';
import QuizPanel from './QuizPanel';
import ComparePanel from './ComparePanel';
import FlashcardPanel from './FlashcardPanel';
import RewritePanel from './RewritePanel';
import HistoryPanel from './HistoryPanel';

export default function Dashboard({
  activeDocument,
  setActiveDocument,
  messages,
  setMessages,
  onSendMessage,
  chatLoading,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [enableOCR, setEnableOCR] = useState(false);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [showHistory, setShowHistory] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  
  // Progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingDocId, setProcessingDocId] = useState(null);
  const [backendProgress, setBackendProgress] = useState(null);

  // Increment to trigger HistoryPanel refresh
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleSelectFromHistory = (doc) => {
    setActiveDocument(doc);
    if (doc) setActiveTab('chat');
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const allowedExtensions = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.bmp', '.tiff'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setUploadError('Unsupported file type. Please upload PDF, DOCX, PNG, JPG, JPEG, BMP, or TIFF.');
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    setUploadProgress(0);
    setBackendProgress(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff'].includes(extension) && !enableOCR) {
      setUploadError('Image files require OCR to be enabled. Please toggle Enable OCR and try again.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setBackendProgress(null);

    try {
      // Use the XHR wrapper to get real transmission progress
      const response = await uploadDocument(selectedFile, enableOCR, (percent) => {
        setUploadProgress(percent);
      });

      if (response.success && response.data) {
        // Upload finished, backend accepted it for processing
        setUploading(false);
        setSelectedFile(null); // Clear file selection
        
        // Start polling for this document
        setProcessingDocId(response.data.document_id);
        setBackendProgress({
          percent: response.data.progress_percent || 0,
          stage: response.data.progress_stage || 'queued'
        });
        
        // Set it as active document immediately so it shows up in active card
        setActiveDocument(response.data);
        
        // Refresh history
        setHistoryRefreshKey(k => k + 1);
      } else {
        throw new Error(response.message || 'Failed to upload document');
      }
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'An error occurred during file upload.');
      setUploading(false);
    }
  };

  // Poll backend for processing status
  useEffect(() => {
    if (!processingDocId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await getDocumentStatus(processingDocId);
        if (res.success && res.data) {
          const { status, progress_percent, progress_stage, page_count, chunk_count, is_scanned } = res.data;
          
          setBackendProgress({ percent: progress_percent, stage: progress_stage });

          // Update activeDocument dynamically
          setActiveDocument(prev => {
            if (prev && prev.document_id === processingDocId) {
              return { ...prev, status, progress_percent, progress_stage, page_count, chunk_count, is_scanned };
            }
            return prev;
          });

          if (status === 'completed' || status === 'failed') {
            clearInterval(pollInterval);
            setProcessingDocId(null);
            if (status === 'completed') {
              setBackendProgress({ percent: 100, stage: 'completed' });
              setHistoryRefreshKey(k => k + 1);
            } else {
              setUploadError('Document processing failed: ' + progress_stage);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [processingDocId, setActiveDocument]);

  const onButtonClick = () => {
    if (!uploading && !processingDocId) {
      fileInputRef.current.click();
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const isProcessing = activeDocument?.status === 'processing';

  return (
    <div className="h-full w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row gap-4 overflow-hidden">
      
      {!isLeftPanelVisible && (
        <button
          onClick={() => setIsLeftPanelVisible(true)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-900 border border-slate-700 p-2 rounded-r-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center"
          title="Show Document Panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* ─── LEFT PANEL: DOCUMENT MANAGEMENT ─── */}
      {isLeftPanelVisible && (
        <div className="w-full md:w-4/12 flex flex-col gap-6 min-h-0 overflow-y-auto pr-0 md:pr-2 shrink-0 relative transition-all duration-300">
          
          <button
            onClick={() => setIsLeftPanelVisible(false)}
            className="absolute -right-2 md:right-0 top-6 z-10 bg-indigo-600 border border-indigo-500 p-1.5 rounded-l-xl text-white hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)] hidden md:flex items-center justify-center"
            title="Hide Document Panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>

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
                accept=".pdf,.docx,.png,.jpg,.jpeg,.bmp,.tiff"
                onChange={handleFileChange}
                disabled={uploading || processingDocId}
              />

              {uploading ? (
                <div className="flex flex-col items-center w-full space-y-4">
                  <div className="relative flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                    <span className="absolute text-xs font-bold text-indigo-400">{uploadProgress}%</span>
                  </div>
                  <div className="space-y-1 w-full px-4">
                    <p className="text-indigo-400 font-semibold text-sm animate-pulse">Uploading file...</p>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center space-y-4 w-full">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-900/50 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-200 truncate max-w-[200px]" title={selectedFile.name}>{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatBytes(selectedFile.size)}</p>
                  </div>
                  <div className="flex gap-2 w-full mt-2">
                    <button onClick={() => setSelectedFile(null)} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
                    <button onClick={startUpload} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all">Upload & Process</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-slate-950/80 flex items-center justify-center text-slate-400 border border-slate-900 group-hover:scale-105 transition-transform">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div>
                    <button onClick={onButtonClick} className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                      Click to select file
                    </button>
                    <span className="text-sm text-slate-400"> or drag and drop</span>
                    <p className="text-xs text-slate-500 mt-1">Supported: PDF, DOCX, PNG, JPG, JPEG (Max 50MB)</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={enableOCR} onChange={(e) => setEnableOCR(e.target.checked)} disabled={uploading || processingDocId} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${enableOCR ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-slate-700'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enableOCR ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-semibold ${enableOCR ? 'text-indigo-400' : 'text-slate-300'}`}>Enable OCR</span>
                  <span className="text-[10px] text-slate-500">For scanned & image files</span>
                </div>
              </label>
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
            <div className={`glass rounded-3xl p-6 shadow-xl space-y-4 relative overflow-hidden ${isProcessing ? 'border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]' : ''}`}>
              {isProcessing && (
                <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                  <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${backendProgress?.percent || 0}%` }}></div>
                </div>
              )}
              
              <h3 className="text-lg font-bold flex items-center justify-between border-b border-slate-900 pb-3">
                <span>Active Document</span>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${isProcessing ? 'bg-indigo-950/60 text-indigo-400 border-indigo-900/50 animate-pulse' : 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50'}`}>
                  {isProcessing ? 'Processing' : 'Ready'}
                </span>
              </h3>

              <div className="space-y-3 text-sm relative z-10">
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
                
                {isProcessing ? (
                  <div className="pt-3 pb-1 flex flex-col items-center justify-center text-center">
                    <p className="text-indigo-400 font-semibold text-xs animate-pulse capitalize">
                      {backendProgress?.stage?.replace('_', ' ') || 'Initializing'}...
                    </p>
                    <p className="text-slate-500 text-[10px] mt-1">Please wait while the AI analyzes the document.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span className="text-slate-500">Pages Detected</span>
                      <span className="text-slate-200">{activeDocument.page_count}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900/40">
                      <span className="text-slate-500">Vector Chunks</span>
                      <span className="text-slate-200">{activeDocument.chunk_count}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 shadow-xl text-center py-12 flex flex-col items-center justify-center text-slate-500">
              <svg className="w-12 h-12 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium">No active document</p>
              <p className="text-xs text-slate-600 mt-1">Upload a document file to begin asking queries.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── CENTER/RIGHT PANEL: INTELLIGENCE SUITE ─── */}
      <div className={`glass rounded-3xl shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden transition-all duration-300 ease-in-out ${showHistory ? 'flex-[3]' : ''}`}>
        
        {/* Navigation Tabs + History Toggle */}
        <div className="flex border-b border-slate-900 bg-slate-950/20 px-2 pt-2 items-center">
          <div className="flex flex-grow overflow-x-auto no-scrollbar">
            {['chat', 'summary', 'quiz', 'flashcard', 'rewrite', 'compare'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                disabled={isProcessing}
                className={`px-4 py-3.5 text-sm font-bold tracking-wide capitalize transition-colors relative ${
                  activeTab === tab
                    ? 'text-indigo-400'
                    : isProcessing
                      ? 'text-slate-600 opacity-50 cursor-not-allowed'
                      : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_10px_rgba(99,102,241,0.5)]"></span>
                )}
              </button>
            ))}
          </div>
          {/* History sidebar toggle button */}
          <button
            onClick={() => setShowHistory((v) => !v)}
            title={showHistory ? 'Hide History' : 'Show History'}
            className={`mr-2 mb-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showHistory
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
        </div>

        {/* Processing State Override for Tabs */}
        {isProcessing ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-slate-950/30 p-8">
             <div className="max-w-md w-full glass rounded-3xl p-8 border border-indigo-500/20 shadow-[0_0_40px_rgba(99,102,241,0.1)] text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800"></div>
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="4" className="text-indigo-500 transition-all duration-300" strokeDasharray="301.59" strokeDashoffset={301.59 - (301.59 * (backendProgress?.percent || 0)) / 100} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black text-indigo-300">
                    {backendProgress?.percent || 0}%
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-200 mb-2">Ingesting Document</h3>
                <p className="text-sm font-semibold text-indigo-400 mb-6 capitalize">{backendProgress?.stage?.replace('_', ' ') || 'Starting up'}...</p>
                
                <div className="space-y-3">
                   <div className="flex items-center gap-3 text-xs">
                     <div className={`w-2 h-2 rounded-full ${backendProgress?.percent > 5 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                     <span className={backendProgress?.percent > 5 ? 'text-slate-300' : 'text-slate-600'}>Extracting text content</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs">
                     <div className={`w-2 h-2 rounded-full ${backendProgress?.percent > 50 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                     <span className={backendProgress?.percent > 50 ? 'text-slate-300' : 'text-slate-600'}>Generating semantic embeddings</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs">
                     <div className={`w-2 h-2 rounded-full ${backendProgress?.percent >= 100 ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                     <span className={backendProgress?.percent >= 100 ? 'text-slate-300' : 'text-slate-600'}>Storing vector data</span>
                   </div>
                </div>
             </div>
          </div>
        ) : (
          /* Normal Tab Content — wrapped in flex-1 so it fills space BELOW the tab bar */
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className={activeTab === 'chat' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <ChatPanel 
                activeDocument={activeDocument} 
                messages={messages} 
                setMessages={setMessages}
                onSendMessage={onSendMessage} 
                chatLoading={chatLoading} 
              />
            </div>
            
            <div className={activeTab === 'summary' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <SummaryPanel activeDocument={activeDocument} setActiveDocument={setActiveDocument} />
            </div>
            
            <div className={activeTab === 'quiz' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <QuizPanel activeDocument={activeDocument} />
            </div>

            <div className={activeTab === 'flashcard' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <FlashcardPanel activeDocument={activeDocument} />
            </div>

            <div className={activeTab === 'rewrite' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <RewritePanel />
            </div>

            <div className={activeTab === 'compare' ? 'h-full flex flex-col overflow-hidden' : 'hidden'}>
              <ComparePanel activeDocument={activeDocument} />
            </div>
          </div>
        )}
        
      </div>

      {/* ─── RIGHT SIDEBAR: HISTORY PANEL ─── */}
      <div
        className={`min-h-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          showHistory ? 'w-72 opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-72 min-h-0 flex-1 flex flex-col">
          <HistoryPanel
            activeDocument={activeDocument}
            onSelectDocument={handleSelectFromHistory}
            refreshTrigger={historyRefreshKey}
          />
        </div>
      </div>

    </div>
  );
}
