

import React from 'react';
import { useReactFlow } from 'reactflow';
import { HiOutlineMagnifyingGlassPlus, HiOutlineMagnifyingGlassMinus, HiOutlineArrowsPointingOut, HiOutlineSparkles, HiLink } from 'react-icons/hi2';
import { Spinner } from './icons';
import { CiExport } from "react-icons/ci";

interface HeaderProps {
    onToggleAiSidebar: () => void;
    onInitiateExport: () => void;
    isExporting: boolean;
    isDrawingGroup: boolean;
    onInitiateGroupDraw: () => void;
    isRelationshipMode: boolean;
    onToggleRelationshipMode: () => void;
    zoomLevel: number;
}

const Logo = () => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" /> {/* sky-400 */}
          <stop offset="100%" stopColor="#0ea5e9" /> {/* sky-500 */}
        </linearGradient>
      </defs>
      <rect x="4" y="10" width="12" height="12" rx="2.5" fill="url(#logoGradient)" fillOpacity="0.2" />
      <rect x="4" y="10" width="12" height="12" rx="2.5" stroke="url(#logoGradient)" strokeWidth="2" />
      <rect x="16" y="4" width="12" height="12" rx="2.5" fill="#262626" stroke="#525252" strokeWidth="2" />
      <path d="M16 16 H 22" stroke="#525252" strokeWidth="2" strokeLinecap="round" />
    </svg>
);


const DraggableTableIcon = () => {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div 
            draggable 
            onDragStart={(event) => onDragStart(event, 'collectionNode')}
            className="p-1.5 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors cursor-grab"
            title="Drag to add a new collection"
        >
            <svg 
                width="20" 
                height="20" 
                viewBox="0 0 20 20" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
            >
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 7.5H17" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M7 11H13" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <path d="M7 14H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
        </div>
    );
};

const DrawFrameTool: React.FC<{ isActive: boolean, onClick: () => void }> = ({ isActive, onClick }) => {
    // The button has padding and is relative to position the shortcut.
    const baseClasses = "relative p-2.5 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer";
    const activeClasses = "bg-sky-800/50 text-sky-300 hover:bg-sky-800/80 hover:text-sky-300 ring-1 ring-sky-700";
    
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : 'hover:bg-neutral-800'}`}
            title="Draw a group frame (G)"
        >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
              <path d="M16.25 3.75H3.75C3.55109 3.75 3.36032 3.82902 3.21967 3.96967C3.07902 4.11032 3 4.30109 3 4.5V15.5C3 15.6989 3.07902 15.8897 3.21967 16.0303C3.36032 16.171 3.55109 16.25 3.75 16.25H16.25C16.4489 16.25 16.6397 16.171 16.7803 16.0303C16.921 15.8897 17 15.6989 17 15.5V4.5C17 4.30109 16.921 4.11032 16.7803 3.96967C16.6397 3.82902 16.4489 3.75 16.25 3.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2"/>
            </svg>
            <span 
                className="absolute bottom-1 right-1 text-[10px] text-neutral-500 font-semibold font-jetbrains-mono"
            >
                G
            </span>
        </button>
    );
};

const RelationshipTool: React.FC<{ isActive: boolean, onClick: () => void }> = ({ isActive, onClick }) => {
    const baseClasses = "relative p-2.5 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer";
    const activeClasses = "bg-sky-800/50 text-sky-300 hover:bg-sky-800/80 hover:text-sky-300 ring-1 ring-sky-700";
    
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : 'hover:bg-neutral-800'}`}
            title="Create a relationship (L)"
        >
             <svg className="w-5 h-5" aria-hidden="true" focusable="false" role="img" viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <g>
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                    <path d="M4,19L10,19C11.097,19 12,18.097 12,17L12,9C12,7.903 12.903,7 14,7L21,7"></path>
                    <path d="M18 4l3 3l-3 3"></path>
                </g>
            </svg>
            <span 
                className="absolute bottom-1 right-1 text-[10px] text-neutral-500 font-semibold font-jetbrains-mono"
            >
                L
            </span>
        </button>
    );
};


const Header: React.FC<HeaderProps> = ({ onToggleAiSidebar, onInitiateExport, isExporting, isDrawingGroup, onInitiateGroupDraw, isRelationshipMode, onToggleRelationshipMode, zoomLevel }) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const buttonClass = "p-1.5 rounded-md text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors cursor-pointer";

    return (
        <header className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between shadow-md z-10 flex-shrink-0">
            <div className="flex items-center space-x-4">
                 <Logo />
                 <span className="text-neutral-700">/</span>
                 
            </div>
            <div className="flex items-center space-x-2 bg-black/20 p-1 rounded-lg border border-neutral-800">
                <DraggableTableIcon />
                <DrawFrameTool isActive={isDrawingGroup} onClick={onInitiateGroupDraw} />
                <RelationshipTool isActive={isRelationshipMode} onClick={onToggleRelationshipMode} />
                <div className="h-6 w-px bg-neutral-800 mx-1"></div>
                <button onClick={onToggleAiSidebar} className={buttonClass} title="AI Schema Generator">
                    <HiOutlineSparkles className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-neutral-800 mx-1"></div>
                <button onClick={() => zoomIn()} className={buttonClass} title="Zoom In">
                    <HiOutlineMagnifyingGlassPlus className="w-5 h-5" />
                </button>
                 <div className="text-xs text-neutral-400 font-jetbrains-mono w-12 text-center select-none" title="Current Zoom">
                    {Math.round(zoomLevel * 100)}%
                 </div>
                 <button onClick={() => zoomOut()} className={buttonClass} title="Zoom Out">
                    <HiOutlineMagnifyingGlassMinus className="w-5 h-5" />
                </button>
                <div className="h-6 w-px bg-neutral-800 mx-1"></div>
                <button onClick={() => fitView()} className={buttonClass} title="Fit View">
                    <HiOutlineArrowsPointingOut className="w-5 h-5" />
                </button>
            </div>
            <div>
                 <button
                  onClick={onInitiateExport}
                  disabled={isExporting}
                  className="bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800/50 disabled:cursor-wait text-white font-semibold py-2 px-4 rounded-[6px] transition-colors flex items-center justify-center space-x-2 text-sm"
                >
                  {isExporting ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <CiExport className="w-5 h-5" />
                      <span>Export</span>
                    </>
                  )}
                </button>
            </div>
        </header>
    );
};

export default Header;