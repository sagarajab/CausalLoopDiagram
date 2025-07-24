// Core data types
export type Point = { x: number; y: number };

export type NodeType = {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
};

export type ArcType = {
  id: string;
  from: string;
  to: string;
  sign: '+' | '-';
  color: string;
  curvature: number;
  curvatureSign: 1 | -1;
};

export type SelectionType = {
  nodeId?: string;
  arcId?: string;
};

export type LoopType = {
  id: string;
  nodes: string[];
  length: number;
  type: 'R' | 'B' | '?';
};

// UI State types
export type DragState = {
  nodeId: string | null;
  arcId: string | null;
  isDragging: boolean;
  startPosition: Point | null;
};

export type CanvasState = {
  pan: Point;
  scale: number;
  isPanning: boolean;
};

export type InteractionState = {
  hoveredNodeId: string | null;
  hoveredArcId: string | null;
  rightMousePressed: boolean;
  pendingArcStart: string | null;
};

// File types
export type CLDFileData = {
  version: number;
  nodes: NodeType[];
  arcs: ArcType[];
  defaultNodeColor: string;
  defaultArcColor: string;
};

// Constants
export const CONSTANTS = {
  NODE_RADIUS: 32,
  HANDLE_RADIUS: 8,
  DRAG_THRESHOLD: 4,
  ARROWHEAD_LENGTH: 12,
  MIN_CURVATURE: 20,
  MIN_SCALE: 0.3,
  MAX_SCALE: 2.0,
  SIGN_DIST: 20,
  DEFAULT_CURVATURE: 40,
  STANDARD_COLORS: [
    '#000000', '#444444', '#888888', '#CCCCCC', '#FFFFFF',
    '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00B0F0', '#0070C0', '#7030A0',
    '#F4B183', '#C6E0B4', '#BDD7EE', '#D9D9D9', '#A9D08E', '#FFD966', '#ED7D31',
  ],
} as const; 