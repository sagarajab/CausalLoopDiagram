import { StateCreator, StoreApi, UseBoundStore, create } from 'zustand';

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
  sweepFlag?: 0 | 1;
};

export type SelectionType = {
  nodeId?: string;
  arcId?: string;
};

export type CLDState = {
  nodes: NodeType[];
  arcs: ArcType[];
  selection: SelectionType;
  history: { nodes: NodeType[]; arcs: ArcType[] }[];
  future: { nodes: NodeType[]; arcs: ArcType[] }[];
  nodeCounter: number;
  arcCounter: number;
  addNode: (x: number, y: number) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addArc: (from: string, to: string) => void;
  selectNode: (id: string | undefined) => void;
  selectArc: (id: string | undefined) => void;
  undo: () => void;
  redo: () => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateArcSign: (id: string) => void;
  removeNode: (id: string) => void;
  removeArc: (id: string) => void;
};

export const useCLDStore: UseBoundStore<StoreApi<CLDState>> = create<CLDState>(
  (set, get) => ({
    nodes: [],
    arcs: [],
    selection: {},
    history: [],
    future: [],
    nodeCounter: 1,
    arcCounter: 1,
    addNode: (x, y) => {
      const id = get().nodeCounter.toString();
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: [...state.nodes, { id, x, y, label: 'Variable', color: '#222' }],
        nodeCounter: state.nodeCounter + 1,
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
      const arc: ArcType = { id, from, to, sign: '+', color: '#888', curvature: 40, sweepFlag: 0 };
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        arcs: [...state.arcs, arc],
        arcCounter: state.arcCounter + 1,
      }));
    },
    selectNode: (id: string | undefined) => set(() => ({ selection: { nodeId: id, arcId: undefined } })),
    selectArc: (id: string | undefined) => set(() => ({ selection: { nodeId: undefined, arcId: id } })),
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
    removeNode: (id: string) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        nodes: state.nodes.filter(n => n.id !== id),
        arcs: state.arcs.filter(a => a.from !== id && a.to !== id),
        selection: {},
      }));
    },
    removeArc: (id: string) => {
      set(state => ({
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
        arcs: state.arcs.filter(a => a.id !== id),
        selection: {},
      }));
    },
  })
); 