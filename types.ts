
export enum MongoDataType {
  ObjectId = 'ObjectId',
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Array = 'Array',
  Object = 'Object',
  Mixed = 'Mixed',
}

export const DataTypeColors: Record<MongoDataType, string> = {
    [MongoDataType.ObjectId]: 'text-amber-400',
    [MongoDataType.String]: 'text-emerald-400',
    [MongoDataType.Number]: 'text-sky-400',
    [MongoDataType.Boolean]: 'text-rose-400',
    [MongoDataType.Date]: 'text-violet-400',
    [MongoDataType.Array]: 'text-orange-400',
    [MongoDataType.Object]: 'text-teal-400',
    [MongoDataType.Mixed]: 'text-gray-400',
};


export interface Field {
  id: string;
  name: string;
  type: MongoDataType;
  required: boolean;
  isForeignKey: boolean;
  relatedCollection: string | null;
  childCollectionId?: string | null;
}

export interface CollectionData {
  id:string;
  name: string;
  fields: Field[];
  parentNode?: string;
  icon?: string;
  isRelationshipSource?: boolean;
}

export type GroupColor = 'Gray' | 'Blue' | 'Green' | 'Amber' | 'Rose' | 'Violet' | 'Teal' | 'Cyan' | 'Indigo' | 'Pink' | 'Orange' | 'Lime';

export const GroupColorStyles: Record<GroupColor, { bg: string; outline: string; text: string; ring: string; }> = {
  Gray: {
    bg: 'bg-neutral-900/30',
    outline: 'outline-neutral-700',
    text: 'text-neutral-400',
    ring: 'ring-neutral-600',
  },
  Blue: {
    bg: 'bg-sky-950/40',
    outline: 'outline-sky-600/70',
    text: 'text-sky-400',
    ring: 'ring-sky-500',
  },
  Green: {
    bg: 'bg-emerald-950/40',
    outline: 'outline-emerald-600/70',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500',
  },
  Amber: {
    bg: 'bg-amber-950/40',
    outline: 'outline-amber-600/70',
    text: 'text-amber-400',
    ring: 'ring-amber-500',
  },
  Rose: {
    bg: 'bg-rose-950/40',
    outline: 'outline-rose-600/70',
    text: 'text-rose-400',
    ring: 'ring-rose-500',
  },
  Violet: {
    bg: 'bg-violet-950/40',
    outline: 'outline-violet-600/70',
    text: 'text-violet-400',
    ring: 'ring-violet-500',
  },
  Teal: {
    bg: 'bg-teal-950/40',
    outline: 'outline-teal-600/70',
    text: 'text-teal-400',
    ring: 'ring-teal-500',
  },
  Cyan: {
    bg: 'bg-cyan-950/40',
    outline: 'outline-cyan-600/70',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500',
  },
  Indigo: {
    bg: 'bg-indigo-950/40',
    outline: 'outline-indigo-600/70',
    text: 'text-indigo-400',
    ring: 'ring-indigo-500',
  },
  Pink: {
    bg: 'bg-pink-950/40',
    outline: 'outline-pink-600/70',
    text: 'text-pink-400',
    ring: 'ring-pink-500',
  },
  Orange: {
    bg: 'bg-orange-950/40',
    outline: 'outline-orange-600/70',
    text: 'text-orange-400',
    ring: 'ring-orange-500',
  },
  Lime: {
    bg: 'bg-lime-950/40',
    outline: 'outline-lime-600/70',
    text: 'text-lime-400',
    ring: 'ring-lime-500',
  },
};

export interface GroupData {
  name: string;
  color: GroupColor;
  isLoading?: boolean;
  isDropTarget?: boolean;
}

// FIX: Add DrawingNodeData for the temporary node used by the drawing tool.
export interface DrawingNodeData {
  width?: number;
  height?: number;
}

// For passing collection data to the explorer sidebar
export interface ExplorerCollectionData extends CollectionData {}

// New type for the hierarchical data structure in the explorer sidebar
export type ExplorerItem =
  | { type: 'group'; id: string; name: string; children: ExplorerCollectionData[] }
  | { type: 'collection'; data: ExplorerCollectionData };
