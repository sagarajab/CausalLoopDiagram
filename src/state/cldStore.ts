import { StoreApi, UseBoundStore, create } from 'zustand';
import { NodeType, ArcType, SelectionType } from '../types';

export type CLDState = {
  nodes: NodeType[];
  arcs: ArcType[];
  selection: SelectionType;
  history: { nodes: NodeType[]; arcs: ArcType[] }[];
  future: { nodes: NodeType[]; arcs: ArcType[] }[];
  nodeCounter: number;
  arcCounter: number;
  defaultNodeColor: string;
  defaultArcColor: string;
  // Font settings
  nodeFontFamily: string;
  nodeFontSize: number;
  // Canvas state for persistence
  canvasPan: { x: number; y: number };
  canvasScale: number;
  problemStatement: string;
  // Actions
  setDefaultNodeColor: (color: string) => void;
  setDefaultArcColor: (color: string) => void;
  setNodeFontFamily: (fontFamily: string) => void;
  setNodeFontSize: (fontSize: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  setCanvasScale: (scale: number) => void;
  setProblemStatement: (statement: string) => void;
  resetCanvasView: () => void;
  addNode: (x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  moveNodeNoHistory: (id: string, x: number, y: number) => void;
  addArc: (from: string, to: string) => void;
  selectNode: (id: string | undefined) => void;
  selectArc: (id: string | undefined) => void;
  undo: () => void;
  redo: () => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateArcSign: (id: string) => void;
  removeNode: (id: string) => void;
  removeArc: (id: string) => void;
  clearAll: () => void;
};

// Optimized state updates to prevent unnecessary re-renders
const createOptimizedUpdate = <T extends keyof CLDState>(
  key: T,
  updater: (current: CLDState[T]) => CLDState[T]
) => (state: CLDState) => ({
  ...state,
  [key]: updater(state[key]),
});

export const useCLDStore: UseBoundStore<StoreApi<CLDState>> = create<CLDState>(
  (set, get) => ({
    nodes: [],
    arcs: [],
    selection: {},
    history: [],
    future: [],
    nodeCounter: 1,
    arcCounter: 1,
    defaultNodeColor: '#222',
    defaultArcColor: '#888',
    // Font settings
    nodeFontFamily: 'Arial',
    nodeFontSize: 16,
    // Canvas state for persistence
    canvasPan: { x: 0, y: 0 },
    canvasScale: 1,
    problemStatement: 'Describe the problem here...',
    
    setDefaultNodeColor: (color: string) => set({ defaultNodeColor: color }),
    setDefaultArcColor: (color: string) => set({ defaultArcColor: color }),
    setNodeFontFamily: (fontFamily: string) => set({ nodeFontFamily: fontFamily }),
    setNodeFontSize: (fontSize: number) => set({ nodeFontSize: fontSize }),
    setCanvasPan: (pan: { x: number; y: number }) => set({ canvasPan: pan }),
    setCanvasScale: (scale: number) => set({ canvasScale: scale }),
    setProblemStatement: (statement: string) => set({ problemStatement: statement }),
    resetCanvasView: () => set({ canvasPan: { x: 0, y: 0 }, canvasScale: 1 }),
    
    addNode: (x, y) => {
      const id = get().nodeCounter.toString();
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: [...state.nodes, { id, x, y, label: 'Variable', color: get().defaultNodeColor }],
        nodeCounter: state.nodeCounter + 1,
      }));
    },
    
    moveNodeNoHistory: (id, x, y) => {
      set(state => ({
        nodes: state.nodes.map(n => n.id === id ? { ...n, x, y } : n),
      }));
    },
    
    moveNode: (id, x, y) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: state.nodes.map(n => n.id === id ? { ...n, x, y } : n),
      }));
    },
    
    addArc: (from, to) => {
      const id = get().arcCounter.toString();
      const curvature = 40;
      const curvatureSign = (Math.sign(curvature) === -1 ? -1 : 1) as 1 | -1;
      const arc: ArcType = { id, from, to, sign: '+', color: get().defaultArcColor, curvature, curvatureSign };
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        arcs: [...state.arcs, arc],
        arcCounter: state.arcCounter + 1,
      }));
    },
    
    selectNode: (id: string | undefined) => set((state) => ({ 
      selection: { nodeId: id, arcId: state.selection.arcId } 
    })),
    
    selectArc: (id: string | undefined) => {
      console.log('selectArc called with:', id);
      if (id === undefined) {
        console.log('selectArc called with undefined - this will clear selection!');
        console.trace('Stack trace for selectArc(undefined)');
      }
      set((state) => {
        console.log('selectArc: current state selection:', state.selection);
        const newSelection = { nodeId: undefined, arcId: id };
        console.log('selectArc: new selection:', newSelection);
        const newState = { 
          selection: newSelection 
        };
        console.log('selectArc: returning new state:', newState);
        return newState;
      });
      // Check if the state was actually updated
      setTimeout(() => {
        const currentState = get();
        console.log('selectArc: state after update:', currentState.selection);
      }, 0);
    },
    
    undo: () => {
      const { history, nodes, arcs, future } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      set({
        nodes: prev.nodes,
        arcs: prev.arcs,
        history: history.slice(0, -1),
        future: [{ nodes, arcs }, ...future],
      });
    },
    
    redo: () => {
      const { future, nodes, arcs, history } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        nodes: next.nodes,
        arcs: next.arcs,
        history: [...history, { nodes, arcs }],
        future: future.slice(1),
      });
    },
    
    updateNodeLabel: (id, label) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: state.nodes.map(n => n.id === id ? { ...n, label } : n),
      }));
    },
    
    updateArcSign: (id) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        arcs: state.arcs.map(a => a.id === id ? { ...a, sign: a.sign === '+' ? '-' : '+' } : a),
      }));
    },
    
    removeNode: (id) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: state.nodes.filter(n => n.id !== id),
        arcs: state.arcs.filter(a => a.from !== id && a.to !== id),
        selection: state.selection.nodeId === id ? {} : state.selection,
      }));
    },
    
    removeArc: (id) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        arcs: state.arcs.filter(a => a.id !== id),
        selection: state.selection.arcId === id ? {} : state.selection,
      }));
    },
    
    clearAll: () => {
      set({
        nodes: [],
        arcs: [],
        selection: {},
        history: [],
        future: [],
        nodeCounter: 1,
        arcCounter: 1,
        nodeFontFamily: 'Arial',
        nodeFontSize: 16,
        canvasPan: { x: 0, y: 0 },
        canvasScale: 1,
        problemStatement: 'Describe the problem here...',
      });
    },
  })
);

// Optimized selectors for better performance
export const useNodes = () => useCLDStore(state => state.nodes);
export const useArcs = () => useCLDStore(state => state.arcs);
export const useSelection = () => useCLDStore(state => state.selection);
export const useNodeById = (id: string) => useCLDStore(state => state.nodes.find(n => n.id === id));
export const useArcById = (id: string) => useCLDStore(state => state.arcs.find(a => a.id === id)); 