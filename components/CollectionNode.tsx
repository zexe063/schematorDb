

import React, { memo, useMemo } from 'react';
// FIX: Corrected reactflow imports for v11+
import { Handle, Position, useNodes, useStore, useEdges } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { CollectionData, DataTypeColors, GroupData, MongoDataType } from '../types';
import { HiOutlineKey } from 'react-icons/hi2';
import * as Hi2Icons from 'react-icons/hi2';

const FieldRow: React.FC<{ field: CollectionData['fields'][0]; nodeId: string; }> = ({ field, nodeId }) => {
    const allNodes = useNodes<CollectionData | GroupData>();
    const edges = useEdges();
    // A field's handleId must be unique within the node
    const handleId = `${nodeId}-${field.id}`;

    // Fix: Updated useStore to be compatible with React Flow v11+
    const { isConnecting, connectionStartHandle } = useStore(s => ({
        isConnecting: !!s.connectionNodeId,
        connectionStartHandle: s.connectionNodeId && s.connectionHandleId ? {
            nodeId: s.connectionNodeId,
            handleId: s.connectionHandleId,
        } : null,
    }));
    
    const validationStatus = useMemo(() => {
        if (!isConnecting || !connectionStartHandle) return 'default';
        
        const sourceNodeId = connectionStartHandle.nodeId;
        const sourceHandleId = connectionStartHandle.handleId;

        if (!sourceNodeId || !sourceHandleId) return 'default';

        const sourceNode = allNodes.find(n => n.id === sourceNodeId);
        if (!sourceNode || sourceNode.type !== 'collectionNode') return 'invalid';

        const sourceHandleParts = sourceHandleId.split('-');
        const sourceFieldId = sourceHandleParts.slice(1, -1).join('-');
        const sourceField = (sourceNode.data as CollectionData).fields.find(f => f.id === sourceFieldId);

        // Rule 1: Connection must start from an `_id` field.
        if (!sourceField || sourceField.name !== '_id') {
            return 'invalid';
        }
        
        // We are now validating the *current* field in this FieldRow as a potential target.
        
        // Rule 2: Cannot connect to self.
        if (nodeId === sourceNodeId) {
            return 'invalid';
        }
        
        // Rule 3: A child collection cannot create a reference back to its parent.
        const sourceNodeData = sourceNode.data as CollectionData;
        if (sourceNodeData.parentNode && sourceNodeData.parentNode === nodeId) {
            return 'invalid';
        }

        // Rule 4: Target cannot be `_id`.
        if (field.name === '_id') {
            return 'invalid';
        }
        
        // Rule 5: Target field type must be ObjectId.
        if (field.type !== MongoDataType.ObjectId) {
            return 'invalid';
        }

        // Rule 6: Target cannot already be a foreign key (i.e., already a target of another edge).
        const fieldHandleBase = `${nodeId}-${field.id}`;
        const isAlreadyTarget = edges.some(e => e.targetHandle && e.targetHandle.startsWith(fieldHandleBase));
        if (isAlreadyTarget) {
            return 'invalid';
        }

        return 'valid';
    }, [isConnecting, connectionStartHandle, field, nodeId, allNodes, edges]);


    // Fix: Explicitly type display variables as string to allow custom values.
    let fieldTypeDisplay: string = field.type;
    let fieldTypeTitle: string = field.type;
    if (field.isForeignKey && field.relatedCollection) {
        const relatedNode = allNodes.find(n => n.id === field.relatedCollection);
        if (relatedNode) {
            fieldTypeDisplay = `ObjectId(${relatedNode.data.name})`;
            fieldTypeTitle = `ObjectId (references ${relatedNode.data.name})`;
        } else {
            fieldTypeDisplay = 'ObjectId(...)';
            fieldTypeTitle = 'ObjectId (reference missing)';
        }
    }

    const handleBaseClasses = "!bg-sky-400 !w-2.5 !h-2.5 opacity-0 group-hover:opacity-100 transition-all duration-150";
    let dynamicHandleClasses = '';

    if (isConnecting) {
        if (validationStatus === 'valid') {
            dynamicHandleClasses = 'handle-valid';
        } else if (validationStatus === 'invalid') {
            dynamicHandleClasses = 'handle-invalid';
        }
    }
    
    const leftHandleClasses = `${handleBaseClasses} ${dynamicHandleClasses} !-left-[5px]`;
    const rightHandleClasses = `${handleBaseClasses} ${dynamicHandleClasses} !-right-[5px]`;
    
    return (
        <div className="flex justify-between items-center relative px-3 py-1.5 group border-t border-neutral-800/80">
            <Handle type="target" position={Position.Left} id={`${handleId}-targetL`} className={leftHandleClasses} />
            <Handle type="source" position={Position.Left} id={`${handleId}-sourceL`} className={`${leftHandleClasses} source-handle`} />
            <div className="flex items-center space-x-2 flex-1">
                <div className="w-3.5 h-4 flex-shrink-0 flex items-center justify-center">
                    {field.name === '_id' && <HiOutlineKey className="w-3.5 h-3.5 text-yellow-400/80" title="Primary Key" />}
                </div>
                <span className="text-neutral-300 text-sm" title={field.name}>{field.name}</span>
            </div>
            <div className="flex items-center space-x-2 ml-2">
                <span className={`text-xs ${DataTypeColors[field.type]}`} title={fieldTypeTitle}>{fieldTypeDisplay}</span>
                {field.required && !field.isForeignKey && field.name !== '_id' && <span className="text-neutral-500 text-xs">NULL</span>}
            </div>
            <Handle type="target" position={Position.Right} id={`${handleId}-targetR`} className={rightHandleClasses} />
            <Handle type="source" position={Position.Right} id={`${handleId}-sourceR`} className={`${rightHandleClasses} source-handle`} />
        </div>
    );
};


const CollectionNode: React.FC<NodeProps<CollectionData>> = ({ data, selected }) => {
  const { name, fields, id, parentNode, icon, isRelationshipSource } = data;
  const isChild = !!parentNode;

  const IconComponent = useMemo(() => {
    if (icon && Hi2Icons[icon as keyof typeof Hi2Icons]) {
      return Hi2Icons[icon as keyof typeof Hi2Icons];
    }
    return null;
  }, [icon]);

  return (
    <div
      className={`bg-neutral-950 rounded-md border transition-all duration-150 min-w-[280px] max-w-lg ${
        selected ? 'border-sky-500 shadow-sky-500/10' : 'border-neutral-700/80'
      } ${isChild ? 'border-dashed border-neutral-600' : ''} ${
        isRelationshipSource ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-neutral-950' : ''
      }`}
    >
      {isChild && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-neutral-500 !w-3 !h-3 !-left-1.5"
        />
      )}
      <div className={`rounded-t-md px-3 py-2 border-b flex items-center justify-between ${isChild ? 'bg-neutral-800/40 border-neutral-700/60' : 'bg-black/20 border-neutral-700/80'}`}>
        <h3 className={`font-bold text-base tracking-wide ${isChild ? 'text-neutral-300' : 'text-white'}`}>{name}</h3>
        {IconComponent && <IconComponent className={`w-5 h-5 flex-shrink-0 ${isChild ? 'text-neutral-400' : 'text-white/90'}`} />}
      </div>
      <div className="text-sm">
          {fields.length === 0 ? (
              <p className="text-neutral-400 italic p-3">No fields defined.</p>
          ) : (
              fields.map((field) => (
                  <FieldRow key={field.id} field={field} nodeId={id} />
              ))
          )}
      </div>
    </div>
  );
};

export default memo(CollectionNode);