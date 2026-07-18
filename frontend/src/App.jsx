import { useState, useEffect } from 'react';

function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      console.error('Backend connection failed:', err);
      setError(err.message || 'Failed to connect to backend server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden selection:bg-indigo-600 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[140px] pointer-events-none translate-y-1/3"></div>

      {/* Navigation Header */}
      <header className="glass sticky top-0 z-50 border-b border-slate-900 px-6 py-4">
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
            <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">API ENDPOINT: http://localhost:5000</span>
            {loading ? (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800 animate-pulse">
                <span className="h-2 w-2 mr-2 rounded-full bg-slate-500 animate-ping"></span>
                Checking Connection...
              </span>
            ) : error ? (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-red-950/40 text-red-400 border border-red-900/50 animate-border">
                <span className="h-2 w-2 mr-2 rounded-full bg-red-500"></span>
                Disconnected
              </span>
            ) : (
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 animate-border">
                <span className="h-2 w-2 mr-2 rounded-full bg-emerald-500"></span>
                Connected
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-grow w-full flex flex-col justify-center">
        {/* Hero Title Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-6">
            <span>✨ Foundational Architecture Configured</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
            AI-Powered Document <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Intelligence Platform
            </span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Welcome to the boilerplate of DocVerse AI. This monorepo includes a secure Express API server, modular RAG directories, database pool config, and a React Vite frontend running in tandem.
          </p>
        </div>

        {/* Connection Status Panel */}
        <section className="glass rounded-3xl p-8 mb-16 shadow-2xl relative overflow-hidden max-w-4xl mx-auto w-full">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <svg className="w-32 h-32 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
            <span>Client-Server Bridge Verification</span>
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            The frontend is executing real-time health checks on mount using `fetch()` against the backend’s `/api/health` API.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Grid Col 1: Connection Info */}
            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-900 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Status</span>
                <div className="text-lg font-bold">
                  {loading ? (
                    <span className="text-slate-400">Loading...</span>
                  ) : error ? (
                    <span className="text-red-400">Connection Failed</span>
                  ) : (
                    <span className="text-emerald-400">Fully Operational</span>
                  )}
                </div>
              </div>
              <button 
                onClick={handleRetry}
                disabled={loading}
                className="mt-4 w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-150 border border-slate-700/50"
              >
                Re-check Connection
              </button>
            </div>

            {/* Grid Col 2: API Details */}
            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-900 md:col-span-2 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">JSON Payload Response</span>
                {loading ? (
                  <div className="h-24 bg-slate-950 rounded-lg animate-pulse border border-slate-900"></div>
                ) : error ? (
                  <div className="p-3 bg-red-950/20 rounded-lg border border-red-900/30 text-xs font-mono text-red-300 overflow-x-auto whitespace-pre-wrap">
                    {`{\n  "error": "${error}",\n  "fix": "Start the backend server using 'npm run dev' inside the /backend directory and ensure PostgreSQL is running."\n}`}
                  </div>
                ) : (
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-900 text-xs font-mono text-indigo-300 overflow-x-auto">
                    {JSON.stringify(healthData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="mb-8">
          <h3 className="text-2xl font-bold text-center mb-10">DocVerse AI Tech Stack & Features</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1 */}
            <div className="glass hover:bg-slate-900/80 transition-all duration-300 rounded-2xl p-6 border border-slate-900 group">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 4a2 2 0 012 2v6a2 2 0 01-2 2h-2m-6 0h.01M9 16h.01M7 16h.01M9 12h.01M7 12h.01M9 8h.01M7 8h.01"></path>
                </svg>
              </div>
              <h4 className="text-lg font-bold mb-2">PostgreSQL & Vector</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Utilizing `pgvector` extension to perform fast vector similarity search for document chunks.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass hover:bg-slate-900/80 transition-all duration-300 rounded-2xl p-6 border border-slate-900 group">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <h4 className="text-lg font-bold mb-2">Multer & PDF parsing</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Raw layout text parsing with `pdf-parse` combined with Express file streams for chunking pipelines.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass hover:bg-slate-900/80 transition-all duration-300 rounded-2xl p-6 border border-slate-900 group">
              <div className="h-12 w-12 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <h4 className="text-lg font-bold mb-2">LangChain.js & LLMs</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Standard RAG configuration built on top of LangChain.js pipelines and OpenAI GPT embedding models.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass hover:bg-slate-900/80 transition-all duration-300 rounded-2xl p-6 border border-slate-900 group">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                </svg>
              </div>
              <h4 className="text-lg font-bold mb-2">Modular Clean Code</h4>
              <p className="text-slate-400 text-sm leading-relaxed">
                Well-structured folders for services, routes, controllers, hooks, views, and custom reusable components.
              </p>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/60 bg-slate-950 py-8 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          <p>© 2026 DocVerse AI Platform. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">API References</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Security</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
