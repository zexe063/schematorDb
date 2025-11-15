

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
// FIX: Corrected reactflow imports for v11+
import {
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
  useReactFlow,
  useStore,
  useOnSelectionChange,
  useOnViewportChange,
} from 'reactflow';
import type {
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  OnConnectStart,
  OnMove,
} from 'reactflow';
import dagre from 'dagre';
import { GoogleGenAI, Type } from '@google/genai';
import SchemaEditor from './components/SchemaEditor';
import Header from './components/Header';
import ExplorerSidebar from './components/ExplorerSidebar';
import PropertiesSidebar from './components/PropertiesSidebar';
import AiSidebar from './components/AiSidebar';
import ExportSidebar from './components/ExportSidebar';
import ContextMenu from './components/ContextMenu';
import type { MenuItem } from './components/ContextMenu';
import { HiOutlineDocumentDuplicate, HiOutlineClipboard, HiOutlineTrash, HiPlus, HiOutlineScissors } from 'react-icons/hi2';
// FIX: Add DrawingNodeData to the import to correctly type the nodes state.
import { CollectionData, Field, MongoDataType, GroupData, GroupColor, GroupColorStyles, ExplorerCollectionData, ExplorerItem } from './types';

const initialNodes: Node<CollectionData | GroupData>[] = [

];

const initialEdges: Edge[] = [
  { 
    id: 'e1-2-users-posts', 
    source: '1', // users
    sourceHandle: '1-f1-1-sourceR', // users._id
    target: '2', // posts
    targetHandle: '2-f2-4-targetL', // posts.author
    type: 'relationshipEdge',
    style: { stroke: '#ffffff', strokeWidth: 1.5 },
  },
  {
    id: 'e-1-f1-4-3',
    source: '1',
    sourceHandle: '1-f1-4-sourceR', // source is left of target
    target: '3',
    targetHandle: null,
    type: 'bezier',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3' },
    style: { stroke: '#a3a3a3', strokeWidth: 1.5, strokeDasharray: '5 5' },
    data: { isParentChild: true },
  }
];

const getNextGroupColor = (existingColors: GroupColor[]): GroupColor => {
    const allColors = Object.keys(GroupColorStyles) as GroupColor[];
    const existingColorSet = new Set(existingColors);
    const nextColor = allColors.find(c => !existingColorSet.has(c));
    return nextColor || allColors[existingColors.length % allColors.length];
};

const getNextGroupName = (nodes: Node<CollectionData | GroupData>[]): string => {
    const groupNodes = nodes.filter(n => n.type === 'groupNode');
    const existingGroupNumbers = groupNodes
        .map(n => (n.data as GroupData).name.match(/^group_(\d+)$/))
        .filter(match => match !== null)
        .map(match => parseInt(match![1], 10));

    const maxNumber = existingGroupNumbers.length > 0 ? Math.max(...existingGroupNumbers) : 0;
    return `group_${maxNumber + 1}`;
};

// Helper to create PascalCase model names like 'users' -> 'Users', 'blog_posts' -> 'BlogPosts'
const toModelName = (name: string): string => {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
};

// FIX: Refactored function to remove redundant filter and clarify parameter name.
const generateMongooseCode = (collectionNodes: Node<CollectionData>[]): string => {
    const nodeMap = new Map(collectionNodes.map(n => [n.id, n.data]));

    let schemaDefinitions = '';
    let modelDefinitions = '';
    const modelNames: string[] = [];
    
    const schemasToBuild = new Map(collectionNodes.map(n => [n.id, { node: n, built: false }]));
    
    let builtCount = 0;
    const maxIterations = collectionNodes.length + 1;
    let currentIteration = 0;

    while (builtCount < collectionNodes.length && currentIteration < maxIterations) {
        for (const [nodeId, schemaInfo] of schemasToBuild.entries()) {
            if (schemaInfo.built) continue;

            const { node } = schemaInfo;
            const nodeData = node.data;
            let dependenciesMet = true;
            let schemaContent = '';

            const modelName = toModelName(nodeData.name);
            const schemaName = `${modelName.charAt(0).toLowerCase() + modelName.slice(1)}Schema`;

            let schemaFields = '{\n';

            for (const field of nodeData.fields) {
                let mongooseType: string = 'Schema.Types.Mixed';
                
                if (field.childCollectionId) {
                    const childSchemaInfo = schemasToBuild.get(field.childCollectionId);
                    if (!childSchemaInfo || !childSchemaInfo.built) {
                        dependenciesMet = false;
                        break; 
                    }
                    const childNodeData = nodeMap.get(field.childCollectionId);
                    if(childNodeData) {
                        const childModelName = toModelName(childNodeData.name);
                        const childSchemaName = `${childModelName.charAt(0).toLowerCase() + childModelName.slice(1)}Schema`;
                        mongooseType = childSchemaName;
                    }
                } else {
                    switch (field.type) {
                        case MongoDataType.ObjectId: mongooseType = 'Schema.Types.ObjectId'; break;
                        case MongoDataType.String: mongooseType = 'String'; break;
                        case MongoDataType.Number: mongooseType = 'Number'; break;
                        case MongoDataType.Boolean: mongooseType = 'Boolean'; break;
                        case MongoDataType.Date: mongooseType = 'Date'; break;
                        case MongoDataType.Array: mongooseType = '[Schema.Types.Mixed]'; break;
                        case MongoDataType.Object: mongooseType = 'Object'; break;
                    }
                }
                
                const fieldName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(field.name) ? field.name : `'${field.name}'`;

                schemaFields += `  ${fieldName}: {\n    type: ${mongooseType},\n`;
                if (field.required) schemaFields += `    required: true,\n`;
                if (field.isForeignKey && field.relatedCollection) {
                    const relatedNodeData = nodeMap.get(field.relatedCollection);
                    if (relatedNodeData) schemaFields += `    ref: '${toModelName(relatedNodeData.name)}',\n`;
                }
                schemaFields += `  },\n`;
            }
            if (!dependenciesMet) continue;

            schemaFields += '}';

            schemaContent += `const ${schemaName} = new Schema(${schemaFields}, { timestamps: true });\n\n`;
            
            schemaDefinitions += schemaContent;

            if (!nodeData.parentNode) {
                const modelDef = `const ${modelName} = models.${modelName} || model('${modelName}', ${schemaName});\n`;
                modelDefinitions += modelDef;
                modelNames.push(modelName);
            }
            
            schemaInfo.built = true;
            builtCount++;
        }
        currentIteration++;
    }
    
    if(builtCount < collectionNodes.length) {
        return "// Could not generate schema due to circular dependencies or missing child collections.";
    }

    let finalCode = `const { Schema, model, models } = require('mongoose');\n\n`;
    finalCode += schemaDefinitions;
    finalCode += modelDefinitions;
    
    if (modelNames.length > 0) {
        finalCode += `\nmodule.exports = {\n  ${modelNames.join(',\n  ')}\n};\n`;
    }

    return finalCode;
};

