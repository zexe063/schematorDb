import React, { useState } from 'react';
import { HiOutlineXMark, HiOutlineClipboardDocument } from 'react-icons/hi2';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface ExportSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

// A fresh, custom style object for syntax highlighting, built from scratch to user specifications.
const customSyntaxStyle = {
  // Base styles for the container, with a solid background
  'pre[class*="language-"]': {
    color: '#d4d4d4', // Default text color
    background: '#171717',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.875rem',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    wordWrap: 'normal',
    lineHeight: '1.5',
    padding: '1rem',
    margin: 0,
    overflow: 'auto',
  },
  'code[class*="language-"]': {
    fontFamily: '"JetBrains Mono", monospace',
    whiteSpace: 'pre-wrap !important',
    wordBreak: 'break-all !important',
  },
  // Token styles based on user feedback
  'keyword': { color: '#00a9e5' },         // const, new, require
  'function-variable': { color: '#00a9e5', fontWeight: 'bold' }, // For declarations like `const usersSchema = ...`
  'variable': { color: '#00a9e5', fontWeight: 'bold' },        // For used variables e.g. model('...', usersSchema)
  'class-name': { color: '#f69d50' },      // Schema, model, models
  'function': { color: '#6fcf97' },        // model(), require()
  'property': { color: '#00a9e5' },        // field names: username, email, type, required
  'string': { color: '#d7bef7' },          // collection names in model() and ref:
  'punctuation': { color: '#ffd700' },     // {}, [], ,
  // All "values" are yellow
  'boolean': { color: '#f69d50' },         // true, false
  'number': { color: '#f69d50' },
  'builtin': { color: '#f69d50' },         // String, Date, Number
  'constant': { color: '#f69d50' },        // For Schema.Types.ObjectId
  // Other styles
  'operator': { color: '#d4d4d4' },
  'comment': { color: '#6A9955', fontStyle: 'italic' },
};

const ExportIcon = () => (
    <svg role="img" width="19" height="18" focusable="false" aria-hidden="true" viewBox="0 0 19 18" className="w-5 h-5 text-gray-400 mr-3">
        <mask id="path-1-inside-1_9972_64693" fill="white"><rect y="4" width="8" height="9" rx="1.12811"></rect></mask>
        <rect y="4" width="8" height="9" fill="none" rx="1.12811" strokeWidth="3" stroke="currentColor" mask="url(#path-1-inside-1_9972_64693)"></rect>
        <mask id="path-2-inside-2_9972_64693" fill="white"><rect x="11" y="10" width="8" height="8" rx="1.12811"></rect></mask>
        <rect x="11" y="10" width="8" height="8" fill="none" rx="1.12811" strokeWidth="3" stroke="currentColor" mask="url(#path-2-inside-2_9972_64693)"></rect>
        <mask id="path-3-inside-3_9972_64693" fill="white"><rect x="11" width="8" height="8" rx="1.12811"></rect></mask>
        <rect x="11" width="8" height="8" fill="none" rx="1.12811" strokeWidth="3" stroke="currentColor" mask="url(#path-3-inside-3_9972_64693)"></rect>
        <path strokeWidth="1.5" stroke="currentColor" d="M8 10H8.37189C8.99493 10 9.5 10.5051 9.5 11.1281V13.8719C9.5 14.4949 10.0051 15 10.6281 15H11"></path>
        <path strokeWidth="1.5" stroke="currentColor" d="M8 7H8.37189C8.99493 7 9.5 6.49493 9.5 5.87189V3.12811C9.5 2.50507 10.0051 2 10.6281 2H11"></path>
    </svg>
);


const ExportSidebar: React.FC<ExportSidebarProps> = ({ isOpen, onClose, code }) => {
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  const handleCopyToClipboard = () => {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
  };
  
  if (!isOpen) return null;

  return (
    <aside
      className="absolute right-0 top-0 h-full border-l border-neutral-800 z-10 flex flex-col"
      style={{ width: 430, backgroundColor: '#171717' }}
    >
      <header className="p-4 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
            <ExportIcon />
            <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider">Export Mongoose Schema</h2>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 p-1 rounded-md">
          <HiOutlineXMark className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-grow overflow-hidden relative">
        <button
            onClick={handleCopyToClipboard}
            className="absolute top-3 right-3 bg-neutral-700/80 hover:bg-neutral-600/80 text-gray-300 p-2 rounded-md transition-colors text-xs z-10 flex items-center space-x-1.5"
          >
            <HiOutlineClipboardDocument className="w-4 h-4" />
            <span>{hasCopied ? 'Copied!' : 'Copy'}</span>
        </button>
        <div className="h-full w-full overflow-auto custom-scrollbar">
            <SyntaxHighlighter
                language="javascript"
                style={customSyntaxStyle as any}
                wrapLines={true}
                wrapLongLines={true}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    height: '100%',
                    fontSize: '0.875rem',
                }}
                codeTagProps={{
                    style: {
                        fontFamily: '"JetBrains Mono", monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                    },
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
      </main>
    </aside>
  );
};

export default ExportSidebar;