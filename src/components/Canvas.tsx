import React, { useState, useRef, useEffect } from 'react';
import { useCLDStore } from '../state/cldStore';
import type { CLDState } from '../state/cldStore';
import type { NodeType } from '../state/cldStore';
import type { ArcType } from '../state/cldStore';
// At the top of the file, add a global style block for layout fixes:
import './globalLayoutFix.css';

const NODE_RADIUS = 32;
const HANDLE_RADIUS = 8;
const DRAG_THRESHOLD = 4; // px
const ARROWHEAD_LENGTH = 12;
const MIN_CURVATURE = 20; // Minimum allowed absolute curvature for arcs

type Point = { x: number; y: number };

function getCircleFrom3Points(p1: Point, p2: Point, p3: Point) {
  // Returns {cx, cy, r} for the circle through p1, p2, p3
  const A = p2.x - p1.x;
  const B = p2.y - p1.y;
  const C = p3.x - p1.x;
  const D = p3.y - p1.y;
  const E = A * (p1.x + p2.x) + B * (p1.y + p2.y);
  const F = C * (p1.x + p3.x) + D * (p1.y + p3.y);
  const G = 2 * (A * (p3.y - p2.y) - B * (p3.x - p2.x));
  if (Math.abs(G) < 1e-6) return null; // Collinear
  const cx = (D * E - B * F) / G;
  const cy = (A * F - C * E) / G;
  const r = Math.sqrt((p1.x - cx) ** 2 + (p1.y - cy) ** 2);
  return { cx, cy, r };
}

function getCircleCircleIntersections(c1: Point, r1: number, c2: Point, r2: number): Point[] {
  // Returns intersection points of two circles
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const xm = c1.x + (a * dx) / d;
  const ym = c1.y + (a * dy) / d;
  const xs1 = xm + (h * dy) / d;
  const ys1 = ym - (h * dx) / d;
  const xs2 = xm - (h * dy) / d;
  const ys2 = ym + (h * dx) / d;
  return [ { x: xs1, y: ys1 }, { x: xs2, y: ys2 } ];
}

// Helper: getRefCircleParams
function getRefCircleParams(from: Point, to: Point, curvature: number) {
  // Reference path: circle through node centers and control point
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const control = { x: mx + nx * curvature, y: my + ny * curvature };
  const circle = getCircleFrom3Points(from, to, control);
  if (!circle) {
    console.warn('Reference circle collinear:', { from, to, control });
  } else {
    console.log('Reference circle:', { from, to, control, circle });
  }
  return circle;
}

// Helper to find all simple cycles in a directed graph
function findAllSimpleCycles(nodes: NodeType[], arcs: ArcType[]): string[][] {
  // Johnson's algorithm (simplified for small graphs)
  const adj: Record<string, { to: string; sign: string }[]> = {};
  nodes.forEach((n: NodeType) => { adj[n.id] = []; });
  arcs.forEach((a: ArcType) => { adj[a.from].push({ to: a.to, sign: a.sign }); });
  const blocked: Record<string, boolean> = {};
  const B: Record<string, string[]> = {};
  const stack: string[] = [];
  const cycles: string[][] = [];
  function unblock(u: string) {
    blocked[u] = false;
    (B[u] || []).forEach((w: string) => {
      if (blocked[w]) unblock(w);
    });
    B[u] = [];
  }
  function circuit(v: string, s: string): boolean {
    let closed = false;
    stack.push(v);
    blocked[v] = true;
    for (const { to: w } of adj[v]) {
      if (w === s) {
        // Found a cycle
        cycles.push([...stack, s]);
        closed = true;
      } else if (!blocked[w]) {
        if (circuit(w, s)) closed = true;
      }
    }
    if (closed) {
      unblock(v);
    } else {
      for (const { to: w } of adj[v]) {
        if (!B[w]) B[w] = [];
        if (!B[w].includes(v)) B[w].push(v);
      }
    }
    stack.pop();
    return closed;
  }
  const nodeIds = nodes.map((n: NodeType) => n.id);
  for (let i = 0; i < nodeIds.length; ++i) {
    const s = nodeIds[i];
    // Subgraph induced by nodes >= s
    const subNodes = nodeIds.slice(i);
    // Reset blocked/B
    subNodes.forEach((n: string) => { blocked[n] = false; B[n] = []; });
    // Run circuit
    circuit(s, s);
  }
  // Remove duplicate cycles (cycles with same nodes, different start)
  const unique: string[][] = [];
  const seen = new Set<string>();
  for (const cyc of cycles) {
    const norm = [...cyc];
    norm.pop(); // remove duplicate start at end
    // Normalize: rotate so smallest id is first
    let minIdx = 0;
    for (let i = 1; i < norm.length; ++i) if (norm[i] < norm[minIdx]) minIdx = i;
    const rotated = [...norm.slice(minIdx), ...norm.slice(0, minIdx)];
    const key = rotated.join('-');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rotated);
    }
  }
  return unique;
}

// Helper: intersection of line from (cx,cy) to (px,py) with ellipse (cx,cy,rx,ry)
function ellipseLineIntersection(cx: number, cy: number, rx: number, ry: number, px: number, py: number) {
  // Parametric line: (cx,cy) + t*(dx,dy)
  const dx = px - cx;
  const dy = py - cy;
  // If direction is zero, return ellipse boundary at 0 degrees
  if (dx === 0 && dy === 0) return { x: cx + rx, y: cy };
  // Quadratic equation: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 = 1
  // (cx + t*dx - cx)^2/rx^2 + (cy + t*dy - cy)^2/ry^2 = 1
  // (t*dx)^2/rx^2 + (t*dy)^2/ry^2 = 1
  // t^2 * (dx^2/rx^2 + dy^2/ry^2) = 1
  // t^2 = 1 / (dx^2/rx^2 + dy^2/ry^2)
  const denom = (dx*dx)/(rx*rx) + (dy*dy)/(ry*ry);
  if (denom === 0) return { x: cx + rx, y: cy };
  const t = Math.sqrt(1 / denom);
  // Always use the positive t (outward from center)
  let x = cx + t * dx;
  let y = cy + t * dy;
  // Clamp to ellipse boundary in case of floating-point error
  // Compute normalized coordinates
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const norm = Math.sqrt(nx * nx + ny * ny);
  if (Math.abs(norm - 1) > 1e-6 && norm !== 0) {
    // Project back to ellipse
    x = cx + (nx / norm) * rx;
    y = cy + (ny / norm) * ry;
  }
  return { x, y };
}

