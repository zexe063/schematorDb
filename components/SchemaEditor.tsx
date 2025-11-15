import React, { useMemo, useCallback } from 'react';
// FIX: Corrected reactflow imports for v11+
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  getSmoothStepPath,
} from 'reactflow';
import type {
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  OnNodesChange,
  OnEdgesChange,
  NodeTypes,
  EdgeProps,
  EdgeTypes,
  OnSelectionChangeFunc,
  OnMove,
  OnConnectStart,
  OnNodesDelete,
} from 'reactflow';
import CollectionNode from './CollectionNode';
import GroupNode from './GroupNode';
import { DrawingTool } from './DrawingTool';
import { CollectionData, GroupData } from '../types';

// CUSTOM EDGE COMPONENT
// =====================
// This component renders a smooth step path and is responsible for defining
// and applying the custom SVG markers for relationship cardinality.

const RelationshipEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
}) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  // Unique IDs prevent marker conflicts if this component is used for multiple edges
  const startMarkerId = `marker-one-${id}`;
  const endMarkerId = `marker-many-${id}`;

  return (
    <>
      {/* 
        This SVG block is for definitions only and is not rendered directly.
        It's positioned off-screen and contains the marker definitions.
      */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          {/* 
            Marker for "One and Only One" relationship: ||
            - It's a start marker, using `orient="auto-start-reverse"`.
            - The main edge path connects at `refX`, where the second vertical `|` is.
          */}
          <marker
            id={startMarkerId}
            viewBox="0 0 10 10"
            markerWidth="8"
            markerHeight="8"
            refX="9" // Connect the edge path to the last vertical line
            refY="5"
            orient="auto-start-reverse"
          >
            {/* Second vertical line `|` (at the connection point) */}
            <path d="M 9 0 L 9 10" stroke="#ffffff" strokeWidth="2" fill="none" />
            {/* First vertical line `|` (spaced apart from the second) */}
            <path d="M 6 0 L 6 10" stroke="#ffffff" strokeWidth="2" fill="none" />
          </marker>

          {/* 
            Marker for "One or Many" relationship: |<
            - It's an end marker, using `orient="auto"`.
            - The edge path connects to the vertical line `|`.
            - The crow's foot `<` connects directly to the vertical line.
          */}
          <marker id={endMarkerId} orient="auto" overflow="visible" markerHeight="7" markerWidth="10" markerUnits="userSpaceOnUse" refX="2.5" refY="1">
  
  <path transform='rotate(90)'
        d="M 8,-2 L1,5 L-6,-2"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
       
      />
</marker>
        </defs>
      </svg>
      {/* The actual visible edge path */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerStart={`url(#${startMarkerId})`}
        markerEnd={`url(#${endMarkerId})`}
      />
    </>
  );
}


// MAIN COMPONENT
// ==============

interface SchemaEditorProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    onConnect: (connection: Connection) => void;
    onNodeClick: (_: React.MouseEvent, node: Node) => void;
    onPaneClick: (event: React.MouseEvent) => void;
    onDrop: (event: React.DragEvent) => void;
    updateNode: (id: string, data: Partial<CollectionData | GroupData>) => void;
    onNodeDrag?: (_: React.MouseEvent, node: Node) => void;
    onNodeDragStop?: (_: React.MouseEvent, node: Node) => void;
    onSelectionChange?: OnSelectionChangeFunc;
    onMove?: OnMove;
    onConnectStart?: OnConnectStart;
    isDrawingMode?: boolean;
    isRelationshipMode?: boolean;
    onCreateGroupFromDraw: (rect: { x: number; y: number; width: number; height: number; }) => void;
    onPaneContextMenu?: (event: React.MouseEvent) => void;
    onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
    onNodesDelete?: OnNodesDelete;
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    onDrop,
    updateNode,
    onNodeDrag,
    onNodeDragStop,
    onSelectionChange,
    onMove,
    onConnectStart,
    isDrawingMode,
    isRelationshipMode,
    onCreateGroupFromDraw,
    onPaneContextMenu,
    onNodeContextMenu,
    onNodesDelete,
}) => {
  const nodeTypes: NodeTypes = useMemo(() => ({ 
      collectionNode: CollectionNode,
      groupNode: (props) => <GroupNode {...props} onUpdate={updateNode} />,
  }), [updateNode]);
  
  const edgeTypes: EdgeTypes = useMemo(() => ({
    relationshipEdge: RelationshipEdge,
  }), []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onSelectionChange={onSelectionChange}
      onMove={onMove}
      onConnectStart={onConnectStart}
      onPaneContextMenu={onPaneContextMenu}
      onNodeContextMenu={onNodeContextMenu}
      onNodesDelete={onNodesDelete}
      deleteKeyCode="Backspace"
      panOnDrag={!isDrawingMode && !isRelationshipMode}
    
defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
      minZoom={0.1}
      maxZoom={2}
      className={`bg-neutral-900 font-jetbrains-mono ${isDrawingMode ? 'drawing-mode' : ''} ${isRelationshipMode ? 'relationship-mode' : ''}`}
    >
      {isDrawingMode && <DrawingTool onCreateGroup={onCreateGroupFromDraw} />}
      <Background color="#262626" gap={24} />
     
      <MiniMap nodeColor="#404040" maskColor="#171717" style={{ backgroundColor: '#171717', border: '1px solid #262626' }} pannable zoomable />
    </ReactFlow>
  );
};

export default SchemaEditor;