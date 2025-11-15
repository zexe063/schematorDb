import React, { useState, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import type { XYPosition } from 'reactflow';

interface DrawingToolProps {
  onCreateGroup: (rect: { x: number; y: number; width: number; height: number; }) => void;
}

// Helper to get the top-left position of a rectangle defined by two points
function getPosition(start: XYPosition, end: XYPosition): XYPosition {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

// Helper to get the dimensions of a rectangle defined by two points
function getDimensions(start: XYPosition, end: XYPosition) {
  return {
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}


export const DrawingTool: React.FC<DrawingToolProps> = ({ onCreateGroup }) => {
  // Use viewport-relative coordinates (clientX/Y) for consistency with React Flow.
  const [startPosition, setStartPosition] = useState<XYPosition | null>(null);
  const [endPosition, setEndPosition] = useState<XYPosition | null>(null);
  
  // Store the container's bounding rectangle to calculate relative positions for the preview.
  const containerBoundsRef = useRef<DOMRect | null>(null);

  const { screenToFlowPosition, getViewport } = useReactFlow();

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    // Cache the container's bounds when the drawing starts.
    containerBoundsRef.current = target.getBoundingClientRect();

    setStartPosition({ x: e.clientX, y: e.clientY });
    setEndPosition({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.buttons !== 1 || !startPosition) return;

    setEndPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!startPosition || !endPosition) return;
    
    const zoom = getViewport().zoom;
    
    // `screenToFlowPosition` correctly uses viewport-relative coordinates (clientX/Y).
    const flowPosition = screenToFlowPosition(getPosition(startPosition, endPosition));
    
    // Calculate dimensions in flow-space by dividing by the current zoom level.
    const flowDimensions = {
      width: Math.abs(endPosition.x - startPosition.x) / zoom,
      height: Math.abs(endPosition.y - startPosition.y) / zoom,
    };

    // Only create a group if it's a meaningful size
    if (flowDimensions.width > 50 && flowDimensions.height > 50) {
      onCreateGroup({ ...flowPosition, ...flowDimensions });
    }
    
    setStartPosition(null);
    setEndPosition(null);
    containerBoundsRef.current = null;
  };

  // Calculate the visual preview rectangle based on the container's position.
  const previewRect = startPosition && endPosition && containerBoundsRef.current ? {
    position: {
      x: Math.min(startPosition.x, endPosition.x) - containerBoundsRef.current.left,
      y: Math.min(startPosition.y, endPosition.y) - containerBoundsRef.current.top,
    },
    dimension: getDimensions(startPosition, endPosition),
  } : null;

  return (
    <div 
      className="drawing-tool-overlay nopan nodrag"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {previewRect && (
        <div 
          className="drawing-preview"
          style={{
            width: previewRect.dimension.width,
            height: previewRect.dimension.height,
            transform: `translate(${previewRect.position.x}px, ${previewRect.position.y}px)`,
          }}
        />
      )}
    </div>
  );
};