// Helper: robust intersection of arc (reference circle) with ellipse
function findArcEllipseIntersection(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number,
  ellipseCx: number, ellipseCy: number, rx: number, ry: number,
  searchFromStart: boolean = true,
  segments: number = 1000 // increased for more precision
): { x: number, y: number } | null {
  // Sample points along the arc
  let delta = endAngle - startAngle;
  if (searchFromStart ? delta < 0 : delta > 0) delta += Math.PI * 2;
  if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
  let prevInside = null;
  let prevPt = null;
  for (let i = 0; i <= segments; ++i) {
    const t = searchFromStart ? i / segments : 1 - i / segments;
    const angle = startAngle + t * delta;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    // Check if inside ellipse
    const ex = (x - ellipseCx) / rx;
    const ey = (y - ellipseCy) / ry;
    const inside = (ex * ex + ey * ey) < 1;
    if (prevInside !== null && inside !== prevInside && prevPt) {
      // Interpolate between prevPt and current pt
      const interp = (a: number, b: number) => a + (b - a) * 0.5;
      let x0 = prevPt.x, y0 = prevPt.y, x1 = x, y1 = y;
      // Binary search for boundary
      for (let j = 0; j < 8; ++j) {
        const mx = interp(x0, x1);
        const my = interp(y0, y1);
        const mex = (mx - ellipseCx) / rx;
        const mey = (my - ellipseCy) / ry;
        const minside = (mex * mex + mey * mey) < 1;
        if (minside === inside) {
          x1 = mx; y1 = my;
        } else {
          x0 = mx; y0 = my;
        }
      }
      // Move slightly outward from ellipse center
      const dx = x0 - ellipseCx;
      const dy = y0 - ellipseCy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const epsilon = 1.0;
      return {
        x: ellipseCx + dx / len * (len + epsilon),
        y: ellipseCy + dy / len * (len + epsilon)
      };
    }
    prevInside = inside;
    prevPt = { x, y };
  }
  // Fallback: return closest sampled point, moved slightly outward
  if (prevPt) {
    const dx = prevPt.x - ellipseCx;
    const dy = prevPt.y - ellipseCy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const epsilon = 1.0;
    return {
      x: ellipseCx + dx / len * (len + epsilon),
      y: ellipseCy + dy / len * (len + epsilon)
    };
  }
  return prevPt;
}

// Helper to create an arc path from center, radius, startAngle, endAngle, and sweepFlag
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, sweepFlag: number) {
  // Angles in radians
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  // Always draw the smaller arc
  const largeArcFlag = 0;
  return `M${start.x},${start.y} A${r},${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x},${end.y}`;
}

// Helper to create a polyline path along a circle from startAngle to endAngle (minor arc, correct sweep)
function describeArcPolyline(cx: number, cy: number, r: number, startAngle: number, endAngle: number, sweepFlag: number, segments = 40) {
  // Ensure the arc goes the correct direction and is always the minor arc
  let delta = endAngle - startAngle;
  if (Math.abs(delta) > Math.PI) {
    delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
  }
  const points = [];
  for (let i = 0; i <= segments; ++i) {
    const t = i / segments;
    const angle = startAngle + t * delta;
    points.push([
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle)
    ]);
  }
  return 'M' + points.map(([x, y]) => `${x},${y}`).join(' L');
}

// Add a helper to normalize hex color to 6-digit lowercase
function normalizeHexColor(hex: string) {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  return '#' + color.toLowerCase();
}

// Add a helper to check for blue arc color
function isBlueArcColor(hex: string) {
  const norm = normalizeHexColor(hex);
  return norm === '#0099ff' || norm === '#09f9ff'; // #09f expands to #0099ff
}
// Add a helper to check for default arc color
function isDefaultArcColor(hex: string, defaultArcColor: string) {
  return normalizeHexColor(hex) === normalizeHexColor(defaultArcColor);
}

