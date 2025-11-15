import React, { useState, useEffect, useCallback } from 'react';
// FIX: Changed to type-only import for React Flow v11+
import type { Node } from 'reactflow';
import type { CollectionData, Field, MongoDataType, GroupData, GroupColor } from '../types';
import { MongoDataType as MongoDataTypeEnum, GroupColorStyles } from '../types';
import { HiPlus, HiOutlineTrash, HiOutlineShare } from 'react-icons/hi2';

const PropertiesPlaceholderIcon = () => (
    <svg role="img" width="19" height="18" focusable="false" aria-hidden="true" viewBox="0 0 19 18" className="w-16 h-16 text-neutral-600">
        <mask id="props-icon-1" fill="white"><rect y="4" width="8" height="9" rx="1.12811"></rect></mask>
        <rect y="4" width="8" height="9" fill="none" rx="1.12811" strokeWidth="2" stroke="currentColor" mask="url(#props-icon-1)"></rect>
        <mask id="props-icon-2" fill="white"><rect x="11" y="10" width="8" height="8" rx="1.12811"></rect></mask>
        <rect x="11" y="10" width="8" height="8" fill="none" rx="1.12811" strokeWidth="2" stroke="currentColor" mask="url(#props-icon-2)"></rect>
        <mask id="props-icon-3" fill="white"><rect x="11" width="8" height="8" rx="1.12811"></rect></mask>
        <rect x="11" width="8" height="8" fill="none" rx="1.12811" strokeWidth="2" stroke="currentColor" mask="url(#props-icon-3)"></rect>
        <path strokeWidth="1.5" stroke="currentColor" d="M8 10H8.37189C8.99493 10 9.5 10.5051 9.5 11.1281V13.8719C9.5 14.4949 10.0051 15 10.6281 15H11"></path>
        <path strokeWidth="1.5" stroke="currentColor" d="M8 7H8.37189C8.99493 7 9.5 6.49493 9.5 5.87189V3.12811C9.5 2.50507 10.0051 2 10.6281 2H11"></path>
    </svg>
);


interface PropertiesSidebarProps {
  selectedNode: Node<CollectionData | GroupData> | null | undefined;
  nodes: Node<CollectionData | GroupData>[];
  updateNode: (id: string, data: Partial<CollectionData | GroupData>) => void;
  deleteNode: (id: string) => void;
  addFieldToCollection: (nodeId: string, fieldData: Omit<Field, 'id' | 'isForeignKey' | 'relatedCollection'>) => void;
  addFieldAndCreateSubCollection: (nodeId: string, fieldData: Omit<Field, 'id' | 'isForeignKey' | 'relatedCollection' | 'childCollectionId'>) => void;
  updateFieldInCollection: (nodeId: string, fieldId: string, fieldData: Partial<Field>) => void;
  removeFieldFromCollection: (nodeId: string, fieldId: string) => void;
  initializeChildAndStartAddField: (nodeId: string, fieldId: string) => void;
}

