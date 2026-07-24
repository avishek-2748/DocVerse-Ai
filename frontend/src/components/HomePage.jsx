import React, { useEffect, useRef } from 'react';

// Custom hook to trigger animations when scrolling into view
function useIntersectionObserver(options = {}) {
  const elementRef = useRef(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.classList.remove('opacity-0-init');
        element.classList.add('animate-fade-up');
        // Unobserve after animating once
        observer.unobserve(element);
      }
    }, { threshold: 0.2, ...options });

    observer.observe(element);

    return () => {
      if (element) observer.unobserve(element);
    };
  }, [options]);

  return elementRef;
}

// Component for letter-by-letter animation
const AnimatedText = ({ text, delayOffset = 0 }) => {
  const ref = useIntersectionObserver();
  
  return (
    <span ref={ref} className="opacity-0-init block">
      {text.split('').map((char, index) => (
        <span
          key={index}
          className="animate-letter"
          style={{ animationDelay: `${delayOffset + index * 0.03}s` }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
};

const FeatureBlock = ({ title, description, imageSrc, isReversed, index }) => {
  const blockRef = useIntersectionObserver();

  return (
    <div 
      ref={blockRef} 
      className={`opacity-0-init flex flex-col ${isReversed ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 py-20 px-6 max-w-7xl mx-auto`}
    >
      {/* Image Section */}
      <div className="w-full md:w-1/2 flex justify-center">
        <div className="relative group rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 border border-slate-800/60 p-2 glass">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <img 
            src={imageSrc} 
            alt={title} 
            className="w-full h-auto rounded-2xl transform group-hover:scale-[1.02] transition-transform duration-700 object-cover"
          />
        </div>
      </div>

      {/* Text Section */}
      <div className="w-full md:w-1/2 space-y-6">
        <div className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 font-semibold text-xs tracking-wider uppercase">
          Feature 0{index}
        </div>
        <h2 className="text-3xl md:text-5xl font-bold text-slate-100 leading-tight">
          <AnimatedText text={title} delayOffset={0.2} />
        </h2>
        <p className="text-lg text-slate-400 leading-relaxed font-light">
          {description}
        </p>
      </div>
    </div>
  );
};

export default function HomePage({ onEnterDashboard }) {
  const heroRef = useIntersectionObserver();

  const features = [
    {
      title: "Interactive Document Chat",
      description: "Turn static files into dynamic conversations. Ask questions and get instant, context-aware answers powered by advanced AI.",
      imageSrc: "/animation/1.png"
    },
    {
      title: "Instant Summarization",
      description: "Digest long documents in seconds. Extract key insights and core concepts without reading hundreds of pages.",
      imageSrc: "/animation/2.png"
    },
    {
      title: "Smart Knowledge Quizzes",
      description: "Test your knowledge instantly. Generate structured quizzes from your documents to reinforce learning and retention.",
      imageSrc: "/animation/3.png"
    },
    {
      title: "3D Study Flashcards",
      description: "Master complex topics with interactive study tools. Beautiful, AI-generated flashcards make memorization effortless.",
      imageSrc: "/animation/4.png"
    },
    {
      title: "Text Rewriting & Styles",
      description: "Adapt your content for any audience. Rewrite text seamlessly into professional, casual, or simplified formats.",
      imageSrc: "/animation/5.png"
    },
    {
      title: "Multi-Document Comparison",
      description: "Analyze versions and spot differences effortlessly. Our AI diffing engine highlights changes across multiple files.",
      imageSrc: "/animation/6.png"
    },
    {
      title: "Secure History & Quota",
      description: "Your data, securely managed. Access past conversations and track your storage usage through an intuitive dashboard.",
      imageSrc: "/animation/7.png"
    }
  ];

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100 relative custom-scrollbar">
      {/* Background Orbs */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/2"></div>
      <div className="fixed bottom-0 right-1/4 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none translate-y-1/3"></div>

      {/* Hero Section */}
      <div 
        ref={heroRef}
        className="opacity-0-init min-h-[85vh] flex flex-col items-center justify-center text-center px-6 relative z-10"
      >
        <div className="mb-6 inline-flex items-center px-4 py-2 rounded-full border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-xl">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-3 animate-ping absolute"></span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-3"></span>
          <span className="text-sm font-medium text-slate-300">DocVerse AI Platform is Live</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
          Unlock the Power of <br />
          <span className="gradient-text bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
            Document Intelligence
          </span>
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl text-slate-400 mb-12 font-light leading-relaxed">
          Upload, chat, summarize, and learn from your PDFs in seconds. The ultimate AI-powered workspace for professionals and students.
        </p>
        
        <button 
          onClick={onEnterDashboard}
          className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-indigo-600 rounded-full overflow-hidden shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_60px_rgba(79,70,229,0.6)] transition-all duration-300 transform hover:-translate-y-1"
        >
          <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full -translate-x-full transition-transform duration-500 ease-out skew-x-12"></div>
          <span>Visit DocVerse Ai</span>
          <svg className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Alternating Features Section */}
      <div className="relative z-10 pb-32">
        {features.map((feature, idx) => (
          <FeatureBlock 
            key={idx}
            index={idx + 1}
            title={feature.title}
            description={feature.description}
            imageSrc={feature.imageSrc}
            isReversed={idx % 2 !== 0} // Alternate layout
          />
        ))}
      </div>

      {/* Call to Action Footer block inside Home Page */}
      <div className="relative z-10 py-32 border-t border-slate-900 bg-slate-950/50 backdrop-blur-md text-center px-6">
        <h2 className="text-4xl font-bold text-white mb-6">Ready to transform your workflow?</h2>
        <button 
          onClick={onEnterDashboard}
          className="px-8 py-3 rounded-full bg-slate-100 text-slate-950 font-bold hover:bg-white transition-colors shadow-lg shadow-white/10"
        >
          Enter Dashboard
        </button>
      </div>
    </div>
  );
}
