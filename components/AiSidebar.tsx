

import React, { useState } from 'react';
import { HiOutlineXMark, HiOutlineSparkles } from 'react-icons/hi2';
import { Spinner } from './icons';

interface AiSidebarProps {
  isOpen: boolean;
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
}

const AiSidebar: React.FC<AiSidebarProps> = ({ isOpen, isGenerating, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('A blog platform with users, posts, comments, and tags. Users can have profiles. Posts belong to users. Comments belong to users and posts. Posts can have multiple tags.');

  const handleGenerate = () => {
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt);
    }
  };

  return (
    <aside
      className={`absolute top-0 left-0 z-20 h-full bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: 350 }}
    >
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold uppercase text-neutral-400 tracking-wider">AI Schema Generator</h2>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1 rounded-md">
          <HiOutlineXMark className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 flex-grow flex flex-col">
        <label htmlFor="ai-prompt" className="text-sm font-medium text-neutral-300 mb-2">
          Describe the database schema you want to create:
        </label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., An e-commerce site with products, customers, and orders..."
          className="w-full flex-grow bg-neutral-800 border border-neutral-700 rounded-md p-3 text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
          rows={10}
        />
        <p className="text-xs text-neutral-500 mt-2">
          The more detailed your description, the better the result. Mention collections, fields, and how they relate.
        </p>
      </div>

      <div className="p-4 border-t border-neutral-800 flex-shrink-0">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800/50 disabled:cursor-wait text-white font-semibold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm"
        >
          {isGenerating ? (
            <>
              <Spinner className="w-4 h-4" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <HiOutlineSparkles className="w-5 h-5" />
              <span>Generate Schema</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default AiSidebar;