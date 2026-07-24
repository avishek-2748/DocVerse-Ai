import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AuthScreen from './components/AuthScreen';
import HomePage from './components/HomePage';
import { askQuestion, getConversations } from './services/api';

function App() {
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });

  // Core App states for Document & Chat interaction
  const [activeDocument, setActiveDocument] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

  const checkBackendHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'https://normally-distinguished-showing-historical.trycloudflare.com';
const response = await fetch(`${API_URL}/api/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      console.error('Backend connection failed:', err);
      setHealthError(err.message || 'Failed to connect to backend server');
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  // Load chat history when a new document is uploaded/selected
  useEffect(() => {
    let isMounted = true;
    if (activeDocument) {
      setChatLoading(true);
      getConversations(activeDocument.document_id)
        .then((res) => {
          if (isMounted) {
            if (res.success && res.data.length > 0) {
              setMessages(res.data.map(m => ({ sender: m.role, text: m.content })));
            } else {
              setMessages([
                {
                  sender: 'ai',
                  text: `Hello! I have finished analyzing "${activeDocument.filename}". Ask me anything about its contents!`,
                },
              ]);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load history:", err);
          if (isMounted) {
            setMessages([
              {
                sender: 'ai',
                text: `Hello! I have finished analyzing "${activeDocument.filename}". Ask me anything about its contents!`,
              },
            ]);
          }
        })
        .finally(() => {
          if (isMounted) setChatLoading(false);
        });
    } else {
      setMessages([]);
    }
    return () => { isMounted = false; };
  }, [activeDocument]);

  const handleSendMessage = async (text) => {
    if (!activeDocument) return;

    // 1. Append user message to state
    const userMessage = { sender: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);

    try {
      // 2. Query the backend RAG endpoint
      const response = await askQuestion(activeDocument.document_id, text);
      
      // 3. Append AI response to state
      if (response.success && response.answer) {
        setMessages((prev) => [...prev, { sender: 'ai', text: response.answer }]);
      } else {
        throw new Error(response.message || 'No response returned from the server');
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ Error: ${err.message || 'Failed to generate answer. Please try again.'}`,
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden selection:bg-indigo-600 selection:text-white relative">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none translate-y-1/3"></div>

      {/* Navigation Header */}
      <header className="glass shrink-0 z-50 border-b border-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              DocVerse <span className="text-indigo-500 font-medium">AI</span>
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated && currentUser?.name && (
              <span className="text-sm font-medium text-slate-300 hidden sm:inline-block mr-4">
                Welcome, <span className="text-indigo-400">{currentUser.name}</span>
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
              API STATUS:
            </span>
            {healthLoading ? (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800 animate-pulse">
                <span className="h-2 w-2 mr-2 rounded-full bg-slate-500 animate-ping"></span>
                Checking API...
              </span>
            ) : healthError ? (
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-red-950/40 text-red-400 border border-red-900/50 hover:bg-red-900/25 transition-all"
              >
                <span className="h-2 w-2 mr-2 rounded-full bg-red-500"></span>
                API Offline (Retry)
              </button>
            ) : (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
                <span className="h-2 w-2 mr-2 rounded-full bg-emerald-500"></span>
                API Online
              </span>
            )}
            {isAuthenticated && (
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  setIsAuthenticated(false);
                  setCurrentUser(null);
                  setActiveDocument(null);
                  setMessages([]);
                  setShowDashboard(false);
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/60 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white transition-all ml-2"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {!isAuthenticated ? (
          <AuthScreen onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsAuthenticated(true);
            localStorage.setItem('user', JSON.stringify(user));
          }} />
        ) : healthError ? (
          <div className="flex-grow flex flex-col justify-center items-center py-20 px-6 max-w-xl mx-auto text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-6 border border-red-500/20">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-3">API Server Offline</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Could not establish a connection to the backend server. Please make sure the backend server is running and database container is active.
            </p>
            <button
              onClick={handleRetry}
              disabled={healthLoading}
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/15"
            >
              Retry Connection
            </button>
          </div>
        ) : !showDashboard ? (
          <HomePage onEnterDashboard={() => setShowDashboard(true)} />
        ) : (
          <Dashboard
            activeDocument={activeDocument}
            setActiveDocument={setActiveDocument}
            messages={messages}
            setMessages={setMessages}
            onSendMessage={handleSendMessage}
            chatLoading={chatLoading}
          />
        )}
      </main>

      {/* Footer — always pinned to bottom */}
      <footer className="shrink-0 border-t border-slate-800/60 bg-slate-950/95 backdrop-blur-sm py-3 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left: copyright */}
          <p className="whitespace-nowrap">© 2026 DocVerse AI Platform. All rights reserved.</p>

          {/* Center: Team */}
          <div className="flex items-center gap-4">
            <span className="text-slate-600 hidden sm:inline">Built by</span>
            {/* Member 1 */}
            <div className="flex items-center gap-1.5 group">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px] shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500/40">
                A
              </div>
              <span className="text-slate-400 group-hover:text-indigo-400 transition-colors font-medium">Avishek</span>
              <span className="text-slate-700 text-[10px] hidden sm:inline">&middot; Full-Stack Dev</span>
            </div>
            <span className="text-slate-700">&amp;</span>
            {/* Member 2 */}
            <div className="flex items-center gap-1.5 group">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-[10px] shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/40">
                R
              </div>
              <span className="text-slate-400 group-hover:text-emerald-400 transition-colors font-medium">Rimjhim</span>
              <span className="text-slate-700 text-[10px] hidden sm:inline">&middot; UI/UX Designer</span>
            </div>
          </div>

          {/* Right: links */}
          <div className="flex gap-5 whitespace-nowrap">
            <a href="#" className="hover:text-indigo-400 transition-colors">Docs</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">API</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
