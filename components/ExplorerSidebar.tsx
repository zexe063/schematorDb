import React, { useState, useMemo, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { ExplorerCollectionData, ExplorerItem } from '../types';
import { HiOutlineMagnifyingGlass, HiChevronRight } from 'react-icons/hi2';

interface ExplorerSidebarProps {
  items: ExplorerItem[];
  totalCollections: number;
}

// Custom icon for a collection/table, matching the header toolbar
const CollectionIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 7.5H17" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 11H13" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <path d="M7 14H10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
);

// Custom icon for a group/folder, matching the header toolbar
const GroupIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path d="M16.25 3.75H3.75C3.55109 3.75 3.36032 3.82902 3.21967 3.96967C3.07902 4.11032 3 4.30109 3 4.5V15.5C3 15.6989 3.07902 15.8897 3.21967 16.0303C3.36032 16.171 3.55109 16.25 3.75 16.25H16.25C16.4489 16.25 16.6397 16.171 16.7803 16.0303C16.921 15.8897 17 15.6989 17 15.5V4.5C17 4.30109 16.921 4.11032 16.7803 3.96967C16.6397 3.82902 16.4489 3.75 16.25 3.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2"/>
    </svg>
);

const CollectionItem: React.FC<{ 
    collection: ExplorerCollectionData; 
    isNested?: boolean; 
    onClick: (c: ExplorerCollectionData) => void; 
}> = ({ collection, isNested = false, onClick }) => (
    <div 
        onClick={() => onClick(collection)}
        className={`flex items-center space-x-3 py-1.5 cursor-pointer group rounded-md hover:bg-neutral-800/60 pr-2 ${isNested ? 'pl-2' : 'pl-2'}`}
    >
        <CollectionIcon className="w-4 h-4 text-neutral-400 group-hover:text-white flex-shrink-0" />
        <span className="text-sm text-neutral-400 group-hover:text-neutral-100 truncate">{collection.name}</span>
    </div>
);


const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({ items, totalCollections }) => {
  const { setCenter, getNode } = useReactFlow();
  const [searchTerm, setSearchTerm] = useState('');
  const [isTablesOpen, setIsTablesOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
      const initialOpenState: Record<string, boolean> = {};
      items.forEach(item => {
          if (item.type === 'group') {
              initialOpenState[item.id] = true;
          }
      });
      setOpenGroups(initialOpenState);
  }, [items]);
  
  const handleCollectionClick = (collection: ExplorerCollectionData) => {
    const node = getNode(collection.id);
    if (!node || !node.positionAbsolute) return;

    const { x, y } = node.positionAbsolute;
    const width = node.width || 0;
    const height = node.height || 0;

    setCenter(x + width / 2, y + height / 2, { zoom: 1.2, duration: 500 });
  };

  const toggleGroup = (groupId: string) => {
      setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const filteredItems = useMemo(() => {
      if (!searchTerm.trim()) return items;
      const lowerCaseSearchTerm = searchTerm.toLowerCase();

      const result: ExplorerItem[] = [];

      items.forEach(item => {
          if (item.type === 'collection') {
              if (item.data.name.toLowerCase().includes(lowerCaseSearchTerm)) {
                  result.push(item);
              }
          } else { // type === 'group'
              const matchingChildren = item.children.filter(child =>
                  child.name.toLowerCase().includes(lowerCaseSearchTerm)
              );
              if (matchingChildren.length > 0) {
                  result.push({ ...item, children: matchingChildren });
              }
          }
      });
      return result;
  }, [items, searchTerm]);

  useEffect(() => {
    if (!searchTerm.trim()) return;

    const groupsWithMatches = new Set<string>();
    filteredItems.forEach(item => {
        if (item.type === 'group') {
            groupsWithMatches.add(item.id);
        }
    });

    if (groupsWithMatches.size > 0) {
        setOpenGroups(prev => {
            const newState = {...prev};
            let changed = false;
            groupsWithMatches.forEach(id => {
                if (!newState[id]) {
                    newState[id] = true;
                    changed = true;
                }
            });
            return changed ? newState : prev;
        });
    }
  }, [filteredItems, searchTerm]);

  return (
    <aside className="w-72 bg-neutral-900 h-full border-r border-neutral-800 flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-neutral-800">
        <h2 className="text-sm font-bold uppercase text-neutral-400 tracking-wider">Database Explorer</h2>
      </div>
      
      <div className="p-4">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded-md pl-9 pr-3 py-1.5 text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="flex-grow px-2 pb-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
             <div>
                <div 
                    onClick={() => setIsTablesOpen(!isTablesOpen)}
                    className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-neutral-800/50"
                >
                    <div className="flex items-center space-x-2">
                        <HiChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${isTablesOpen ? 'rotate-90' : ''}`} />
                        <span className="font-semibold text-neutral-300">Tables</span>
                    </div>
                </div>
                {isTablesOpen && (
                    <div className="mt-1 ml-2 pl-2 border-l border-neutral-800/50 space-y-1">
                        {filteredItems.length === 0 ? (
                            <p className="text-sm text-neutral-500 px-2 py-1">No collections found.</p>
                        ) : (
                            filteredItems.map(item => {
                                if (item.type === 'group') {
                                    const isOpen = !!openGroups[item.id];
                                    return (
                                        <div key={item.id}>
                                            <div 
                                                onClick={() => toggleGroup(item.id)}
                                                className="flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-neutral-800/50 group"
                                            >
                                                <div className="flex items-center space-x-2 overflow-hidden">
                                                    <HiChevronRight className={`w-4 h-4 text-neutral-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
                                                    <GroupIcon className="w-4 h-4 text-neutral-400 group-hover:text-white flex-shrink-0" />
                                                    <span className="font-medium text-sm text-neutral-300 truncate">{item.name}</span>
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <div className="ml-4 pl-4 border-l border-neutral-800/50">
                                                    {item.children.map(collection => (
                                                        <CollectionItem 
                                                            key={collection.id} 
                                                            collection={collection} 
                                                            onClick={handleCollectionClick}
                                                            isNested
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                
                                if (item.type === 'collection') {
                                    return (
                                        <CollectionItem 
                                            key={item.data.id} 
                                            collection={item.data} 
                                            onClick={handleCollectionClick}
                                        />
                                    );
                                }

                                return null;
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>
    </aside>
  );
};

export default ExplorerSidebar;