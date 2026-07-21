import React from 'react';

function parseInline(text) {
  if (!text) return '';
  
  // Split by bold (**).
  const boldParts = text.split('**');
  return boldParts.map((bPart, bIdx) => {
    const isBold = bIdx % 2 !== 0;
    
    // Split by italic (*).
    const italicParts = bPart.split('*');
    const renderedItalics = italicParts.map((iPart, iIdx) => {
      const isItalic = iIdx % 2 !== 0;
      if (isItalic) {
        return <em key={iIdx} className="italic text-indigo-200">{iPart}</em>;
      }
      return iPart;
    });
    
    if (isBold) {
      return (
        <strong key={bIdx} className="font-bold text-white bg-indigo-500/10 px-1 rounded">
          {renderedItalics}
        </strong>
      );
    }
    return <span key={bIdx}>{renderedItalics}</span>;
  });
}

export default function MarkdownRenderer({ text }) {
  if (!text) return null;
  
  // Split content by double newlines into blocks (paragraphs, lists, headings)
  const blocks = text.split(/\n\n+/);
  
  return (
    <div className="space-y-4">
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        
        // 1. Heading Check (e.g. ### Title)
        if (trimmed.startsWith('#')) {
          const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
          if (match) {
            const level = match[1].length;
            const headingText = match[2];
            const className = level === 1 ? "text-2xl font-extrabold text-white mt-4 border-b border-slate-900 pb-1" : 
                              level === 2 ? "text-xl font-bold text-slate-100 mt-3" : 
                              "text-lg font-semibold text-slate-200 mt-2";
            const Tag = `h${Math.min(level, 6)}`;
            return (
              <Tag key={blockIdx} className={className}>
                {parseInline(headingText)}
              </Tag>
            );
          }
        }
        
        // 2. Bold title prefix check (e.g., "**Executive Summary** \n\n text...")
        // If a line starts with bold text and is very short, format it like a section header
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 50) {
          return (
            <h4 key={blockIdx} className="text-sm font-bold text-indigo-400 uppercase tracking-wider mt-4">
              {parseInline(trimmed.replace(/\*\*/g, ''))}
            </h4>
          );
        }
        
        // 3. List check (each line starts with - or *)
        const lines = trimmed.split('\n');
        const isList = lines.every(line => {
          const tLine = line.trim();
          return tLine.startsWith('- ') || tLine.startsWith('* ');
        });
        
        if (isList && lines.length > 0) {
          return (
            <ul key={blockIdx} className="list-disc pl-5 space-y-2 text-slate-300">
              {lines.map((line, lineIdx) => {
                const content = line.trim().replace(/^[-*]\s+/, '');
                return (
                  <li key={lineIdx} className="leading-relaxed">
                    {parseInline(content)}
                  </li>
                );
              })}
            </ul>
          );
        }
        
        // 4. Regular paragraph
        return (
          <p key={blockIdx} className="text-slate-300 leading-relaxed text-sm">
            {lines.map((line, lineIdx) => (
              <React.Fragment key={lineIdx}>
                {parseInline(line)}
                {lineIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