// Add a helper to darken a hex color (multiplicative, robust for 3/6 digit hex)
function darkenColor(hex: string, factor: number = 0.7) {
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  const num = parseInt(color, 16);
  let r = Math.floor(((num >> 16) & 0xff) * factor);
  let g = Math.floor(((num >> 8) & 0xff) * factor);
  let b = Math.floor((num & 0xff) * factor);
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

const DevConsole: React.FC<{
  selection: any;
  hoveredNodeId: string | null;
  hoveredArcId: string | null;
  pendingArcStart: string | null;
  arcError: string | null;
}> = ({ selection, hoveredNodeId, hoveredArcId, pendingArcStart, arcError }) => (
  <div style={{ position: 'fixed', bottom: 8, right: 8, background: '#222', color: '#fff', padding: 12, borderRadius: 8, fontSize: 13, zIndex: 1000, opacity: 0.9 }}>
    <div>Selected node: <b>{selection.nodeId ?? 'none'}</b></div>
    <div>Selected arc: <b>{selection.arcId ?? 'none'}</b></div>
    <div>Hovered node: <b>{hoveredNodeId ?? 'none'}</b></div>
    <div>Hovered arc: <b>{hoveredArcId ?? 'none'}</b></div>
    <div>Pending arc start: <b>{pendingArcStart ?? 'none'}</b></div>
    {arcError && <div style={{ color: '#ff5252', marginTop: 8 }}>Arc error: {arcError}</div>}
  </div>
);

// Add DevStateBox for dev mode
const DEV_STATES = [
  { key: 'default', label: '0. Default' },
  { key: 'node_add', label: '1. Node addition' },
  { key: 'node_select', label: '2. Node select' },
  { key: 'node_edit', label: '2.1 Node edit' },
  { key: 'node_drag', label: '2.2 Node drag' },
  { key: 'arc_add', label: '3. Arrow addition' },
  { key: 'arc_select', label: '4. Arrow select' },
  { key: 'arc_edit', label: '4.1 Arrow edit' },
  { key: 'arc_drag', label: '4.2 Arrow drag' },
  { key: 'arc_sign', label: '4.3 Arrow sign toggle' },
  { key: 'arc_curvature', label: '4.4 Arrow curvature drag' },
];

type DevStateBoxProps = {
  editingNodeId: string | null;
  draggingNodeId: string | null;
  arcDrag: { arcId: string, curvature: number } | null;
  selection: any;
  pendingArcStart: string | null;
  ctrlPressed: boolean;
  hoveredArcId: string | null;
  hoveredNodeId: string | null;
  hoveredDummyControlArcId: string | null;
  draggingCurvatureArcId: string | null;
  arcError: string | null;
};

function getCurrentDevState(props: DevStateBoxProps): string {
  const {
    editingNodeId,
    draggingNodeId,
    arcDrag,
    selection,
    pendingArcStart,
    ctrlPressed,
    hoveredArcId,
    hoveredNodeId,
    hoveredDummyControlArcId,
    draggingCurvatureArcId,
    arcError,
  } = props;
  if (editingNodeId) return 'node_edit';
  if (draggingNodeId) return 'node_drag';
  if (arcDrag && arcDrag.arcId) return 'arc_curvature';
  if (draggingCurvatureArcId) return 'arc_curvature';
  if (pendingArcStart && ctrlPressed) return 'arc_add';
  if (selection.arcId && hoveredDummyControlArcId === selection.arcId) return 'arc_sign';
  if (selection.arcId && arcDrag && arcDrag.arcId === selection.arcId) return 'arc_edit';
  if (selection.arcId && hoveredArcId === selection.arcId) return 'arc_select';
  if (selection.arcId) return 'arc_select';
  if (selection.nodeId && draggingNodeId === selection.nodeId) return 'node_drag';
  if (selection.nodeId && editingNodeId === selection.nodeId) return 'node_edit';
  if (selection.nodeId && hoveredNodeId === selection.nodeId) return 'node_select';
  if (selection.nodeId) return 'node_select';
  if (arcError) return 'arc_add';
  return 'default';
}

const DevStateBox: React.FC<DevStateBoxProps> = (props) => {
  const current = getCurrentDevState(props);
  return (
    <div style={{ position: 'fixed', bottom: 120, right: 8, background: '#fff', color: '#222', padding: 12, borderRadius: 8, fontSize: 13, zIndex: 1000, opacity: 0.95, border: '1px solid #bbb', minWidth: 180, boxShadow: '0 2px 8px #0001' }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>App State</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {DEV_STATES.map(s => (
          <li key={s.key} style={{
            padding: '2px 0',
            fontWeight: current === s.key ? 700 : 400,
            color: current === s.key ? '#1976d2' : '#222',
            background: current === s.key ? '#e3eaf5' : 'none',
            borderRadius: 4,
            marginBottom: 1,
            paddingLeft: 6,
          }}>{s.label}</li>
        ))}
      </ul>
    </div>
  );
};

// Helper to measure text width for caret positioning
const measureTextWidth = (text: string, fontSize = 20, fontWeight = 'bold', fontStyle = 'italic') => {
  if (typeof document === 'undefined') return text.length * 10.5;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  tempText.setAttribute('font-size', fontSize.toString());
  tempText.setAttribute('font-weight', fontWeight);
  tempText.setAttribute('font-style', fontStyle);
  tempText.textContent = text;
  svg.appendChild(tempText);
  document.body.appendChild(svg);
  const width = tempText.getBBox().width;
  document.body.removeChild(svg);
  return width;
};

// Helper to estimate label size
const estimateLabelSize = (label: string, fontSize: number) => {
  const lines = label.split('\n');
  const longest = lines.reduce((a, b) => a.length > b.length ? a : b, '');
  // Estimate width: chars * approx char width
  const charWidth = fontSize * 0.6; // 0.6 is a good estimate for most fonts
  const width = Math.max(1, longest.length * charWidth);
  // Estimate height: lines * line height
  const lineHeight = fontSize * 1.2;
  const height = lines.length * lineHeight;
  return { width, height };
};

const Canvas: React.FC = () => {
  const defaultArcColor = useCLDStore(state => state.defaultArcColor);
  const nodes = useCLDStore(state => state.nodes);
  const arcs = useCLDStore(state => state.arcs);
  const selection = useCLDStore(state => state.selection);
  const addNode = useCLDStore(state => state.addNode);
  const addArc = useCLDStore(state => state.addArc);
  const selectNode = useCLDStore(state => state.selectNode);
  const selectArc = useCLDStore(state => state.selectArc);
  const moveNode = useCLDStore(state => state.moveNode);
  const setArcCurvature = (arcId: string, curvature: number) => {
    useCLDStore.setState(state => ({
      arcs: state.arcs.map(a => a.id === arcId ? { ...a, curvature } : a)
    }));
  };
  const updateNodeLabel = useCLDStore(state => state.updateNodeLabel);
  const updateArcSign = useCLDStore(state => state.updateArcSign);
  // Drag/arc state
  const pendingArcStart = useRef<string | null>(null);
  const forceUpdate = React.useReducer(() => ({}), {})[1]; // To force re-render
  const pendingArcStartRef = useRef<string | null>(null);
  React.useEffect(() => {
    pendingArcStartRef.current = pendingArcStart.current;
  }, []);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; nodeX: number; nodeY: number; nodeId: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [arcDrag, setArcDrag] = useState<{ arcId: string, curvature: number } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredArcId, setHoveredArcId] = useState<string | null>(null);
  const [arcError, setArcError] = useState<string | null>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [hoveredControlArcId, setHoveredControlArcId] = useState<string | null>(null);
  // Add this for robust arc curvature drag
  const arcDragStart = useRef<null | { arcId: string, mx: number, my: number, nx: number, ny: number, sign: number, curvatureSignAtDragStart?: number, sweepSign?: number }>(null);
  // Local state for lag-free control point dragging
  const [draggingCurvature, setDraggingCurvature] = useState<number | null>(null);
  const [draggingCurvatureArcId, setDraggingCurvatureArcId] = useState<string | null>(null);
  const [hoveredDummyControlArcId, setHoveredDummyControlArcId] = useState<string | null>(null);

  // Node label editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingNodeId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNodeId]);

  // Add caret blink state
  const [caretPos, setCaretPos] = useState<number>(0);
  const [showCaret, setShowCaret] = useState(true);
  useEffect(() => {
    if (editingNodeId !== null) {
      setShowCaret(true);
      const blink = setInterval(() => setShowCaret(s => !s), 500);
      return () => clearInterval(blink);
    }
  }, [editingNodeId]);

  // Dev mode toggle
  const [devMode, setDevMode] = useState(false);

  // Delete selected node or arc on Delete key
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        // Prevent node/arc deletion if editing a node label
        if (editingNodeId !== null) return;
        const store = useCLDStore.getState() as CLDState;
        if (selection.nodeId !== undefined && selection.nodeId !== null) {
          store.removeNode(selection.nodeId);
        } else if (selection.arcId !== undefined && selection.arcId !== null) {
          store.removeArc(selection.arcId);
        }
      }
    };
    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [selection.nodeId, selection.arcId, editingNodeId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey) setCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const getNode = (id: string) => nodes.find(n => n.id === id);

  // Add node at double-click
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    const pt = canvasRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    // Prevent node creation if double-click is over a node or arc
    // Check nodes
    const overNode = nodes.some(node => {
      const dx = cursorpt.x - node.x;
      const dy = cursorpt.y - node.y;
      return Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 8;
    });
    // Check arcs (use a small distance to any arc path)
    const overArc = arcs.some(arc => {
      const from = nodes.find(n => n.id === arc.from);
      const to = nodes.find(n => n.id === arc.to);
      if (!from || !to) return false;
      const curvature = arc.curvature;
      const refCircle = getRefCircleParams(from, to, curvature);
      if (!refCircle) return false;
      const endpoints = getArcEndpoints(from, to, refCircle, arc);
      if (!endpoints) return false;
      const { start, end } = endpoints;
      // Use the same arc polyline sampling as rendering
      const startAngle = Math.atan2((start?.y ?? from.y) - refCircle.cy, (start?.x ?? from.x) - refCircle.cx);
      const endAngle = Math.atan2((end?.y ?? to.y) - refCircle.cy, (end?.x ?? to.x) - refCircle.cx);
      let delta = endAngle - startAngle;
      if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
      const segments = 40;
      for (let i = 0; i <= segments; ++i) {
        const t = i / segments;
        const angle = startAngle + t * delta;
        const x = refCircle.cx + refCircle.r * Math.cos(angle);
        const y = refCircle.cy + refCircle.r * Math.sin(angle);
        const dist = Math.sqrt((cursorpt.x - x) ** 2 + (cursorpt.y - y) ** 2);
        if (dist < 12) return true;
      }
      return false;
    });
    if (!overNode && !overArc) {
      // Add node and immediately enter edit mode with default name
      const nextId = (nodes.length > 0 ? Math.max(...nodes.map(n => Number(n.id))) + 1 : 1).toString();
      addNode((cursorpt.x - pan.x) / scale, (cursorpt.y - pan.y) / scale);
      setTimeout(() => {
        setEditingNodeId(nextId);
        setEditingLabel(`var_${nextId}`);
      }, 0);
    }
  };

  // Robust arc creation handler (function declaration for hoisting)
  function handleNodeCtrlClick(nodeId: string) {
    if (!pendingArcStart.current) {
      pendingArcStart.current = nodeId;
      setArcError(null);
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    if (pendingArcStart.current === nodeId) {
      setArcError('Cannot create self-loop.');
      pendingArcStart.current = null;
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    // Check if arc already exists in this direction
    if (arcs.some(a => a.from === pendingArcStart.current && a.to === nodeId)) {
      setArcError(`Arc from ${pendingArcStart.current} to ${nodeId} already exists.`);
      pendingArcStart.current = null;
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    // Try to create arc with default curvature
    const from = getNode(pendingArcStart.current);
    const to = getNode(nodeId);
    if (!from || !to) {
      setArcError('Node not found.');
      pendingArcStart.current = null;
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    const curvature = 40;
    const refCircle = getRefCircleParams(from, to, curvature);
    if (!refCircle) {
      setArcError('Cannot create arc: reference circle is degenerate.');
      pendingArcStart.current = null;
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    const endpoints = getArcEndpoints(from, to, refCircle, { curvatureSign: 1 } as ArcType);
    if (!endpoints) {
      setArcError('Cannot create arc: no valid intersection.');
      pendingArcStart.current = null;
      forceUpdate();
      console.log('Ctrl+click on node', nodeId, 'pendingArcStart:', pendingArcStart.current);
      return;
    }
    addArc(pendingArcStart.current, nodeId);
    setArcError(null);
    pendingArcStart.current = null;
    forceUpdate();
    console.log('Arc created from', from.id, 'to', nodeId);
  }

  // Helper to get dynamic node radius
  const getNodeRadius = (node: NodeType) => {
    const fontSize = (selection.nodeId === node.id || hoveredNodeId === node.id) ? 20 : 16;
    const { width, height } = estimateLabelSize(node.label, fontSize);
    const padding = 16;
    return Math.sqrt((width / 2) ** 2 + (height / 2) ** 2) + padding;
  };

  // Helper: robust intersection of arc (reference circle) with ellipse
  function getArcEndpoints(from: NodeType, to: NodeType, refCircle: { cx: number; cy: number; r: number }, arc: ArcType) {
    const fontSizeFrom = (selection.nodeId === from.id) ? 20 : 16;
    const fontSizeTo = (selection.nodeId === to.id) ? 20 : 16;
    const { width: wFrom, height: hFrom } = estimateLabelSize(from.label, fontSizeFrom);
    const { width: wTo, height: hTo } = estimateLabelSize(to.label, fontSizeTo);
    const padding = 16;
    const rxFrom = Math.abs(wFrom / 2 + padding);
    const ryFrom = Math.abs(hFrom / 2 + padding);
    const rxTo = Math.abs(wTo / 2 + padding);
    const ryTo = Math.abs(hTo / 2 + padding);
    const startAngle = Math.atan2(from.y - refCircle.cy, from.x - refCircle.cx);
    const endAngle = Math.atan2(to.y - refCircle.cy, to.x - refCircle.cx);
    // Remove sweepFlag logic
    const start = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
      from.x, from.y, rxFrom, ryFrom, arc.curvatureSign > 0
    );
    const end = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
      to.x, to.y, rxTo, ryTo, arc.curvatureSign > 0
    );
    return { start, end };
  }

  // Track mouse position for arrow-draw mode
  const [arrowDrawMouse, setArrowDrawMouse] = useState<{x: number, y: number} | null>(null);

  // Update mouse position on mouse move (only in arrow-draw mode)
  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (ctrlPressed && pendingArcStart.current) {
      if (!canvasRef.current) return;
      const pt = canvasRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
      setArrowDrawMouse({ x: (cursorpt.x - pan.x) / scale, y: (cursorpt.y - pan.y) / scale });
    } else if (arrowDrawMouse) {
      setArrowDrawMouse(null);
    }
    handleMouseMove(e); // preserve existing drag logic
  };

  // Clear selection when clicking on empty canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget) {
      selectNode(undefined);
      selectArc(undefined);
      pendingArcStart.current = null;
      setArcError(null);
      console.log('Canvas clicked, reset pendingArcStart');
    }
  };

  // Node mouse down: start drag or arc
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.ctrlKey) {
      // Arc creation logic
      if (!pendingArcStart.current) {
        pendingArcStart.current = nodeId;
        console.log('Arc start:', nodeId);
      } else if (pendingArcStart.current !== nodeId) {
        addArc(pendingArcStart.current, nodeId);
        pendingArcStart.current = null;
        console.log('Arc end:', nodeId);
      }
      return;
    }
    // Start drag
    const node = getNode(nodeId);
    if (node) {
      if (!canvasRef.current) return;
      const pt = canvasRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgStart = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
      dragStart.current = {
        x: svgStart.x, // SVG coordinates
        y: svgStart.y,
        nodeX: node.x,
        nodeY: node.y,
        nodeId,
      };
      setDraggingNodeId(nodeId);
      setIsDragging(false);
    }
  };

  // SVG mouse move: drag node or arc handle
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && dragStart.current) {
      if (!canvasRef.current) return;
      const pt = canvasRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
      const dx = cursorpt.x - dragStart.current.x;
      const dy = cursorpt.y - dragStart.current.y;
      if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        setIsDragging(true);
      }
      if (isDragging) {
        // Move node by delta in SVG coordinates (no history)
        useCLDStore.getState().moveNodeNoHistory(draggingNodeId, dragStart.current.nodeX + dx, dragStart.current.nodeY + dy);
      }
    } else if (pendingArcDragStart.current) {
      // Check if mouse moved enough to start drag
      const { arc, from, to, startClientX, startClientY } = pendingArcDragStart.current;
      const dx = (e as any).clientX - startClientX;
      const dy = (e as any).clientY - startClientY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        // Start drag
        // Compute arc drag start as before
        const dxArc = to.x - from.x;
        const dyArc = to.y - from.y;
        const len = Math.sqrt(dxArc * dxArc + dyArc * dyArc);
        const offsetX = (dxArc / len) * NODE_RADIUS;
        const offsetY = (dyArc / len) * NODE_RADIUS;
        const startX = from.x + offsetX;
        const startY = from.y + offsetY;
        const endX = to.x - offsetX;
        const endY = to.y - offsetY;
        const mx = (startX + endX) / 2;
        const my = (startY + endY) / 2;
        const dx2 = endX - startX;
        const dy2 = endY - startY;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        let nx = -dy2 / len2;
        let ny = dx2 / len2;
        // Set arcDragStart and arcDrag
        arcDragStart.current = { arcId: arc.id, mx, my, nx, ny, sign: 1 };
        setArcDrag({ arcId: arc.id, curvature: arc.curvature });
        pendingArcDragStart.current = null;
      }
    } else if (arcDrag && arcDragStart.current && arcDrag.arcId === arcDragStart.current.arcId) {
      // Only run this if arcDrag is set (i.e., after threshold exceeded)
      const arc = arcs.find(a => a.id === arcDrag.arcId);
      if (arc) {
        const from = getNode(arc.from);
        const to = getNode(arc.to);
        if (from && to) {
          if (!canvasRef.current) return;
          const pt = canvasRef.current.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
          const logicalX = (cursorpt.x - pan.x) / scale;
          const logicalY = (cursorpt.y - pan.y) / scale;
          const px = logicalX - arcDragStart.current.mx;
          const py = logicalY - arcDragStart.current.my;
          // Project mouse movement onto perpendicular
          let curvature = px * arcDragStart.current.nx + py * arcDragStart.current.ny;
          // Clamp as before
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const maxCurvature = (len / 2) - 1e-3;
          // Clamp curvature to [-maxCurvature, maxCurvature]
          let clampedCurvature = Math.max(-maxCurvature, Math.min(curvature, maxCurvature));
          // Enforce minimum absolute curvature (prevent straight line)
          if (Math.abs(clampedCurvature) < MIN_CURVATURE) {
            clampedCurvature = MIN_CURVATURE * Math.sign(clampedCurvature || 1);
          }
          setArcDrag({ arcId: arc.id, curvature: clampedCurvature });
        }
      }
    }
  };

  // SVG mouse up: end drag, select node if not dragged
  const handleMouseUp = (e: React.MouseEvent) => {
    if (draggingNodeId && dragStart.current) {
      if (!isDragging) {
        // Select node
        selectNode(dragStart.current.nodeId);
        console.log('Node selected:', dragStart.current.nodeId);
      } else {
        // Node was moved, push to history
        if (dragStart.current && canvasRef.current) {
          const pt = canvasRef.current.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
          const dx = cursorpt.x - dragStart.current.x;
          const dy = cursorpt.y - dragStart.current.y;
          useCLDStore.getState().moveNode(
            draggingNodeId,
            dragStart.current.nodeX + dx,
            dragStart.current.nodeY + dy
          );
        }
        console.log('Node moved:', dragStart.current.nodeId);
      }
    }
    setDraggingNodeId(null);
    setIsDragging(false);
    // Always clear pending arc drag on mouse up (prevents stuck drag on click)
    pendingArcDragStart.current = null;
    // Commit curvature if dragging control point
    if (arcDrag) {
      setArcCurvature(arcDrag.arcId, arcDrag.curvature);
    }
    setArcDrag(null);
    dragStart.current = null;
    // Do NOT clear arc selection here; only clear selection when clicking on canvas background
  };

  // --- Problem statement state ---
  const [problemStatement, setProblemStatement] = useState('Describe the problem here...');

  // --- State for highlighted loop ---
  const [highlightedLoopId, setHighlightedLoopId] = useState<string | null>(null);

  // --- Find all simple cycles and classify as reinforcing/balancing ---
  const cycles = findAllSimpleCycles(nodes, arcs);
  // Assign IDs to loops (L1, L2, ...)
  const loops = cycles.map((cyc, i) => {
    let product = 1;
    for (let j = 0; j < cyc.length; ++j) {
      const from = cyc[j];
      const to = cyc[(j + 1) % cyc.length];
      const arc = arcs.find(a => a.from === from && a.to === to);
      if (!arc) { product = 0; break; }
      product *= (arc.sign === '+' ? 1 : -1);
    }
    return {
      id: `L${i + 1}`,
      nodes: cyc,
      length: cyc.length,
      type: product === 1 ? 'R' : product === -1 ? 'B' : '?',
    };
  });

  // Restore these variables for the status bar
  const numVariables = nodes.length;
  const numConnections = arcs.length;
  const numLoops = loops.length;
  const highlightedLoop = highlightedLoopId ? loops.find(l => l.id === highlightedLoopId) : null;

  // --- Pan state ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // --- Zoom state ---
  const [scale, setScale] = useState(1);
  const MIN_SCALE = 0.3;
  const MAX_SCALE = 2.0;

  // --- Add state for menu bar zoom slider drag ---
  const menuBarRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  // Helper to zoom centered on canvas center
  const setScaleCentered = (newScale: number) => {
    if (!canvasRef.current) {
      setScale(newScale);
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const pt = canvasRef.current.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const center = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    // Adjust pan so zoom is centered on canvas center
    const dx = center.x - pan.x;
    const dy = center.y - pan.y;
    const newPan = {
      x: center.x - dx * (newScale / scale),
      y: center.y - dy * (newScale / scale),
    };
    setScale(newScale);
    setPan(newPan);
  };

  // Zoom handler
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (e.ctrlKey) return; // Let browser handle ctrl+scroll
    e.preventDefault();
    if (!canvasRef.current) return;
    const pt = canvasRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    // Compute new scale
    let newScale = scale * (e.deltaY < 0 ? 1.1 : 0.9);
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    // Adjust pan so zoom is centered on mouse
    const dx = cursorpt.x - pan.x;
    const dy = cursorpt.y - pan.y;
    const newPan = {
      x: cursorpt.x - dx * (newScale / scale),
      y: cursorpt.y - dy * (newScale / scale),
    };
    setScale(newScale);
    setPan(newPan);
  };

  // Pan handlers
  const handlePanMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1) { // Middle mouse
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      e.preventDefault();
    }
  };
  const handlePanMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning && panStart.current) {
      const dx = (e.clientX - panStart.current.x) / scale;
      const dy = (e.clientY - panStart.current.y) / scale;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  };
  const handlePanMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
    }
  };

  // Add this ref inside Canvas component:
  const pendingArcDragStart = useRef<null | {
    arc: ArcType;
    from: NodeType;
    to: NodeType;
    startClientX: number;
    startClientY: number;
  }>(null);

  // Add this helper inside Canvas component:
  function startArcCurvatureDrag(
    arc: ArcType,
    from: NodeType,
    to: NodeType,
    mouseClientX: number,
    mouseClientY: number
  ) {
    pendingArcDragStart.current = { arc, from, to, startClientX: mouseClientX, startClientY: mouseClientY };
  }

  // ... existing code ...
  const [filename, setFilename] = useState('Untitled');
  // ... existing code ...

  // --- Layout: left column for boxes, right for SVG ---
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* Left column: Problem statement and loops */}
        <div style={{
          width: 320,
          minWidth: 220,
          maxWidth: 400,
          background: '#ebebeb', // <--- CHANGE THIS LINE
          borderRight: '1px solid #e0e0e0',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {/* Problem Statement Box */}
          <div style={{ marginBottom: 12, flexShrink: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Problem Statement</div>
            <textarea
              value={problemStatement}
              onChange={e => setProblemStatement(e.target.value)}
              style={{ width: '100%', minHeight: 80, maxHeight: 500, fontSize: 15, padding: 8, borderRadius: 6, border: '1px solid #bbb', resize: 'vertical', background: '#fff', color: '#222', boxSizing: 'border-box', overflowY: 'auto' }}
            />
          </div>
          {/* Loops Box */}
          <div style={{ background: '#fff', border: '1px solid #bbb', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px #0001', fontSize: 15, maxHeight: '40vh', overflowY: 'auto', flexShrink: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 10 }}>Loops</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #bbb', textAlign: 'left', padding: '4px 8px' }}>ID</th>
                  <th style={{ borderBottom: '1px solid #bbb', textAlign: 'center', padding: '4px 8px' }}>Length</th>
                  <th style={{ borderBottom: '1px solid #bbb', textAlign: 'center', padding: '4px 8px' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {loops.map(loop => (
                  <tr
                    key={loop.id}
                    style={{ background: highlightedLoopId === loop.id ? '#e3eaf5' : 'none', cursor: 'pointer' }}
                    onClick={() => setHighlightedLoopId(highlightedLoopId === loop.id ? null : loop.id)}
                  >
                    <td style={{ padding: '4px 8px', fontWeight: 600, userSelect: 'none' }}>{loop.id}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', userSelect: 'none' }}>{loop.length}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'center', color: loop.type === 'R' ? '#d32f2f' : loop.type === 'B' ? '#388e3c' : '#888', fontWeight: 'bold', userSelect: 'none' }}>{loop.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loops.length === 0 && <div style={{ color: '#888', marginTop: 8 }}>No loops found.</div>}
          </div>
        </div>
        {/* Right: SVG canvas and overlays */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', height: '100%', overflow: 'hidden' }}>
          <svg
            ref={canvasRef}
        width="100%"
        height="100%"
            style={{ background: '#fff', cursor: isPanning ? 'grabbing' : (ctrlPressed ? 'crosshair' : (arcDrag ? 'pointer' : 'default')), display: 'block' }}
        onDoubleClick={handleDoubleClick}
            onMouseMove={e => { handleCanvasMouseMove(e); handlePanMouseMove(e); }}
            onMouseUp={e => { handleMouseUp(e); handlePanMouseUp(e); }}
            onMouseDown={e => { handlePanMouseDown(e); if (e.target === e.currentTarget) setHighlightedLoopId(null); handleCanvasMouseDown(e); }}
            onWheel={handleWheel}
      >
        {/* Place all markers in a single <defs> block at the top of the SVG */}
        <defs>
          {arcs.map(arc => {
            const markerId = `arrow-${arc.id}-${arc.color.replace('#','')}`;
            return (
              <marker
                key={markerId}
                id={markerId}
                markerWidth={30}
                markerHeight={12}
                refX={8}
                refY={6}
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L16,6 L0,12 Z" fill={arc.color} />
              </marker>
            );
          })}
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* Guideline for arc creation */}
          {pendingArcStart.current && arrowDrawMouse && (() => {
            const from = getNode(pendingArcStart.current);
            if (!from) return null;
            return (
              <line
                x1={from.x}
                y1={from.y}
                x2={arrowDrawMouse.x}
                y2={arrowDrawMouse.y}
                stroke="#43a047"
                strokeWidth={2}
                strokeDasharray="6 6"
                opacity={0.7}
                pointerEvents="none"
              />
            );
          })()}
          {/* Render arcs */}
          {arcs.map(arc => {
            const from = getNode(arc.from);
            const to = getNode(arc.to);
            if (!from || !to) return null;
            // Use local curvature if dragging this arc's control point
            const curvature = arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature;
            const refCircle = getRefCircleParams(from, to, curvature);
            if (!refCircle) return null;
            const endpoints = getArcEndpoints(from, to, refCircle, { curvatureSign: 1 } as ArcType);
            if (!endpoints) return null;
            const { start, end } = endpoints;
            // Arc style: shadow highlight if in highlighted loop, normal otherwise
            let isInHighlightedLoop = false;
            let loopType: string = '?';
            if (highlightedLoopId) {
              const loop = loops.find(l => l.id === highlightedLoopId);
              if (loop) {
                loopType = loop.type;
                for (let i = 0; i < loop.nodes.length; ++i) {
                  const f = loop.nodes[i];
                  const t = loop.nodes[(i + 1) % loop.nodes.length];
                  if (arc.from === f && arc.to === t) {
                    isInHighlightedLoop = true;
                    break;
                  }
                }
              }
            }
            // Compute angles for start and end relative to refCircle center
            const startAngle = Math.atan2((start?.y ?? from.y) - refCircle.cy, (start?.x ?? from.x) - refCircle.cx);
            const endAngle = Math.atan2((end?.y ?? to.y) - refCircle.cy, (end?.x ?? to.x) - refCircle.cx);
            // Compute sweepFlag so the arc passes through the control point
            // Instead, set sweepFlag based only on arc.curvatureSign:
            const sweepFlag = arc.curvatureSign > 0 ? 1 : 0;
            const arcPolyline = describeArcPolyline(refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle, sweepFlag);
            // Arc midpoint for ID label
            let delta = endAngle - startAngle;
            if (sweepFlag === 1 && delta < 0) delta += Math.PI * 2;
            if (sweepFlag === 0 && delta > 0) delta -= Math.PI * 2;
            if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
            const midArcAngle = startAngle + 0.5 * delta;
            const midArcX = refCircle.cx + refCircle.r * Math.cos(midArcAngle);
            const midArcY = refCircle.cy + refCircle.r * Math.sin(midArcAngle);
            const arcLabelX = refCircle.cx + refCircle.r * Math.cos(midArcAngle);
            const arcLabelY = refCircle.cy + refCircle.r * Math.sin(midArcAngle);
            // --- Dynamic SIGN_T calculation ---
            const SIGN_DIST = 20; // px, desired distance from arrowhead
            const arcLength = refCircle.r * Math.abs(delta);
            let SIGN_T = 1 - (SIGN_DIST / arcLength);
            SIGN_T = Math.max(0, Math.min(1, SIGN_T)); // Clamp to [0, 1]
            const isHovered = hoveredArcId === arc.id;
            const isSelected = selection.arcId === arc.id;
            let arcStroke = arc.color;
            let arcStrokeWidth = 2;
            if (isSelected) {
              arcStrokeWidth = 4;
            } else if (isHovered) {
              arcStrokeWidth = 5;
            }
            // Shadow filter for highlighted loop
            const shadowColor = loopType === 'R' ? 'rgba(220,0,0,0.7)' : loopType === 'B' ? 'rgba(0,180,60,0.7)' : 'rgba(0,0,0,0.2)';
            const shadowFilter = isInHighlightedLoop ? `drop-shadow(0px 0px 8px ${shadowColor}) drop-shadow(0px 0px 4px ${shadowColor})` : 'none';
            const markerId = `arrow-${arc.id}-${arc.color.replace('#','')}`;
            return (
              <g key={arc.id}
                onMouseEnter={() => setHoveredArcId(arc.id)}
                onMouseLeave={() => setHoveredArcId(null)}
              >
                {/* Reference circle (dotted) for debugging */}
                {devMode && (
                  <circle
                    cx={refCircle.cx}
                    cy={refCircle.cy}
                    r={refCircle.r}
                    fill="none"
                    stroke="#90caf9"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                )}
                {/* Invisible thick path for easy interaction */}
                <path
                  d={arcPolyline}
                  stroke="black"
                  strokeWidth={24}
                  strokeOpacity={0}
                  fill="none"
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => {
                    selectArc(arc.id); // Always select arc on drag start
                    // Immediately start drag, not just pending
                    const dxArc = to.x - from.x;
                    const dyArc = to.y - from.y;
                    const len = Math.sqrt(dxArc * dxArc + dyArc * dyArc);
                    const offsetX = (dxArc / len) * NODE_RADIUS;
                    const offsetY = (dyArc / len) * NODE_RADIUS;
                    const startX = from.x + offsetX;
                    const startY = from.y + offsetY;
                    const endX = to.x - offsetX;
                    const endY = to.y - offsetY;
                    const mx = (startX + endX) / 2;
                    const my = (startY + endY) / 2;
                    const dx2 = endX - startX;
                    const dy2 = endY - startY;
                    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    let nx = -dy2 / len2;
                    let ny = dx2 / len2;
                    arcDragStart.current = { arcId: arc.id, mx, my, nx, ny, sign: 1 };
                    setArcDrag({ arcId: arc.id, curvature: arc.curvature });
                    e.stopPropagation();
                  }}
                />
                {/* Visible arc with shadow if highlighted */}
                <path
                  d={arcPolyline}
                  stroke={arcStroke}
                  strokeWidth={arcStrokeWidth}
                  fill="none"
                  markerEnd={`url(#${markerId})`}
                  style={{ filter: shadowFilter, transition: 'filter 0.2s', cursor: 'pointer', pointerEvents: 'none' }}
                />
                {/* Arc sign toggle: interactive transparent circle and text for display */}
                <g>
                  <circle
                    cx={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcX = refCircle.cx + refCircle.r * Math.cos(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpX = -tangentY;
                      return arcX + perpX * SIGN_PERP;
                    })()}
                    cy={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcY = refCircle.cy + refCircle.r * Math.sin(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpY = tangentX;
                      return arcY + perpY * SIGN_PERP;
                    })()}
                    r={16 / scale}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onClick={e => { updateArcSign(arc.id); e.stopPropagation(); }}
                  />
                  <text
                    x={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcX = refCircle.cx + refCircle.r * Math.cos(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpX = -tangentY;
                      return arcX + perpX * SIGN_PERP;
                    })()}
                    y={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcY = refCircle.cy + refCircle.r * Math.sin(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpY = tangentX;
                      return arcY + perpY * SIGN_PERP;
                    })()}
                    fontSize={26 / scale}
                    fill={arc.sign === '+' ? '#388e3c' : '#d32f2f'}
                    fontWeight="bold"
                    fontFamily="'DejaVu Sans Mono', 'Consolas', 'Arial', 'Times New Roman', serif"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {arc.sign === '-' ? '−' : arc.sign}
                  </text>
                </g>
                {/* Debug overlay: show sign position as a magenta dot in dev mode */}
                {devMode && (
                  <circle
                    cx={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcX = refCircle.cx + refCircle.r * Math.cos(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpX = -tangentY;
                      return arcX + perpX * SIGN_PERP;
                    })()}
                    cy={(() => {
                      const SIGN_PERP = 10;
                      const signAngle = startAngle + SIGN_T * delta;
                      const arcY = refCircle.cy + refCircle.r * Math.sin(signAngle);
                      const tangentX = -Math.sin(signAngle);
                      const tangentY = Math.cos(signAngle);
                      const perpY = tangentX;
                      return arcY + perpY * SIGN_PERP;
                    })()}
                    r={6 / scale}
                    fill="#e040fb"
                    stroke="#6a1b9a"
                    strokeWidth={2}
                    style={{ pointerEvents: 'none' }}
                  />
                )}
                {/* Debug overlay: plot arc start and end points as blue dots in dev mode */}
                {devMode && (
                  <>
                    <circle
                      cx={start?.x ?? from.x}
                      cy={start?.y ?? from.y}
                      r={5 / scale}
                      fill="#2196f3"
                      stroke="#0d47a1"
                      strokeWidth={2}
                      style={{ pointerEvents: 'none' }}
                    />
                    <circle
                      cx={end?.x ?? to.x}
                      cy={end?.y ?? to.y}
                      r={5 / scale}
                      fill="#2196f3"
                      stroke="#0d47a1"
                      strokeWidth={2}
                      style={{ pointerEvents: 'none' }}
                    />
                  </>
                )}
                {/* Draggable control point for curvature (crosshair, dev mode only) */}
                {isSelected && (
                  <g
                    style={{ cursor: ctrlPressed ? 'crosshair' : (arcDrag && arcDrag.arcId === arc.id ? 'pointer' : 'pointer') }}
                    onMouseEnter={() => setHoveredControlArcId(arc.id)}
                    onMouseLeave={() => setHoveredControlArcId(null)}
                    onMouseDown={e => {
                      startArcCurvatureDrag(arc, from, to, e.clientX, e.clientY);
                      e.stopPropagation();
                    }}
                    onDoubleClick={e => {
                      updateArcSign(arc.id);
                      e.stopPropagation();
                    }}
                  >
                    {/* Control point: colored circle only, no crosshair */}
                    <circle
                      cx={(from.x + to.x) / 2 + (- (to.y - from.y) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                      cy={(from.y + to.y) / 2 + ((to.x - from.x) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                      r={9 / scale}
                      fill={hoveredControlArcId === arc.id ? (arc.sign === '+' ? '#e8f5e9' : '#ffebee') : '#fff'}
                      stroke={(() => {
                        if (arc.sign === '+') return hoveredControlArcId === arc.id ? '#43a047' : '#388e3c';
                        if (arc.sign === '-') return hoveredControlArcId === arc.id ? '#d32f2f' : '#b71c1c';
                        return '#1976d2';
                      })()}
                      strokeWidth={hoveredControlArcId === arc.id ? 3 : 2}
                      style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }}
                      onDoubleClick={e => {
                        updateArcSign(arc.id);
                        e.stopPropagation();
                      }}
                      onMouseDown={e => {
                        startArcCurvatureDrag(arc, from, to, e.clientX, e.clientY);
                        e.stopPropagation();
                      }}
                    />
                  </g>
                )}
              </g>
            );
          })}
          {/* Render nodes */}
          {nodes.map(node => {
            const isSelected = selection.nodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isPendingArcStart = pendingArcStart.current === node.id;
            // Arrow-draw mode: highlight TO node with green shadow
            const isArrowDrawTo = ctrlPressed && pendingArcStart.current && isHovered && node.id !== pendingArcStart.current;
            // Arrow-draw mode: highlight FROM node (pendingArcStart)
            const isArcFromNode = ctrlPressed && pendingArcStart.current === node.id;
            const borderColor = isPendingArcStart
              ? '#ffd600' // yellow for pending arc start
              : (isHovered || isSelected) ? '#1976d2' : '#bbb';
            return (
              <g
                key={node.id}
                onMouseDown={e => {
                  if (e.ctrlKey) {
                    handleNodeCtrlClick(node.id);
                    e.stopPropagation();
                    console.log('Ctrl+click on node', node.id, 'pendingArcStart:', pendingArcStart.current);
                    return;
                  }
                  selectArc(undefined);
                  handleNodeMouseDown(e, node.id);
                  pendingArcStart.current = null;
                  setArcError(null);
                  console.log('Node clicked (no Ctrl), reset pendingArcStart');
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{ cursor: ctrlPressed ? 'crosshair' : 'pointer' }}
              >
                {/* Development: show reference circle as dotted line */}
                {devMode && (() => {
                  const fontSize = 16;
                  const { width, height } = estimateLabelSize(node.label, fontSize);
                  const padding = 16;
                  const rx = width / 2 + padding;
                  const ry = height / 2 + padding;
                  return (
                    <ellipse
                      cx={node.x}
                      cy={node.y}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke="#bbb"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />
                  );
                })()}
                {/* Node label: editable on double click */}
                {editingNodeId === node.id ? (
                  <foreignObject
                    x={node.x - 60}
                    y={node.y - 32}
                    width={120}
                    height={64}
                    style={{ pointerEvents: 'auto' }}
                  >
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <textarea
                        ref={inputRef as any}
                        autoFocus
                        value={editingLabel}
                        onChange={e => setEditingLabel(e.target.value)}
                        onBlur={() => {
                          updateNodeLabel(node.id, editingLabel.trim() || `var_${node.id}`);
                          setEditingNodeId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            updateNodeLabel(node.id, editingLabel.trim() || `var_${node.id}`);
                            setEditingNodeId(null);
                            e.preventDefault();
                          } else if (e.key === 'Escape') {
                            setEditingNodeId(null);
                            e.preventDefault();
                          }
                        }}
                        style={{
                          width: '100%',
                          height: 'auto',
                          minHeight: '1.2em',
                          fontSize: isSelected ? 20 : 16,
                          fontWeight: isArcFromNode || isSelected || isHovered ? 'bold' : 'normal',
                          fontStyle: 'normal',
                          color: node.color,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                          caretColor: '#1976d2',
                          padding: 0,
                          margin: 0,
                          fontFamily: 'inherit',
                          lineHeight: 1.2,
                          userSelect: 'auto',
                          filter: isArcFromNode
                            ? 'drop-shadow(0 0 48px #43a047) drop-shadow(0 0 32px #43a047) drop-shadow(0 0 16px #43a047) drop-shadow(0 0 8px #43a047)'
                            : isArrowDrawTo
                              ? 'drop-shadow(0 0 32px rgba(67,160,71,0.9)) drop-shadow(0 0 16px #43a047) drop-shadow(0 0 8px #43a047)'
                              : (isSelected || isHovered)
                                ? (ctrlPressed ? 'drop-shadow(0 0 8px #43a047)' : 'drop-shadow(0px 2px 6px rgba(255,140,0,1)) drop-shadow(0px 0px 2px rgba(255,140,0,1))')
                                : 'none',
                        }}
                      />
                    </div>
                  </foreignObject>
                ) : (
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isSelected ? 20 : 16}
                    fill={node.color}
                    fontStyle={'normal'}
                    fontWeight={isArcFromNode || isSelected || isHovered ? 'bold' : 'normal'}
                    filter={isArrowDrawTo
                      ? 'drop-shadow(0 0 32px rgba(67,160,71,0.9)) drop-shadow(0 0 16px #43a047) drop-shadow(0 0 8px #43a047)'
                      : isArcFromNode
                        ? 'drop-shadow(0 0 48px #43a047) drop-shadow(0 0 32px #43a047) drop-shadow(0 0 16px #43a047) drop-shadow(0 0 8px #43a047)'
                        : (isSelected || isHovered)
                          ? (ctrlPressed ? 'drop-shadow(0 0 8px #43a047)' : 'drop-shadow(0px 2px 6px rgba(255,140,0,1)) drop-shadow(0px 0px 2px rgba(255,140,0,1))')
                          : 'none'}
                    style={{ userSelect: 'none', whiteSpace: 'pre', transition: 'font-size 0.15s, filter 0.15s' }}
                    onDoubleClick={e => {
                      setEditingNodeId(node.id);
                      setEditingLabel(node.label);
                      setCaretPos(node.label.length);
                      e.stopPropagation();
                    }}
                  >
                    {node.label.split('\n').map((line, i) => (
                      <tspan key={i} x={node.x} dy={i === 0 ? 0 : 22}>{line}</tspan>
                    ))}
                  </text>
                )}
                {/* Node ID label */}
                {devMode && (
                  <text
                    x={node.x + NODE_RADIUS + 8}
                    y={node.y - NODE_RADIUS - 8}
                    fontSize={11 / scale}
                    fill="#1b5e20"
                    textAnchor="start"
                    dominantBaseline="middle"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.id}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
        </div> {/* End of right SVG canvas and overlays */}
      </div> {/* End of main app layout row */}
      {/* Status Bar (moved here, as a sibling to the flex row) */}
      <div style={{
        position: 'fixed', // was 'absolute'
        left: 0,
        right: 0,
        bottom: 0,
        height: 36,
        background: '#f5f5f7',
        borderTop: '1px solid #ddd',
        color: '#333',
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 10,
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        minHeight: 36,
      }}>
        <span>
          <b>{filename}</b> | <b>{numVariables}</b> variable{numVariables !== 1 ? 's' : ''} | <b>{numConnections}</b> connection{numConnections !== 1 ? 's' : ''} | <b>{numLoops}</b> loop{numLoops !== 1 ? 's' : ''}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {highlightedLoop && highlightedLoop.id && highlightedLoop.type ? (
            <span>
              Highlighted: <b>{highlightedLoop?.id}</b> ({highlightedLoop?.type === 'R' ? 'Reinforcing' : highlightedLoop?.type === 'B' ? 'Balancing' : '?'})
            </span>
          ) : (
            <span style={{ color: '#888' }}>No loop highlighted</span>
          )}
          {/* Dev mode toggle icon */}
          <span
            title={devMode ? 'Dev mode ON' : 'Dev mode OFF'}
            onClick={() => setDevMode(v => !v)}
            style={{
              marginLeft: 18,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              userSelect: 'none',
              color: devMode ? '#444' : '#888',
              fontSize: 22,
              transition: 'color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#e0e0e0'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
          >
            {/* Simple bug icon SVG */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill={devMode ? '#444' : 'none'} stroke={devMode ? '#444' : '#888'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
              <circle cx="11" cy="14" r="5" fill={devMode ? '#444' : 'none'} />
              <line x1="11" y1="3" x2="11" y2="8" />
              <line x1="4" y1="14" x2="18" y2="14" />
              <line x1="6" y1="10" x2="3" y2="7" />
              <line x1="16" y1="10" x2="19" y2="7" />
              <line x1="6" y1="18" x2="3" y2="21" />
              <line x1="16" y1="18" x2="19" y2="21" />
            </svg>
          </span>
          {/* Zoom slider */}
      <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.01}
              value={scale}
              onChange={e => setScaleCentered(Number(e.target.value))}
              style={{ width: 90, marginLeft: 18 }}
              title="Zoom level"
            />
          <span style={{ minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1976d2', fontWeight: 600, fontSize: 15 }}>{(scale * 100).toFixed(0)}%</span>
          {/* Reset zoom button (target icon) */}
          <span
            onClick={() => { setScaleCentered(1); setPan({ x: 0, y: 0 }); }}
            style={{ marginLeft: 8, background: 'none', border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 20, cursor: 'pointer', color: '#1976d2', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}
            title="Reset zoom and pan"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <circle cx="11" cy="11" r="3" />
              <line x1="11" y1="2" x2="11" y2="5" />
              <line x1="11" y1="17" x2="11" y2="20" />
              <line x1="2" y1="11" x2="5" y2="11" />
              <line x1="17" y1="11" x2="20" y2="11" />
            </svg>
          </span>
        </span>
      </div> {/* End of status bar */}
      {devMode && (
        <div style={{ position: 'fixed', bottom: 48, right: 8, background: '#fff', color: '#222', padding: 16, borderRadius: 10, fontSize: 14, zIndex: 1000, opacity: 0.97, border: '1px solid #bbb', minWidth: 260, boxShadow: '0 2px 8px #0001', maxWidth: 340 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Dev Info</div>
          {/* App State List */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>App State</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {DEV_STATES.map(s => (
                <li key={s.key} style={{
                  padding: '2px 0',
                  fontWeight: getCurrentDevState({
                    editingNodeId,
                    draggingNodeId,
                    arcDrag,
                    selection,
                    pendingArcStart: pendingArcStart.current,
                    ctrlPressed,
                    hoveredArcId,
                    hoveredNodeId,
                    hoveredDummyControlArcId,
                    draggingCurvatureArcId,
                    arcError,
                  }) === s.key ? 700 : 400,
                  color: getCurrentDevState({
                    editingNodeId,
                    draggingNodeId,
                    arcDrag,
                    selection,
                    pendingArcStart: pendingArcStart.current,
                    ctrlPressed,
                    hoveredArcId,
                    hoveredNodeId,
                    hoveredDummyControlArcId,
                    draggingCurvatureArcId,
                    arcError,
                  }) === s.key ? '#1976d2' : '#222',
                  background: getCurrentDevState({
                    editingNodeId,
                    draggingNodeId,
                    arcDrag,
                    selection,
                    pendingArcStart: pendingArcStart.current,
                    ctrlPressed,
                    hoveredArcId,
                    hoveredNodeId,
                    hoveredDummyControlArcId,
                    draggingCurvatureArcId,
                    arcError,
                  }) === s.key ? '#e3eaf5' : 'none',
                  borderRadius: 4,
                  marginBottom: 1,
                  paddingLeft: 6,
                }}>{s.label}</li>
              ))}
            </ul>
          </div>
          {/* Message Console */}
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Message Console</div>
          <div style={{ fontSize: 13, color: '#333' }}>
            <div>Selected node: <b>{selection.nodeId ?? 'none'}</b></div>
            <div>Selected arc: <b>{selection.arcId ?? 'none'}</b></div>
            <div>Hovered node: <b>{hoveredNodeId ?? 'none'}</b></div>
            <div>Hovered arc: <b>{hoveredArcId ?? 'none'}</b></div>
            <div>Pending arc start: <b>{pendingArcStart.current ?? 'none'}</b></div>
            {arcError && <div style={{ color: '#ff5252', marginTop: 8 }}>Arc error: {arcError}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas; 