// Sub-component for Group Properties to isolate hooks
const GroupProperties: React.FC<{
  groupNode: Node<GroupData>;
  updateNode: (id: string, data: Partial<GroupData>) => void;
}> = ({ groupNode, updateNode }) => {
  const [groupName, setGroupName] = useState(groupNode.data.name);
  const formElementClasses = "bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed";

  useEffect(() => {
    setGroupName(groupNode.data.name);
  }, [groupNode.data.name]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setGroupName(newName);
    updateNode(groupNode.id, { name: newName });
  }, [groupNode.id, updateNode]);

  const handleNameBlur = useCallback(() => {
    const trimmedName = groupName.trim();
    if (trimmedName === '') {
        // Revert if empty
        setGroupName(groupNode.data.name);
        updateNode(groupNode.id, { name: groupNode.data.name });
    } else if (trimmedName !== groupName) {
        // Apply trim if it's different
        setGroupName(trimmedName);
        updateNode(groupNode.id, { name: trimmedName });
    }
  }, [groupName, groupNode.data.name, groupNode.id, updateNode]);


  const handleColorChange = (color: GroupColor) => {
    updateNode(groupNode.id, { color });
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="group-name" className="block text-sm font-medium text-neutral-400 mb-1.5">
          Group Name
        </label>
        <input
          id="group-name"
          type="text"
          value={groupName}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className={`w-full ${formElementClasses}`}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-400 mb-1.5">
          Color
        </label>
        <div className="flex flex-wrap gap-3">
          {Object.entries(GroupColorStyles).map(([colorKey, styles]) => (
            <button
              key={colorKey}
              onClick={() => handleColorChange(colorKey as GroupColor)}
              className={`w-7 h-7 rounded-full transition-all duration-150 ${styles.bg.replace('/30', '/60').replace('/40', '/60')} border-2 ${groupNode.data.color === colorKey ? 'border-neutral-400 ring-2 ring-neutral-500/50' : 'border-neutral-700 hover:border-neutral-500'}`}
              title={colorKey}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Sub-component for Collection Properties to isolate hooks
const CollectionProperties: React.FC<{
  collectionNode: Node<CollectionData>;
  nodes: Node<CollectionData | GroupData>[];
  updateNode: (id: string, data: Partial<CollectionData>) => void;
  addFieldToCollection: PropertiesSidebarProps['addFieldToCollection'];
  addFieldAndCreateSubCollection: PropertiesSidebarProps['addFieldAndCreateSubCollection'];
  updateFieldInCollection: PropertiesSidebarProps['updateFieldInCollection'];
  removeFieldFromCollection: PropertiesSidebarProps['removeFieldFromCollection'];
}> = ({
  collectionNode,
  nodes,
  updateNode,
  addFieldToCollection,
  addFieldAndCreateSubCollection,
  updateFieldInCollection,
  removeFieldFromCollection,
}) => {
  const [nodeName, setNodeName] = useState(collectionNode.data.name);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<MongoDataType>(MongoDataTypeEnum.String);
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const formElementClasses = "bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed";

  useEffect(() => {
    setNodeName(collectionNode.data.name);
  }, [collectionNode]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setNodeName(newName);
    updateNode(collectionNode.id, { name: newName });
  }, [collectionNode.id, updateNode]);

  const handleNameBlur = useCallback(() => {
    const trimmedName = nodeName.trim();
    if (trimmedName === '') {
      setNodeName(collectionNode.data.name);
      updateNode(collectionNode.id, { name: collectionNode.data.name });
    } else if (trimmedName !== nodeName) {
      setNodeName(trimmedName);
      updateNode(collectionNode.id, { name: trimmedName });
    }
  }, [nodeName, collectionNode.data.name, collectionNode.id, updateNode]);

  const handleAddField = useCallback(() => {
    if (newFieldName.trim() === '') {
      alert("Field name cannot be empty.");
      return;
    }
    if (collectionNode.data.fields.some(f => f.name === newFieldName.trim())) {
      alert("Field name must be unique.");
      return;
    }
    const fieldData = { name: newFieldName.trim(), type: newFieldType, required: newFieldRequired };

    if (newFieldType === MongoDataTypeEnum.Object) {
      addFieldAndCreateSubCollection(collectionNode.id, fieldData);
    } else {
      addFieldToCollection(collectionNode.id, fieldData);
    }

    setNewFieldName('');
    setNewFieldType(MongoDataTypeEnum.String);
    setNewFieldRequired(false);
  }, [newFieldName, newFieldType, newFieldRequired, collectionNode, addFieldToCollection, addFieldAndCreateSubCollection]);

  const handleAddFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddField();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="collection-name" className="block text-sm font-medium text-neutral-400 mb-1.5">
          Collection Name
        </label>
        <input
          id="collection-name"
          type="text"
          value={nodeName}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
          className={`w-full ${formElementClasses}`}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-neutral-400">Fields</h3>
        <div className="space-y-2">
            {collectionNode.data.fields.map((field) => {
              const isForeignKey = field.isForeignKey;
              const relatedCollection = isForeignKey ? nodes.find(n => n.id === field.relatedCollection) : null;
              const relatedCollectionName = relatedCollection ? (relatedCollection.data as CollectionData | GroupData).name : '...';
              const isObjectWithChild = field.type === MongoDataTypeEnum.Object && field.childCollectionId;

              return (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                        <input
                            type="text"
                            aria-label="Field Name"
                            value={field.name}
                            disabled={field.name === '_id'}
                            onChange={(e) => updateFieldInCollection(collectionNode.id, field.id, { name: e.target.value })}
                            className={`w-full ${formElementClasses}`}
                        />
                    </div>
                    <div className="col-span-5">
                         {isForeignKey ? (
                          <div className="flex items-center space-x-2 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-sky-400 text-sm truncate" title={`Foreign Key to ${relatedCollectionName}._id`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 8a1 1 0 100-2 1 1 0 000 2z" />
                              </svg>
                              <span className="font-semibold truncate" >{relatedCollectionName}</span>
                          </div>
                         ) : isObjectWithChild ? (
                          <div className="flex items-center space-x-2 bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-teal-400 text-sm truncate" title={`Sub-object defined in another collection`}>
                              <HiOutlineShare className="h-4 w-4 text-teal-500 flex-shrink-0 -rotate-90" />
                              <span className="font-semibold truncate">Sub-Object</span>
                          </div>
                         ) : (
                          <div className="flex items-center space-x-1.5">
                            <select
                                aria-label="Field Type"
                                value={field.type}
                                disabled={field.name === '_id'}
                                onChange={(e) => updateFieldInCollection(collectionNode.id, field.id, { type: e.target.value as MongoDataType })}
                                className={`flex-grow ${formElementClasses}`}
                            >
                                {Object.values(MongoDataTypeEnum).map((type) => (
                                    <option key={type} value={type} className="bg-neutral-800 text-neutral-300">{type}</option>
                                ))}
                            </select>
                          </div>
                         )}
                    </div>
                    
                    <div className="col-span-1 flex justify-center">
                         <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                aria-label="Is Required"
                                checked={field.required}
                                disabled={field.name === '_id'}
                                onChange={(e) => updateFieldInCollection(collectionNode.id, field.id, { required: e.target.checked })}
                                className="form-checkbox h-4 w-4 bg-neutral-700 border-neutral-600 text-neutral-500 focus:ring-neutral-500 rounded disabled:opacity-50"
                            />
                            <span className="sr-only">Required</span>
                        </label>
                    </div>
                    <div className="col-span-1 flex justify-end">
                        <button 
                            onClick={() => removeFieldFromCollection(collectionNode.id, field.id)} 
                            className="text-neutral-500 hover:text-red-500 p-1 disabled:opacity-30 disabled:hover:text-neutral-500 disabled:cursor-not-allowed"
                            disabled={field.name === '_id'}
                            aria-label="Remove Field"
                            >
                            <HiOutlineTrash className="w-4 h-4"/>
                        </button>
                    </div>
                </div>
            )})}
        </div>
      </div>
      
      <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-400">Add New Field</h3>
          <div className="grid grid-cols-12 gap-2 items-center p-2 bg-neutral-800/50 rounded-lg border border-neutral-800">
              <div className="col-span-5">
                    <input
                      type="text"
                      aria-label="New Field Name"
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={handleAddFieldKeyDown}
                      className={`w-full ${formElementClasses}`}
                  />
              </div>
              <div className="col-span-5">
                  <select
                      aria-label="New Field Type"
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as MongoDataType)}
                      className={`w-full ${formElementClasses}`}
                  >
                      {Object.values(MongoDataTypeEnum).map((type) => (
                          <option key={type} value={type} className="bg-neutral-800 text-neutral-300">{type}</option>
                      ))}
                  </select>
              </div>
              <div className="col-span-1 flex justify-center">
                  <label className="flex items-center cursor-pointer">
                      <input
                          type="checkbox"
                          aria-label="New Field Is Required"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="form-checkbox h-4 w-4 bg-neutral-700 border-neutral-600 text-neutral-500 focus:ring-neutral-500 rounded"
                      />
                      <span className="sr-only">Required</span>
                  </label>
              </div>
              <div className="col-span-1 flex justify-end">
                    <button 
                      onClick={handleAddField} 
                      className="bg-neutral-600 hover:bg-neutral-500 text-white rounded p-1 transition-colors" 
                      aria-label="Add Field"
                    >
                      <HiPlus className="w-4 h-4" />
                    </button>
              </div>
          </div>
      </div>
    </div>
  );
};

// Main component, now without hooks
const PropertiesSidebar: React.FC<PropertiesSidebarProps> = ({
  selectedNode,
  nodes,
  updateNode,
  deleteNode,
  addFieldToCollection,
  addFieldAndCreateSubCollection,
  updateFieldInCollection,
  removeFieldFromCollection,
}) => {

  const handleDelete = () => {
    if (selectedNode && window.confirm(`Are you sure you want to delete "${selectedNode.data.name}"? This action cannot be undone.`)) {
      deleteNode(selectedNode.id);
    }
  };

  return (
    <aside className="w-96 bg-neutral-900 h-full border-l border-neutral-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-neutral-800 flex-shrink-0">
        <h2 className="text-sm font-bold uppercase text-neutral-400 tracking-wider">
          {selectedNode ? (selectedNode.type === 'groupNode' ? 'Group Properties' : 'Collection Properties') : 'Properties'}
        </h2>
      </div>

      {!selectedNode ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center text-neutral-500 p-8 space-y-4">
            <PropertiesPlaceholderIcon />
            <p className="text-sm">Select a collection or group to see its properties.</p>
        </div>
      ) : (
        <>
            <div className="p-4 overflow-y-auto flex-grow custom-scrollbar">
                {selectedNode.type === 'groupNode' && (
                <GroupProperties
                    groupNode={selectedNode as Node<GroupData>}
                    updateNode={updateNode}
                />
                )}
                {selectedNode.type === 'collectionNode' && (
                <CollectionProperties
                    collectionNode={selectedNode as Node<CollectionData>}
                    nodes={nodes}
                    updateNode={updateNode as any} // Cast because it handles both types
                    addFieldToCollection={addFieldToCollection}
                    addFieldAndCreateSubCollection={addFieldAndCreateSubCollection}
                    updateFieldInCollection={updateFieldInCollection}
                    removeFieldFromCollection={removeFieldFromCollection}
                />
                )}
            </div>
            
            {selectedNode && (
                <div className="p-4 border-t border-neutral-800 flex-shrink-0">
                <button
                    onClick={handleDelete}
                    className="w-full bg-red-600/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 text-sm"
                >
                    <HiOutlineTrash className="w-4 h-4" />
                    <span>Delete {selectedNode.type === 'groupNode' ? 'Group' : 'Collection'}</span>
                </button>
                </div>
            )}
        </>
      )}
    </aside>
  );
};

export default PropertiesSidebar;