function AppContent() {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const { project, getNode, getNodes, fitView, getViewport } = useReactFlow();
  const zoom = useStore(s => s.transform[2]);

  // FIX: Update the node state to include DrawingNodeData for the temporary drawing node.
  const [nodes, setNodes] = useState<Node<CollectionData | GroupData>[]>(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [isExportSidebarOpen, setIsExportSidebarOpen] = useState(false);
  const [exportedCode, setExportedCode] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [isRelationshipMode, setIsRelationshipMode] = useState(false);
  const [relationshipSourceId, setRelationshipSourceId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    node: Node | null;
    type: 'canvas' | 'node' | 'group';
  }>({ isOpen: false, position: null, node: null, type: 'canvas' });
  const [clipboard, setClipboard] = useState<Node<CollectionData> | null>(null);


  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
    
  const closeContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, position: null, node: null, type: 'canvas' });
  }, []);
  
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    setSelectedNodeIds(selectedNodes.map(n => n.id));
    if(selectedNodes.length === 1) {
      setSelectedNodeId(selectedNodes[0].id);
    } else {
      setSelectedNodeId(null);
    }
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Implement custom group resizing logic to prevent groups from becoming smaller than their content.
      setNodes((currentNodes) => {
        const processedChanges = changes.map(change => {
          // We are only interested in dimension changes for group nodes
          if (change.type === 'dimensions' && change.dimensions) {
            const node = currentNodes.find(n => n.id === change.id);

            if (node && node.type === 'groupNode') {
              const childNodes = currentNodes.filter(n => n.parentNode === change.id);

              if (childNodes.length > 0) {
                // Define a consistent padding around the child nodes within the group
                const PADDING = 25; 
                let maxX = 0;
                let maxY = 0;

                // Find the bottom-right extent of all child nodes
                childNodes.forEach(child => {
                  if (child.position && typeof child.width === 'number' && typeof child.height === 'number') {
                    maxX = Math.max(maxX, child.position.x + child.width);
                    maxY = Math.max(maxY, child.position.y + child.height);
                  }
                });

                // Calculate the minimum required dimensions to contain all children plus padding
                const minWidth = maxX + PADDING;
                const minHeight = maxY + PADDING;

                // Clamp the new dimensions from the resize event to our calculated minimums
                const newWidth = Math.max(change.dimensions.width, minWidth);
                const newHeight = Math.max(change.dimensions.height, minHeight);
                
                // If we had to adjust the dimensions, return a new change object. Otherwise, return the original.
                if (newWidth !== change.dimensions.width || newHeight !== change.dimensions.height) {
                    return {
                        ...change,
                        dimensions: { width: newWidth, height: newHeight },
                    };
                }
              }
            }
          }
          // For all other changes, return them as-is
          return change;
        });
        
        // Apply the (potentially modified) changes to the nodes
        return applyNodeChanges(processedChanges, currentNodes);
      });
    },
    [setNodes]
  );


  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removedEdgesChanges = changes.filter((change): change is { type: 'remove'; id: string } => change.type === 'remove');
    if (removedEdgesChanges.length > 0) {
      const removedEdgeIds = new Set(removedEdgesChanges.map(c => c.id));
      const removedEdgeObjects = edges.filter(e => removedEdgeIds.has(e.id));
      const remainingEdges = edges.filter(e => !removedEdgeIds.has(e.id));
      
      const parentChildUnlinks = new Map<string, { parentId: string, parentFieldId: string }>();
      for (const edge of removedEdgeObjects) {
          if (edge.data?.isParentChild && edge.source && edge.sourceHandle && edge.target) {
              const parentFieldId = edge.sourceHandle.split('-').slice(1, -1).join('-');
              parentChildUnlinks.set(edge.target, { parentId: edge.source, parentFieldId });
          }
      }

      setNodes(currentNodes => {
          let intermediateNodes = currentNodes;
          
          if (parentChildUnlinks.size > 0) {
              const parentIdsToUpdate = new Set(Array.from(parentChildUnlinks.values()).map(v => v.parentId));
              intermediateNodes = intermediateNodes.map(node => {
                  if (parentIdsToUpdate.has(node.id) && node.type === 'collectionNode') {
                      const updatedFields = (node.data as CollectionData).fields.map(f => {
                          const childIsUnlinked = Array.from(parentChildUnlinks.values()).some(v => v.parentId === node.id && v.parentFieldId === f.id);
                          if (childIsUnlinked) {
                              const { childCollectionId, ...rest } = f;
                              return rest;
                          }
                          return f;
                      });
                      return { ...node, data: { ...node.data, fields: updatedFields }};
                  }
                  return node;
              });
          }

          return intermediateNodes.map(node => {
            if (node.type !== 'collectionNode') return node;
            
            let collectionData = node.data as CollectionData;

            if (parentChildUnlinks.has(node.id)) {
                const { parentNode, ...restData } = collectionData;
                collectionData = restData;
            }
            
            const updatedFields = collectionData.fields.map(field => {
              if (!field.isForeignKey) return field;
              
              const fieldHandleId = `${node.id}-${field.id}`;
              const isStillTarget = remainingEdges.some(edge => edge.targetHandle && edge.targetHandle.startsWith(fieldHandleId));

              if (!isStillTarget) {
                return { ...field, isForeignKey: false, relatedCollection: null };
              }
              return field;
            });

            return { ...node, data: { ...collectionData, fields: updatedFields } };
          });
      });
    }

    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [edges, setNodes, setEdges]);

  const onConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) return;

    if (!sourceHandle.includes('source') || !targetHandle.includes('target')) return;
    if (source === target) return;

    const sourceNode = getNode(source);
    const targetNode = getNode(target);
    if (!sourceNode || sourceNode.type !== 'collectionNode' || !targetNode || targetNode.type !== 'collectionNode') return;

    const sourceCollectionData = sourceNode.data as CollectionData;
    if (sourceCollectionData.parentNode && sourceCollectionData.parentNode === target) {
      console.warn("Connection invalid: A child collection cannot create a foreign key reference to its parent.");
      return;
    }

    const sourceHandleParts = sourceHandle.split('-');
    const sourceFieldId = sourceHandleParts.slice(1, -1).join('-');
    const sourceField = (sourceNode.data as CollectionData).fields.find(f => f.id === sourceFieldId);

    if (!sourceField || sourceField.name !== '_id') {
      console.warn("Connection invalid: Relationships must originate from an `_id` field.");
      return;
    }

    const targetHandleParts = targetHandle.split('-');
    const targetFieldId = targetHandleParts.slice(1, -1).join('-');
    const targetField = (targetNode.data as CollectionData).fields.find(f => f.id === targetFieldId);

    if (!targetField) return;

    if (targetField.name === '_id' || targetField.type !== MongoDataType.ObjectId) {
      console.warn("Connection invalid: Target field must be of type 'ObjectId' and cannot be an `_id` field.");
      return;
    }
    
    const getFieldHandleBaseId = (handleId: string) => {
        const parts = handleId.split('-');
        parts.pop();
        return parts.join('-');
    };
    
    const targetFieldHandleBaseId = getFieldHandleBaseId(targetHandle);
    
    if (edges.some(edge => edge.targetHandle && edge.targetHandle.startsWith(targetFieldHandleBaseId))) {
      console.warn("Connection invalid: Target field is already used in another relationship.");
      return;
    }

    const newEdge: Edge = {
        id: `e-${sourceHandle}-${targetHandle}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: 'relationshipEdge',
        style: { stroke: '#ffffff', strokeWidth: 1.5 },
    };
    setEdges(eds => addEdge(newEdge, eds));
    
    const targetFieldIdOnly = targetFieldHandleBaseId.substring(target.length + 1);
    setNodes(nds => nds.map(node => {
      if (node.id === target && node.type === 'collectionNode') {
        const collectionData = node.data as CollectionData;
        const updatedFields = collectionData.fields.map(field => {
          if (field.id === targetFieldIdOnly) {
            return { ...field, isForeignKey: true, relatedCollection: source };
          }
          return field;
        });
        return { ...node, data: { ...collectionData, fields: updatedFields } };
      }
      return node;
    }));
  }, [getNode, edges, setNodes, setEdges]);
  
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      closeContextMenu();
      // Logic for dynamic edge handle switching
      const allNodes = getNodes();
      const updatedEdges = edges.map(edge => {
        if (edge.data?.isParentChild || !edge.sourceHandle || !edge.targetHandle) return edge;
        const sourceNode = allNodes.find(n => n.id === edge.source);
        const targetNode = allNodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode || !sourceNode.positionAbsolute || !targetNode.positionAbsolute || !sourceNode.width || !targetNode.width) return edge;
        
        const sourceHandlePrefix = edge.sourceHandle.slice(0, -1);
        const targetHandlePrefix = edge.targetHandle.slice(0, -1);
        const sourceNodeCenter = sourceNode.positionAbsolute.x + sourceNode.width / 2;
        const targetNodeCenter = targetNode.positionAbsolute.x + targetNode.width / 2;
        
        let newSourceHandle, newTargetHandle;
        if (sourceNodeCenter < targetNodeCenter) {
            newSourceHandle = `${sourceHandlePrefix}R`;
            newTargetHandle = `${targetHandlePrefix}L`;
        } else {
            newSourceHandle = `${sourceHandlePrefix}L`;
            newTargetHandle = `${targetHandlePrefix}R`;
        }

        if (newSourceHandle === edge.sourceHandle && newTargetHandle === edge.targetHandle) return edge;
        return { ...edge, sourceHandle: newSourceHandle, targetHandle: newTargetHandle };
      });
      if (JSON.stringify(edges) !== JSON.stringify(updatedEdges)) {
        setEdges(updatedEdges);
      }

      // New: Smart Grouping Highlighting Logic
      if (draggedNode.type !== 'collectionNode' || !draggedNode.width || !draggedNode.height || !draggedNode.positionAbsolute) {
        return;
      }
      const nodeCenter = {
        x: draggedNode.positionAbsolute.x + draggedNode.width / 2,
        y: draggedNode.positionAbsolute.y + draggedNode.height / 2,
      };

      const targetGroup = allNodes.find(
        (n): n is Node<GroupData> =>
          n.type === 'groupNode' && n.id !== draggedNode.id && n.positionAbsolute &&
          n.positionAbsolute.x <= nodeCenter.x &&
          nodeCenter.x <= n.positionAbsolute.x + (n.width || 0) &&
          n.positionAbsolute.y <= nodeCenter.y &&
          nodeCenter.y <= n.positionAbsolute.y + (n.height || 0)
      );

      setNodes(currentNodes => currentNodes.map(n => {
        if (n.type === 'groupNode') {
          const isTarget = n.id === targetGroup?.id && draggedNode.parentNode !== n.id;
          if ((n.data as GroupData).isDropTarget !== isTarget) {
            return { ...n, data: { ...(n.data as GroupData), isDropTarget: isTarget } };
          }
        }
        return n;
      }));
    }, [edges, getNodes, setEdges, setNodes, closeContextMenu]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      if (draggedNode.type !== 'collectionNode' || !draggedNode.width || !draggedNode.height || !draggedNode.positionAbsolute) {
        return;
      }
      const allNodes = getNodes();
      const nodeCenter = {
        x: draggedNode.positionAbsolute.x + draggedNode.width / 2,
        y: draggedNode.positionAbsolute.y + draggedNode.height / 2,
      };
  
      const targetGroup = allNodes.find(
        (n): n is Node<GroupData> =>
          n.type === 'groupNode' && n.id !== draggedNode.id && n.positionAbsolute &&
          n.positionAbsolute.x <= nodeCenter.x &&
          nodeCenter.x <= n.positionAbsolute.x + (n.width || 0) &&
          n.positionAbsolute.y <= nodeCenter.y &&
          nodeCenter.y <= n.positionAbsolute.y + (n.height || 0)
      );
  
      setNodes(currentNodes => {
        let needsUpdate = false;
        const nodesWithResetTargets = currentNodes.map(n => {
          if (n.type === 'groupNode' && (n.data as GroupData).isDropTarget) {
            needsUpdate = true;
            return { ...n, data: { ...(n.data as GroupData), isDropTarget: false } };
          }
          return n;
        });
  
        if (!needsUpdate && draggedNode.parentNode === targetGroup?.id) {
          return currentNodes; // No change needed
        }
  
        const baseNodes = needsUpdate ? nodesWithResetTargets : currentNodes;
  
        return baseNodes.map(n => {
          if (n.id === draggedNode.id) {
            const updatedNode = { ...n };
            if (targetGroup && targetGroup.positionAbsolute) {
              if (updatedNode.parentNode === targetGroup.id) return updatedNode;
  
              updatedNode.parentNode = targetGroup.id;
              updatedNode.position = {
                x: draggedNode.positionAbsolute.x - targetGroup.positionAbsolute.x,
                y: draggedNode.positionAbsolute.y - targetGroup.positionAbsolute.y,
              };
            } else if (updatedNode.parentNode) { // Dropped on canvas and had a parent
              delete updatedNode.parentNode;
              updatedNode.position = draggedNode.positionAbsolute;
            }
            return updatedNode;
          }
          return n;
        });
      });
    },
    [getNodes, setNodes]
  );
  
  const addCollection = useCallback((position: { x: number, y: number }) => {
    const newId = `node_${Date.now()}`;
    const allCollectionNames = new Set(
        nodes
            .filter(n => n.type === 'collectionNode')
            .map(n => (n.data as CollectionData).name)
    );

    let nextName = 'NewCollection';
    if (allCollectionNames.has(nextName)) {
      let counter = 1;
      while (allCollectionNames.has(`NewCollection${counter}`)) {
          counter++;
      }
      nextName = `NewCollection${counter}`;
    }
    
    const newNode: Node<CollectionData> = {
      id: newId,
      type: 'collectionNode',
      position,
      data: {
        id: newId,
        name: nextName,
        fields: [{ id: `f_${newId}_1`, name: '_id', type: MongoDataType.ObjectId, required: true, isForeignKey: false, relatedCollection: null }],
      },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newId);
  }, [nodes, setNodes]);

  const handleInitiateGroupDraw = useCallback(() => {
    setIsDrawingMode(prev => !prev);
    if(isRelationshipMode) setIsRelationshipMode(false);
  }, [isRelationshipMode]);

  const handleCreateGroupFromDraw = useCallback((rect: { x: number, y: number, width: number, height: number }) => {
    setIsDrawingMode(false); // Turn off drawing mode once done
    const allNodes = getNodes();

    const newGroupId = `group_draw_${Date.now()}`;
    
    const capturedNodes = allNodes.filter(n => {
        if (n.type !== 'collectionNode' || n.parentNode || !n.width || !n.height || !n.positionAbsolute) return false;
        const nodeCenterX = n.positionAbsolute.x + n.width / 2;
        const nodeCenterY = n.positionAbsolute.y + n.height / 2;
        return (
            nodeCenterX >= rect.x &&
            nodeCenterX <= rect.x + rect.width &&
            nodeCenterY >= rect.y &&
            nodeCenterY <= rect.y + rect.height
        );
    });

    let finalPosition = { x: rect.x, y: rect.y };
    let finalWidth = rect.width;
    let finalHeight = rect.height;
    
    if (capturedNodes.length > 0) {
        const padding = 50;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        capturedNodes.forEach(n => {
            minX = Math.min(minX, n.positionAbsolute!.x);
            minY = Math.min(minY, n.positionAbsolute!.y);
            maxX = Math.max(maxX, n.positionAbsolute!.x + n.width!);
            maxY = Math.max(maxY, n.positionAbsolute!.y + n.height!);
        });

        finalPosition = { x: minX - padding, y: minY - padding };
        finalWidth = (maxX - minX) + (padding * 2);
        finalHeight = (maxY - minY) + (padding * 2);
    }

    const existingColors = getNodes().filter(n => n.type === 'groupNode').map(n => (n.data as GroupData).color);
    const newColor = getNextGroupColor(existingColors);
    const newGroupName = getNextGroupName(getNodes());
    
    const newGroupNode: Node<GroupData> = {
        id: newGroupId,
        type: 'groupNode',
        position: finalPosition,
        data: { name: newGroupName, color: newColor },
        style: { width: finalWidth, height: finalHeight },
        zIndex: -1,
    };

    if (capturedNodes.length > 0) {
        const capturedNodeIds = new Set(capturedNodes.map(n => n.id));
        const updatedNodes = allNodes.map(node => {
            if (capturedNodeIds.has(node.id)) {
                return {
                    ...node,
                    parentNode: newGroupId,
                    position: {
                        x: node.position.x - finalPosition.x,
                        y: node.position.y - finalPosition.y,
                    }
                };
            }
            return node;
        });
        setNodes([...updatedNodes, newGroupNode]);
    } else {
        setNodes(nds => [...nds, newGroupNode]);
    }

  }, [getNodes, setNodes]);
  
  const addFieldToCollection = useCallback((nodeId: string, fieldData: Omit<Field, 'id' | 'isForeignKey' | 'relatedCollection'>) => {
    setNodes(nds => {
      return nds.map(n => {
        if (n.id === nodeId && n.type === 'collectionNode') {
          const newField: Field = {
            ...fieldData,
            id: `field_${Date.now()}`,
            isForeignKey: false,
            relatedCollection: null,
          };
          const collectionData = n.data as CollectionData;
          return { ...n, data: { ...collectionData, fields: [...collectionData.fields, newField] } };
        }
        return n;
      });
    });
  }, [setNodes]);

    const addFieldAndCreateSubCollection = useCallback((nodeId: string, fieldData: Omit<Field, 'id' | 'isForeignKey' | 'relatedCollection' | 'childCollectionId'>) => {
    const parentNode = getNode(nodeId) as Node<CollectionData> | undefined;
    if (!parentNode || fieldData.type !== MongoDataType.Object || !parentNode.positionAbsolute) return;

    const newFieldId = `field_${Date.now()}`;
    const newChildNodeId = `node_${Date.now() + 1}`;

    const newField: Field = {
        ...fieldData,
        id: newFieldId,
        isForeignKey: false,
        relatedCollection: null,
        childCollectionId: newChildNodeId,
    };

    const childNodeName = fieldData.name.charAt(0).toUpperCase() + fieldData.name.slice(1);
    
    const position = {
      x: parentNode.positionAbsolute.x + (parentNode.width || 300) + 150,
      y: parentNode.positionAbsolute.y,
    };
    
    const newChildNode: Node<CollectionData> = {
      id: newChildNodeId,
      type: 'collectionNode',
      position,
      data: {
        id: newChildNodeId,
        name: childNodeName,
        fields: [],
        parentNode: nodeId,
      },
    };

    const newEdge: Edge = {
      id: `e-${parentNode.id}-${newFieldId}-${newChildNodeId}`,
      source: nodeId,
      sourceHandle: `${nodeId}-${newFieldId}-sourceR`,
      target: newChildNodeId,
      targetHandle: null,
      type: 'bezier',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3' },
      style: { stroke: '#a3a3a3', strokeWidth: 1.5, strokeDasharray: '5 5' },
      data: { isParentChild: true },
    };

    setNodes(nds => {
      const updatedNodes = nds.map(n => {
        if (n.id === nodeId && n.type === 'collectionNode') {
          const collectionData = n.data as CollectionData;
          return { ...n, data: { ...collectionData, fields: [...collectionData.fields, newField] } };
        }
        return n;
      });
      return [...updatedNodes, newChildNode];
    });

    setEdges(eds => addEdge(newEdge, eds));
    setSelectedNodeId(newChildNodeId);
  }, [getNode, setNodes, setEdges]);

   const deleteNodes = useCallback((nodeIds: string[]) => {
    const allNodes = getNodes(); // Use the latest nodes from React Flow instance
    const nodesToDelete = new Set<string>(nodeIds);
    let collectionsToCheck: string[] = [...nodeIds];

    while (collectionsToCheck.length > 0) {
        const currentId = collectionsToCheck.pop()!;
        const currentNode = allNodes.find(n => n.id === currentId);
        if (currentNode) {
            if (currentNode.type === 'collectionNode') {
                const collectionData = currentNode.data as CollectionData;
                collectionData.fields.forEach(field => {
                    if (field.childCollectionId && !nodesToDelete.has(field.childCollectionId)) {
                        nodesToDelete.add(field.childCollectionId);
                        collectionsToCheck.push(field.childCollectionId);
                    }
                });
            } else if (currentNode.type === 'groupNode') {
                const children = allNodes.filter(n => n.parentNode === currentId);
                children.forEach(child => {
                    if (!nodesToDelete.has(child.id)) {
                        nodesToDelete.add(child.id);
                        collectionsToCheck.push(child.id);
                    }
                });
            }
        }
    }
    
    setNodes(currentNodes => {
      const remainingNodes = currentNodes.filter(node => !nodesToDelete.has(node.id));
      
      return remainingNodes.map(node => {
          if (node.type !== 'collectionNode') return node;

          const collectionData = node.data as CollectionData;
          let fieldsModified = false;
          
          const updatedFields = collectionData.fields.map(field => {
              if (field.isForeignKey && field.relatedCollection && nodesToDelete.has(field.relatedCollection)) {
                  fieldsModified = true;
                  return { ...field, isForeignKey: false, relatedCollection: null };
              }
              return field;
          });

          if (fieldsModified) {
              return { ...node, data: { ...collectionData, fields: updatedFields } };
          }
          return node;
      });
    });

    setEdges(eds => eds.filter(edge => !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)));

    const selectedStillExists = selectedNodeIds.some(id => !nodesToDelete.has(id));
    if (!selectedStillExists) {
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
    }
  }, [getNodes, selectedNodeIds, setNodes, setEdges]);
  
  const onNodesDelete = useCallback((nodes: Node[]) => {
    deleteNodes(nodes.map(n => n.id));
  }, [deleteNodes]);


  const initializeChildAndStartAddField = useCallback((parentNodeId: string, parentFieldId: string) => {
    const parentNode = getNode(parentNodeId) as Node<CollectionData> | undefined;
    if (!parentNode || !parentNode.positionAbsolute) return;

    const parentField = (parentNode.data as CollectionData).fields.find(f => f.id === parentFieldId);
    if (!parentField) return;

    const newId = `node_${Date.now()}`;
    const childNodeName = parentField.name.charAt(0).toUpperCase() + parentField.name.slice(1);
    
    const position = {
      x: parentNode.positionAbsolute.x + (parentNode.width || 300) + 150,
      y: parentNode.positionAbsolute.y,
    };
    
    const newNode: Node<CollectionData> = {
      id: newId,
      type: 'collectionNode',
      position,
      data: {
        id: newId,
        name: childNodeName,
        fields: [],
        parentNode: parentNodeId,
      },
    };

    const newEdge: Edge = {
      id: `e-${parentNode.id}-${parentField.id}-${newId}`,
      source: parentNodeId,
      sourceHandle: `${parentNodeId}-${parentFieldId}-sourceR`,
      target: newId,
      targetHandle: null,
      type: 'bezier',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3' },
      style: { stroke: '#a3a3a3', strokeWidth: 1.5, strokeDasharray: '5 5' },
      data: { isParentChild: true },
    };

    setNodes(nds => {
      const updatedNodes = nds.map(n => {
        if (n.id === parentNodeId && n.type === 'collectionNode') {
          const collectionData = n.data as CollectionData;
          const updatedFields = collectionData.fields.map(f => {
            if (f.id === parentFieldId) {
              return { ...f, childCollectionId: newId };
            }
            return f;
          });
          return { ...n, data: { ...collectionData, fields: updatedFields } };
        }
        return n;
      });
      return [...updatedNodes, newNode];
    });

    setEdges(eds => addEdge(newEdge, eds));
    setSelectedNodeId(newId);
  }, [getNode, setNodes, setEdges]);
  
  const updateFieldInCollection = useCallback((nodeId: string, fieldId: string, fieldData: Partial<Field>) => {
    let childIdToDelete: string | null = null;
    let shouldCreateChild = false;
    
    const nodeBeforeUpdate = getNodes().find(n => n.id === nodeId && n.type === 'collectionNode');
    if (nodeBeforeUpdate) {
      const collectionData = nodeBeforeUpdate.data as CollectionData;
      const currentField = collectionData.fields.find(f => f.id === fieldId);

      if (currentField) {
        if (currentField.type === MongoDataType.Object && fieldData.type && fieldData.type !== MongoDataType.Object && currentField.childCollectionId) {
          childIdToDelete = currentField.childCollectionId;
        }

        if (currentField.type !== MongoDataType.Object && fieldData.type === MongoDataType.Object) {
          shouldCreateChild = true;
        }
      }
    }

    setNodes(nds => nds.map(n => {
        if (n.id === nodeId && n.type === 'collectionNode') {
            const collectionData = n.data as CollectionData;
            const updatedFields = collectionData.fields.map(f => {
                if (f.id === fieldId) {
                    const updatedField = { ...f, ...fieldData };
                    if (childIdToDelete) {
                        delete updatedField.childCollectionId;
                    }
                    return updatedField;
                }
                return f;
            });
            return { ...n, data: { ...collectionData, fields: updatedFields } };
        }
        return n;
    }));

    if (childIdToDelete) {
      deleteNodes([childIdToDelete]);
    }
    if (shouldCreateChild) {
      initializeChildAndStartAddField(nodeId, fieldId);
    }
  }, [getNodes, setNodes, deleteNodes, initializeChildAndStartAddField]);

  const removeFieldFromCollection = useCallback((nodeId: string, fieldId: string) => {
    let childCollectionId: string | null = null;
    const parentNode = getNodes().find(n => n.id === nodeId);
    if (parentNode && parentNode.type === 'collectionNode') {
      const field = (parentNode.data as CollectionData).fields.find(f => f.id === fieldId);
      if (field && field.childCollectionId) {
        childCollectionId = field.childCollectionId;
      }
    }

    setNodes(nds => nds.map(n => {
      if (n.id === nodeId && n.type === 'collectionNode') {
        const collectionData = n.data as CollectionData;
        const updatedFields = collectionData.fields.filter(f => f.id !== fieldId);
        return { ...n, data: { ...collectionData, fields: updatedFields } };
      }
      return n;
    }));

    if (childCollectionId) {
        deleteNodes([childCollectionId]);
    }
  }, [getNodes, setNodes, deleteNodes]);

  const updateNodeData = useCallback((id: string, data: Partial<CollectionData | GroupData>) => {
    setNodes(nds => nds.map(n => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
  }, [setNodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (type !== 'collectionNode' || !editorContainerRef.current) return;

      const editorBounds = editorContainerRef.current.getBoundingClientRect();
      const position = project({
        x: event.clientX - editorBounds.left,
        y: event.clientY - editorBounds.top,
      });
      
      addCollection(position);
    },
    [project, addCollection]
  );
  
  const cancelRelationshipMode = useCallback(() => {
    setIsRelationshipMode(false);
    setRelationshipSourceId(null);
    setNodes(nds =>
      nds.map(n => {
        // FIX: Check if the node is a collectionNode before accessing collection-specific properties.
        if (n.type === 'collectionNode' && (n.data as CollectionData).isRelationshipSource) {
          const { isRelationshipSource, ...restData } = n.data as CollectionData;
          return { ...n, data: restData };
        }
        return n;
      })
    );
  }, []);

  const handleToggleRelationshipMode = useCallback(() => {
    if (isRelationshipMode) {
      cancelRelationshipMode();
    } else {
      setIsRelationshipMode(true);
      if(isDrawingMode) setIsDrawingMode(false);
    }
  }, [isRelationshipMode, isDrawingMode, cancelRelationshipMode]);
  
  const generateFkFieldName = (name: string): string => {
    // Convert snake_case to camelCase first, e.g., 'blog_posts' -> 'blogPosts'
    let finalName = name.replace(/_([a-z])/g, g => g[1].toUpperCase());
    
    // A simple singularization heuristic to produce cleaner names like 'user' from 'users'.
    // Avoids changing names ending in 'ss' like 'address' or 'status'.
    if (finalName.length > 2 && finalName.endsWith('s') && !finalName.endsWith('ss')) {
        finalName = finalName.slice(0, -1);
    }

    // Ensure the final name is in camelCase (first letter is lowercase)
    return finalName.charAt(0).toLowerCase() + finalName.slice(1);
  };

  const createRelationship = useCallback((sourceId: string, targetId: string) => {
      const sourceNode = getNode(sourceId) as Node<CollectionData>;
      const targetNode = getNode(targetId) as Node<CollectionData>;
      
      if (!sourceNode || !targetNode || !sourceNode.positionAbsolute || !targetNode.positionAbsolute || !sourceNode.width || !targetNode.width) return;

      const newFieldName = generateFkFieldName(sourceNode.data.name);
      
      if (targetNode.data.fields.some(f => f.name === newFieldName)) {
        alert(`Field "${newFieldName}" already exists in "${targetNode.data.name}". Cannot create relationship.`);
        return;
      }
      
      const newFieldId = `field_${Date.now()}`;
      const newField: Field = {
        id: newFieldId,
        name: newFieldName,
        type: MongoDataType.ObjectId,
        required: true,
        isForeignKey: true,
        relatedCollection: sourceId,
      };

      setNodes(nds =>
        nds.map(n => {
          if (n.id === targetId) {
            const collectionData = n.data as CollectionData;
            return { ...n, data: { ...collectionData, fields: [...collectionData.fields, newField] } };
          }
          return n;
        })
      );

      const sourceField = sourceNode.data.fields.find(f => f.name === '_id');
      if (!sourceField) return;

      const sourceHandlePrefix = `${sourceNode.id}-${sourceField.id}`;
      const targetHandlePrefix = `${targetNode.id}-${newFieldId}`;
      const sourceNodeCenter = sourceNode.positionAbsolute.x + sourceNode.width / 2;
      const targetNodeCenter = targetNode.positionAbsolute.x + targetNode.width / 2;
      
      let sourceHandle, targetHandle;
      if (sourceNodeCenter < targetNodeCenter) {
          sourceHandle = `${sourceHandlePrefix}-sourceR`;
          targetHandle = `${targetHandlePrefix}-targetL`;
      } else {
          sourceHandle = `${sourceHandlePrefix}-sourceL`;
          targetHandle = `${targetHandlePrefix}-targetR`;
      }

      const newEdge: Edge = {
        id: `e-${sourceId}-${targetId}-${newFieldId}`,
        source: sourceId,
        target: targetId,
        sourceHandle,
        targetHandle,
        type: 'relationshipEdge',
        style: { stroke: '#ffffff', strokeWidth: 1.5 },
      };

      setEdges(eds => addEdge(newEdge, eds));
    }, [getNode, setNodes, setEdges]
  );
  
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isDrawingMode) setIsDrawingMode(false);
        if (isRelationshipMode) cancelRelationshipMode();
        if (contextMenu.isOpen) closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDrawingMode, isRelationshipMode, cancelRelationshipMode, contextMenu.isOpen, closeContextMenu]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    closeContextMenu();

    if (isRelationshipMode) {
      if (node.type !== 'collectionNode') {
        cancelRelationshipMode();
        return;
      }

      if (!relationshipSourceId) {
        setRelationshipSourceId(node.id);
        setNodes(nds =>
          nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, isRelationshipSource: true } } : n)
        );
      } else if (relationshipSourceId !== node.id) {
        createRelationship(relationshipSourceId, node.id);
        cancelRelationshipMode();
      }
      return;
    }

    // set selected node is handled by onSelectionChange
    setIsExportSidebarOpen(false);
  }, [isRelationshipMode, relationshipSourceId, createRelationship, cancelRelationshipMode, closeContextMenu]);

  const onPaneClick = useCallback(() => {
    if (isRelationshipMode) {
      cancelRelationshipMode();
      return;
    }
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setIsExportSidebarOpen(false);
    closeContextMenu();
  }, [isRelationshipMode, cancelRelationshipMode, closeContextMenu]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    closeContextMenu();
    setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        node: null,
        type: 'canvas',
    });
  }, [closeContextMenu]);
  
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    closeContextMenu();
    setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        node,
        type: node.type === 'groupNode' ? 'group' : 'node',
    });
  }, [closeContextMenu]);

  const handleUngroup = useCallback((groupId: string) => {
    const groupNode = getNodes().find(n => n.id === groupId);
    if (!groupNode || groupNode.type !== 'groupNode') return;

    const nodesToUpdate = getNodes().filter(n => n.parentNode === groupId);
    const nodeIdsToUpdate = new Set(nodesToUpdate.map(n => n.id));

    setNodes(currentNodes => {
        const updatedNodes = currentNodes.map(n => {
            if (nodeIdsToUpdate.has(n.id) && n.positionAbsolute) {
                const { parentNode, ...restOfNode } = n;
                return { ...restOfNode, position: n.positionAbsolute };
            }
            return n;
        });
        return updatedNodes.filter(n => n.id !== groupId);
    });
    setSelectedNodeIds([]);
  }, [getNodes, setNodes]);

  const handleCopyNode = useCallback(() => {
    if (selectedNodeIds.length !== 1) return;
    const nodeToCopy = getNode(selectedNodeIds[0]);
    if (nodeToCopy && nodeToCopy.type === 'collectionNode') {
      setClipboard(nodeToCopy as Node<CollectionData>);
    }
  }, [selectedNodeIds, getNode]);

  const handleDuplicateNode = useCallback(() => {
    if (selectedNodeIds.length !== 1) return;
    const nodeToDuplicate = getNode(selectedNodeIds[0]);

    if (nodeToDuplicate && nodeToDuplicate.type === 'collectionNode') {
      const now = Date.now();
      const newId = `node_${now}`;
      
      const newData = JSON.parse(JSON.stringify(nodeToDuplicate.data)) as CollectionData;
      newData.id = newId;
      newData.fields.forEach((field, i) => {
          field.id = `f_${newId}_${i+1}`;
          field.isForeignKey = false;
          field.relatedCollection = null;
          delete field.childCollectionId;
      });
      delete newData.parentNode;

      const newNode: Node<CollectionData> = {
        id: newId,
        type: 'collectionNode',
        position: {
          x: nodeToDuplicate.position.x + 40,
          y: nodeToDuplicate.position.y + 40,
        },
        data: newData,
      };
      setNodes(nds => [...nds, newNode]);
    }
  }, [selectedNodeIds, getNode, setNodes]);

  const handlePaste = useCallback((position?: { x: number, y: number }) => {
    if (!clipboard) return;

    let pastePosition = position;
    if (!pastePosition) {
        if(editorContainerRef.current) {
            const { x, y, zoom } = getViewport();
            const { width, height } = editorContainerRef.current.getBoundingClientRect();
            pastePosition = {
                x: -x / zoom + width / (2 * zoom),
                y: -y / zoom + height / (2 * zoom),
            };
        } else {
            return;
        }
    }
    
    const now = Date.now();
    const newId = `node_${now}`;
    
    const dataToPaste = JSON.parse(JSON.stringify(clipboard.data)) as CollectionData;
    dataToPaste.id = newId;
    dataToPaste.fields.forEach((field, i) => {
        field.id = `f_${newId}_${i+1}`;
        field.isForeignKey = false;
        field.relatedCollection = null;
        delete field.childCollectionId;
    });
    delete dataToPaste.parentNode;

    const newNode: Node<CollectionData> = {
        id: newId,
        type: 'collectionNode',
        position: pastePosition,
        data: dataToPaste,
    };
    setNodes(nds => [...nds, newNode]);
  }, [clipboard, setNodes, getViewport]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? event.metaKey : event.ctrlKey;
      const isTyping =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;

      if (isModifier) {
        switch (event.key.toLowerCase()) {
          case 'c':
            handleCopyNode();
            break;
          case 'v':
            handlePaste();
            break;
          case 'd':
            event.preventDefault();
            handleDuplicateNode();
            break;
        }
      } else if (!isTyping) {
        // Handle single-key shortcuts only when not typing
        switch (event.key.toLowerCase()) {
          case 'g':
            event.preventDefault();
            handleInitiateGroupDraw();
            break;
          case 'l':
            event.preventDefault();
            handleToggleRelationshipMode();
            break;
          case 'f7':
            const selectedGroupNodes = selectedNodeIds
              .map(id => getNode(id))
              .filter((node): node is Node<GroupData> => !!node && node.type === 'groupNode');
            
            if (selectedGroupNodes.length > 0) {
              event.preventDefault();
              selectedGroupNodes.forEach(node => handleUngroup(node.id));
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeIds, getNode, handleUngroup, handleCopyNode, handlePaste, handleDuplicateNode, handleInitiateGroupDraw, handleToggleRelationshipMode]);
  
  const contextMenuItems = useMemo((): MenuItem[] => {
    if (!contextMenu.isOpen || !contextMenu.position) return [];
    
    switch(contextMenu.type) {
        case 'canvas':
            return [
                { label: 'Add Collection', icon: <HiPlus />, onClick: () => addCollection(project(contextMenu.position!)) },
                { label: 'Paste', icon: <HiOutlineClipboard />, onClick: clipboard ? () => handlePaste(project(contextMenu.position!)) : undefined, shortcut: 'Ctrl+V' },
            ];
        case 'node':
            return [
                { label: 'Copy', icon: <HiOutlineClipboard />, onClick: handleCopyNode, shortcut: 'Ctrl+C' },
                { label: 'Duplicate', icon: <HiOutlineDocumentDuplicate />, onClick: handleDuplicateNode, shortcut: 'Ctrl+D' },
                { type: 'divider' },
                { label: 'Delete', icon: <HiOutlineTrash />, onClick: () => contextMenu.node && deleteNodes([contextMenu.node.id]), shortcut: 'Backspace', className: 'text-rose-400 hover:bg-rose-500/10' },
            ];
        case 'group':
            return [
                { label: 'Ungroup', icon: <HiOutlineScissors />, onClick: () => contextMenu.node && handleUngroup(contextMenu.node.id), shortcut: 'Ctrl+F7' },
                { type: 'divider' },
                { label: 'Delete Group', icon: <HiOutlineTrash />, onClick: () => contextMenu.node && deleteNodes([contextMenu.node.id]), shortcut: 'Backspace', className: 'text-rose-400 hover:bg-rose-500/10' },
            ];
        default:
            return [];
    }
}, [contextMenu, addCollection, project, clipboard, handlePaste, handleCopyNode, handleDuplicateNode, deleteNodes, handleUngroup]);


  const { explorerItems, totalCollections } = useMemo(() => {
    const groupsMap = new Map<string, { id: string; name: string; children: ExplorerCollectionData[] }>();
    const standaloneCollections: ExplorerCollectionData[] = [];
    let collectionCount = 0;

    // First pass: find all groups
    nodes.forEach(node => {
      if (node.type === 'groupNode') {
        const groupData = node.data as GroupData;
        groupsMap.set(node.id, { id: node.id, name: groupData.name, children: [] });
      }
    });

    // Second pass: find all collections and assign them to their visual group
    nodes.forEach(node => {
      if (node.type === 'collectionNode') {
        collectionCount++;
        const collectionData = node.data as CollectionData;
        const explorerData: ExplorerCollectionData = { ...collectionData };

        // FIX: Check the top-level `node.parentNode` for visual grouping, not `collectionData.parentNode`.
        if (node.parentNode && groupsMap.has(node.parentNode)) {
          groupsMap.get(node.parentNode)!.children.push(explorerData);
        } else {
          standaloneCollections.push(explorerData);
        }
      }
    });

    // Sort children within groups alphabetically
    groupsMap.forEach(group => {
        group.children.sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Sort standalone collections alphabetically
    standaloneCollections.sort((a, b) => a.name.localeCompare(b.name));

    const finalItems: ExplorerItem[] = [];

    // Add sorted groups to the final list
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    sortedGroups.forEach(group => {
      finalItems.push({ type: 'group', ...group });
    });
    
    // Add sorted standalone collections to the final list
    standaloneCollections.forEach(collection => {
      finalItems.push({ type: 'collection', data: collection });
    });

    return { explorerItems: finalItems, totalCollections: collectionCount };
  }, [nodes]);

  const handleGenerateSchema = useCallback(async (prompt: string) => {
    setIsGeneratingSchema(true);

    const existingNodes = getNodes();
    let maxX = 0;
    let minY = Infinity;
    if (existingNodes.length > 0) {
        existingNodes.forEach(n => {
            if (!n.parentNode) {
                maxX = Math.max(maxX, n.position.x + (n.width || 300));
                minY = Math.min(minY, n.position.y);
            }
        });
    } else {
        minY = 100;
    }
    
    const containerPosition = { x: maxX === 0 ? 100 : maxX + 150, y: minY };
    const containerGroupId = `ai_container_${Date.now()}`;
    const loadingGroupNode: Node<GroupData> = {
      id: containerGroupId,
      type: 'groupNode',
      position: containerPosition,
      data: {
        name: 'AI Generation in Progress...',
        color: 'Gray',
        isLoading: true,
      },
      style: { width: 400, height: 250 },
      zIndex: -10,
    };
    setNodes(nds => [...nds, loadingGroupNode]);
    setTimeout(() => fitView({ nodes: [{ id: containerGroupId }], duration: 600, padding: 1.0 }), 100);


    try {
        const ai = new GoogleGenAI({ apiKey: 'AIzaSyCJ2QiUevbnmbKtGondT8fASvs1k6zF51w' });
       

          const schemaDefinition = {
            type: Type.OBJECT,
            properties: {
                schemaName: { type: Type.STRING, description: "A short, descriptive title for the schema (e.g., 'E-commerce Schema')." },
                collections: {
                    type: Type.ARRAY,
                    description: "List of all database collections.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "The name of the collection, plural and in snake_case. e.g., 'users', 'blog_posts'." },
                            icon: { type: Type.STRING, description: "An appropriate icon name for the collection from the 'Hero-Icons 2 Outline' library. The name should be in PascalCase, e.g., 'HiUserGroup', 'HiShoppingCart', 'HiDocumentText'." },
                            fields: {
                                type: Type.ARRAY,
                                description: "List of fields for this collection.",
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING, description: "The name of the field, in camelCase. e.g., 'userName', 'createdAt'. Must include '_id' as the first field." },
                                        type: { type: Type.STRING, description: "The data type of the field.", enum: Object.values(MongoDataType) },
                                        required: { type: Type.BOOLEAN, description: "Whether this field is required." },
                                        childCollectionName: { type: Type.STRING, description: "ONLY if type is 'Object', this is the name of the new child collection this field represents. The child collection must also be defined in the main 'collections' array." }
                                    },
                                    required: ["name", "type", "required"]
                                }
                            }
                        },
                        required: ["name", "fields"]
                    }
                },
                relationships: {
                    type: Type.ARRAY,
                    description: "List of relationships between collections, representing foreign keys. Do not use this for parent-child Object relationships.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            fromCollection: { type: Type.STRING, description: "The name of the collection where the relationship originates (the 'one' side)." },
                            fromField: { type: Type.STRING, description: "The primary key field, which must always be '_id'." },
                            toCollection: { type: Type.STRING, description: "The name of the collection that contains the foreign key (the 'many' side)." },
                            toField: { type: Type.STRING, description: "The foreign key field in the 'to' collection." }
                        },
                        required: ["fromCollection", "fromField", "toCollection", "toField"]
                    }
                }
            },
            required: ["schemaName", "collections"]
        };
        
        const systemInstruction = `You are a MongoDB database schema design expert. Your task is to generate a complete and logical schema based on the user's description.
- For each collection, you MUST select an appropriate icon from the 'Hero-Icons 2 Outline' library. The icon name MUST be in PascalCase and start with 'Hi', for example: 'HiUserGroup' for users, 'HiShoppingCart' for products, 'HiDocumentText' for posts, 'HiChatBubbleLeftRight' for comments.
- You must provide a short, descriptive 'schemaName' for the entire schema.
- If a field's type is 'Object', it represents a nested sub-collection. You MUST create a separate collection definition for this sub-collection.
- Then, on the parent field of type 'Object', you MUST set the 'childCollectionName' property to the name of that new child collection.
- Do NOT use the 'relationships' array for these parent-child Object links. Use 'relationships' only for standard foreign key references between top-level collections.
- Do not create logical groups for the collections. All generated collections should be independent.
- You must return the response as a single, valid JSON object that adheres to the provided schema. Do not include any markdown formatting or explanatory text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: `Generate a MongoDB schema for the following description: ${prompt}`,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schemaDefinition,
            },
        });

        const schemaData: {
            schemaName: string;
            collections: { name: string; icon?: string; fields: any[] }[];
            relationships?: { fromCollection: string; toCollection: string; fromField: string; toField: string }[];
        } = JSON.parse(response.text);
        const { schemaName, collections, relationships = [] } = schemaData;
        
        const estimateNodeWidth = (collection: { name: string, fields: any[] }): number => {
            const BASE_PADDING = 60; 
            const CHAR_WIDTH = 8;
            const MIN_WIDTH = 280;
            const MAX_WIDTH = 500;
        
            let maxContentChars = collection.name.length * 1.1; // *1.1 for bold font weight
        
            collection.fields.forEach(field => {
                let typeStr = field.type;
                const rel = relationships.find(r => r.toCollection === collection.name && r.toField === field.name);
        
                if (rel) {
                    typeStr = `ObjectId(${rel.fromCollection})`;
                }
                
                // Estimate combined length of name + type + space between them
                const rowChars = field.name.length + typeStr.length + 3; // +3 for spacing
                if (rowChars > maxContentChars) {
                    maxContentChars = rowChars;
                }
            });
        
            const estimatedWidth = (maxContentChars * CHAR_WIDTH) + BASE_PADDING;
            return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, estimatedWidth));
        };

        const now = Date.now();
        const collectionNameToId: Record<string, string> = {};
        collections.forEach((c, i: number) => {
            collectionNameToId[c.name] = `ai_node_${now}_${i}`;
        });
        
        const initialCollectionNodes: Node<CollectionData>[] = collections.map((collection) => {
            const newId = collectionNameToId[collection.name];
            return {
                id: newId,
                type: 'collectionNode',
                position: { x: 0, y: 0 },
                data: {
                    id: newId,
                    name: collection.name,
                    icon: collection.icon,
                    fields: collection.fields.map((f: any, idx: number) => ({
                        ...f,
                        id: `f_${newId}_${idx}`,
                        isForeignKey: false,
                        relatedCollection: null,
                    })),
                },
                width: estimateNodeWidth(collection),
            };
        });

        const collectionNodeMap = new Map<string, Node<CollectionData>>(initialCollectionNodes.map(n => [n.id, n]));
        
        const allEdges: Edge[] = [];
        
        initialCollectionNodes.forEach(node => {
            node.data.fields.forEach(field => {
                if (field.type === MongoDataType.Object && (field as any).childCollectionName) {
                    const childId = collectionNameToId[(field as any).childCollectionName];
                    if (childId) {
                        field.childCollectionId = childId;
                        const childNode = collectionNodeMap.get(childId);
                        if (childNode) (childNode.data as CollectionData).parentNode = node.id;
                        
                        allEdges.push({
                            id: `e-${node.id}-${field.id}-${childId}`,
                            source: node.id,
                            sourceHandle: `${node.id}-${field.id}-source`, // Temp handle
                            target: childId,
                            targetHandle: null,
                            type: 'bezier',
                            markerEnd: { type: MarkerType.ArrowClosed, color: '#a3a3a3' },
                            style: { stroke: '#a3a3a3', strokeWidth: 1.5, strokeDasharray: '5 5' },
                            data: { isParentChild: true },
                        });
                    }
                }
            });
        });
        
        relationships.forEach((rel) => {
            const sourceId = collectionNameToId[rel.fromCollection];
            const targetId = collectionNameToId[rel.toCollection];
            const sourceNode = collectionNodeMap.get(sourceId);
            const targetNode = collectionNodeMap.get(targetId);
            if (sourceNode && targetNode) {
                const sourceField = sourceNode.data.fields.find(f => f.name === rel.fromField);
                const targetField = targetNode.data.fields.find(f => f.name === rel.toField);
                if (sourceField && targetField) {
                    targetField.isForeignKey = true;
                    targetField.relatedCollection = sourceId;
                    allEdges.push({
                        id: `e_${sourceId}_${targetId}_${targetField.id}`,
                        source: sourceId,
                        target: targetId,
                        type: 'relationshipEdge',
                        sourceHandle: `${sourceId}-${sourceField.id}-source`, // Temp handle
                        targetHandle: `${targetId}-${targetField.id}-target`, // Temp handle
                        style: { stroke: '#ffffff', strokeWidth: 1.5 },
                    });
                }
            }
        });

        const g = new dagre.graphlib.Graph({ compound: false });
        g.setGraph({ 
            rankdir: 'LR',
            align: 'UL',
            nodesep: 80,
            ranksep: 120,
            marginx: 0,
            marginy: 0,
        });
        g.setDefaultEdgeLabel(() => ({}));

        const estimateHeight = (nodeData: CollectionData) => 40 + (nodeData.fields.length * 37);
        
        initialCollectionNodes.forEach(node => {
            g.setNode(node.id, {
                width: node.width,
                height: estimateHeight(node.data),
                label: node.data.name,
            });
        });

        allEdges.forEach(edge => {
            g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);

        const newNodes: Node<CollectionData>[] = [];
        const padding = 50;

        initialCollectionNodes.forEach(node => {
            const dagreNode = g.node(node.id);
            if (dagreNode) {
                node.position = { 
                    x: dagreNode.x - dagreNode.width! / 2, 
                    y: dagreNode.y - dagreNode.height / 2 
                };
                node.parentNode = containerGroupId;
                newNodes.push(node);
            }
        });
        
        newNodes.forEach(node => {
            node.position.x += padding;
            node.position.y += padding;
        });

        const finalEdges = allEdges.map(edge => {
            const sourceNodeLayout = g.node(edge.source);
            const targetNodeLayout = g.node(edge.target);

            if (!sourceNodeLayout || !targetNodeLayout) return edge;

            const sourceHandlePrefix = edge.sourceHandle!.slice(0, -7); // remove '-source'
            
            if (edge.data?.isParentChild) {
                return { ...edge, sourceHandle: `${sourceHandlePrefix}-sourceR` };
            }

            const targetHandlePrefix = edge.targetHandle!.slice(0, -7); // remove '-target'
            
            let newSourceHandle, newTargetHandle;
            if (sourceNodeLayout.x < targetNodeLayout.x) {
                newSourceHandle = `${sourceHandlePrefix}-sourceR`;
                newTargetHandle = `${targetHandlePrefix}-targetL`;
            } else {
                newSourceHandle = `${sourceHandlePrefix}-sourceL`;
                newTargetHandle = `${targetHandlePrefix}-targetR`;
            }
            return { ...edge, sourceHandle: newSourceHandle, targetHandle: newTargetHandle };
        });

        const graphWidth = g.graph().width || 400;
        const graphHeight = g.graph().height || 250;
        
        setNodes(nds => nds.map(n => {
            if (n.id === containerGroupId) {
                return {
                    ...n,
                    style: { width: graphWidth + padding * 2, height: graphHeight + padding * 2 },
                    data: {
                        ...n.data,
                        name: `AI: ${schemaName}`,
                        isLoading: false,
                    }
                }
            }
            return n;
        }));
        
        // Zoom out to see the whole generation area before nodes start appearing
        setTimeout(() => fitView({ nodes: [{ id: containerGroupId }], duration: 600, padding: 0.2 }), 100);

        const nodeDelay = 100;
        const edgeDelay = 100;
        
        newNodes.sort((a, b) => (a.type === 'groupNode' ? -1 : 1));

        newNodes.forEach((node, i) => {
            setTimeout(() => setNodes(nds => [...nds, node]), (i + 1) * nodeDelay);
        });

        const totalNodeTime = newNodes.length * nodeDelay;
        finalEdges.forEach((edge, i) => {
            setTimeout(() => setEdges(eds => addEdge(edge, eds)), totalNodeTime + (i + 1) * edgeDelay);
        });

        const totalEdgeTime = finalEdges.length * edgeDelay;
        const totalRenderTime = totalNodeTime + totalEdgeTime;
        const allNewNodeIds = [containerGroupId, ...newNodes.map(n => n.id)];

        setTimeout(() => fitView({ nodes: allNewNodeIds.map(id => ({ id })), duration: 800, padding: 0.4 }), totalRenderTime + 300);

        setTimeout(() => {
            setIsGeneratingSchema(false);
            setIsAiSidebarOpen(false);
        }, totalRenderTime + 1100);

    } catch (error) {
        console.error("Error generating schema:", error);
        alert("An error occurred while generating the schema. Please check the console for details.");
        setNodes(nds => nds.filter(n => n.id !== containerGroupId));
        setIsGeneratingSchema(false);
    }
  }, [getNodes, setNodes, setEdges, fitView]);

  const handleInitiateExport = useCallback(() => {
    if (isExporting) return;

    setIsExporting(true);
    setExportedCode('');
    setSelectedNodeId(null); 

    try {
        const collectionNodes = nodes.filter((n): n is Node<CollectionData> => n.type === 'collectionNode');
        const code = generateMongooseCode(collectionNodes);
        setExportedCode(code);
        setIsExportSidebarOpen(true);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to generate code:", error);
        setExportedCode(`// An error occurred while generating the code.\n// Please check the console for more details.\n\n${errorMessage}`);
        setIsExportSidebarOpen(true);
    } finally {
        // Use a short timeout to give the user feedback that something happened, even though it's instant.
        setTimeout(() => setIsExporting(false), 300);
    }
  }, [isExporting, nodes]);
  
  const handleCanvasAction = useCallback(() => {
    closeContextMenu();
  }, [closeContextMenu]);

  return (
    <div className="w-screen h-screen flex flex-col">
        <Header 
            onToggleAiSidebar={() => setIsAiSidebarOpen(prev => !prev)}
            onInitiateExport={handleInitiateExport}
            isExporting={isExporting}
            isDrawingGroup={isDrawingMode}
            onInitiateGroupDraw={handleInitiateGroupDraw}
            isRelationshipMode={isRelationshipMode}
            onToggleRelationshipMode={handleToggleRelationshipMode}
            zoomLevel={zoom}
        />
        <div className="flex-grow flex flex-row relative overflow-hidden">
            <AiSidebar 
                isOpen={isAiSidebarOpen} 
                isGenerating={isGeneratingSchema}
                onClose={() => setIsAiSidebarOpen(false)}
                onGenerate={handleGenerateSchema}
            />
            <ExplorerSidebar items={explorerItems} totalCollections={totalCollections} />
            <div className="flex-grow h-full" ref={editorContainerRef}>
                <SchemaEditor
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onDrop={onDrop}
                    updateNode={updateNodeData}
                    onNodeDrag={onNodeDrag}
                    onNodeDragStop={onNodeDragStop}
                    onSelectionChange={onSelectionChange}
                    onMove={handleCanvasAction}
                    onConnectStart={handleCanvasAction}
                    isDrawingMode={isDrawingMode}
                    isRelationshipMode={isRelationshipMode}
                    onCreateGroupFromDraw={handleCreateGroupFromDraw}
                    onPaneContextMenu={onPaneContextMenu}
                    onNodeContextMenu={onNodeContextMenu}
                    onNodesDelete={onNodesDelete}
                    
                />
            </div>
            
            {isExportSidebarOpen && (
                <ExportSidebar
                    isOpen={isExportSidebarOpen}
                    onClose={() => setIsExportSidebarOpen(false)}
                    code={exportedCode}
                />
            )}
            
            <PropertiesSidebar 
                selectedNode={selectedNode} 
                nodes={nodes}
                updateNode={updateNodeData}
                deleteNode={(id) => deleteNodes([id])}
                addFieldToCollection={addFieldToCollection}
                addFieldAndCreateSubCollection={addFieldAndCreateSubCollection}
                updateFieldInCollection={updateFieldInCollection}
                removeFieldFromCollection={removeFieldFromCollection}
                initializeChildAndStartAddField={initializeChildAndStartAddField}
            />

             {contextMenu.isOpen && contextMenu.position && (
                <ContextMenu
                    items={contextMenuItems}
                    top={contextMenu.position.y}
                    left={contextMenu.position.x}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    </div>
  );
}

export default function App() {
    return (
        <ReactFlowProvider>
            <AppContent />
        </ReactFlowProvider>
    );
}
