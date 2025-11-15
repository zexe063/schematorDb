

import React, { useState, useEffect } from 'react';
// FIX: Use NodeResizeControl instead of NodeResizer for more control over handle scaling.
// FIX: Import useStore to get the zoom level for handle scaling.
import { NodeResizeControl, useStore } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { GroupData, GroupColorStyles } from '../types';
import { Spinner } from './icons';

interface GroupNodeProps extends NodeProps<GroupData> {
  onUpdate: (id: string, data: Partial<GroupData>) => void;
}

const GroupNode: React.FC<GroupNodeProps> = ({ id, data, selected, onUpdate }) => {
  const [name, setName] = useState(data.name);
  const { isLoading, isDropTarget } = data;

  const colorStyle = GroupColorStyles[data.color] || GroupColorStyles.Gray;

  // Get zoom from the store to manually control handle scaling.
  const zoom = useStore((s) => s.transform[2]);

  useEffect(() => {
    setName(data.name);
  }, [data.name]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleNameBlur = () => {
    if (data.name.trim() !== name.trim() && name.trim() !== '') {
      onUpdate(id, { name: name.trim() });
    } else {
      setName(data.name); // Revert if empty or unchanged
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const resizeControlStyle: React.CSSProperties = {
    background: 'white',
    border: '2px solid #0ea5e9', // sky-500
   
    width: 10,
    height: 10,
    // Apply an inverse scale transform to counteract the viewport zoom, keeping handles a consistent size.
   
  };

  return (
    <>
      {/* 
        Using NodeResizeControl directly to disable auto-scaling of handles.
        This ensures they remain a consistent, usable size regardless of zoom level.
        The `selected` prop is used to conditionally render the controls.
      */}
      {selected && (
        <>
          <NodeResizeControl 
            minWidth={100} 
            minHeight={100}
            position="top-left"
            style={resizeControlStyle}
          />
          <NodeResizeControl 
            minWidth={100} 
            minHeight={100}
            position="top-right"
            style={resizeControlStyle}
          />
          <NodeResizeControl 
            minWidth={100} 
            minHeight={100}
            position="bottom-left"
            style={resizeControlStyle}
          />
          <NodeResizeControl 
            minWidth={100} 
            minHeight={100}
            position="bottom-right"
            style={resizeControlStyle}
          />
        </>
      )}
      <div
        className={`rounded-md transition-all duration-200 h-full w-full flex flex-col ${colorStyle.bg} ${
          selected ? 'outline-sky-500' : colorStyle.outline
        } outline outline-2 outline-offset-[-2px] ${isDropTarget ? `ring-4 ring-offset-neutral-900 ring-offset-2 ${colorStyle.ring}`: ''}`}
      >
        <div className={`p-2 border-b ${selected ? 'border-sky-500/30' : 'border-neutral-800'} flex-shrink-0`}>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className={`font-bold text-sm tracking-wider bg-transparent outline-none w-full p-1 rounded-sm focus:bg-neutral-800/50 focus:ring-1 focus:ring-sky-500 ${colorStyle.text} disabled:opacity-70`}
            aria-label="Group Name"
          />
        </div>
        <div className="flex-grow flex items-center justify-center">
          {isLoading ? (
            <div className="text-center p-4">
                <Spinner className={`w-8 h-8 mx-auto mb-3 ${colorStyle.text}`} />
                <p className={`text-sm font-medium ${colorStyle.text}`}>Generating Schema...</p>
            </div>
          ) : (
            <div className="w-full h-full">
              {/* Child nodes are rendered here by React Flow */}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GroupNode;
