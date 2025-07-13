import React, { useState, useRef, useEffect } from 'react';
import { useCLDStore } from '../state/cldStore';
import type { CLDState } from '../state/cldStore';
import type { NodeType } from '../state/cldStore';

const NODE_RADIUS = 32;
const HANDLE_RADIUS = 8;
const DRAG_THRESHOLD = 4; // px
const ARROWHEAD_LENGTH = 12;

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

const Canvas: React.FC = () => {
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
  const [devMode, setDevMode] = useState(true);

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
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
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
      const endpoints = getArcEndpoints(from, to, refCircle);
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
      addNode(cursorpt.x, cursorpt.y);
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
    const endpoints = getArcEndpoints(from, to, refCircle);
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
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
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
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        setIsDragging(true);
      }
      if (isDragging) {
        const svg = (e.target as SVGSVGElement).ownerSVGElement || (e.target as SVGSVGElement);
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        moveNode(draggingNodeId, cursorpt.x, cursorpt.y);
      }
    } else if (arcDrag) {
      const arc = arcs.find(a => a.id === arcDrag.arcId);
      if (arc) {
        const from = getNode(arc.from);
        const to = getNode(arc.to);
        if (from && to) {
          // Drag control point along perpendicular bisector of offset endpoints
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const offsetX = (dx / len) * NODE_RADIUS;
          const offsetY = (dy / len) * NODE_RADIUS;
          const startX = from.x + offsetX;
          const startY = from.y + offsetY;
          const endX = to.x - offsetX;
          const endY = to.y - offsetY;
          const mx = (startX + endX) / 2;
          const my = (startY + endY) / 2;
          const dx2 = endX - startX;
          const dy2 = endY - startY;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          const nx = -dy2 / len2;
          const ny = dx2 / len2;
          const svg = (e.target as SVGSVGElement).ownerSVGElement || (e.target as SVGSVGElement);
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
          // Project cursorpt onto the perpendicular bisector
          const px = cursorpt.x - mx;
          const py = cursorpt.y - my;
          // Fix direction: dragging in the direction of the mouse increases curvature intuitively
          const dist = px * nx + py * ny;

          // Clamp curvature so that the reference circle's diameter is less than the node distance
          // Compute the maximum allowed |curvature| for this node pair
          // The reference circle's diameter D = d / sin(theta), where theta is the angle at the control point
          // For the perpendicular bisector, the max is just under d/2 (to avoid collinearity)
          const maxCurvature = (len2 / 2) - 1e-3; // Small epsilon to avoid degeneracy
          let clampedDist = Math.max(Math.min(dist, maxCurvature), -maxCurvature);

          setArcDrag({ arcId: arc.id, curvature: clampedDist });
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
        console.log('Node moved:', dragStart.current.nodeId);
      }
    }
    setDraggingNodeId(null);
    setIsDragging(false);
    // Commit curvature if dragging control point
    if (arcDrag) {
      setArcCurvature(arcDrag.arcId, arcDrag.curvature);
    }
    setArcDrag(null);
    dragStart.current = null;
  };

  // Add to arc type: sweepFlag (0 or 1)
  // In arc creation, default to sweepFlag: 0
  // Add a function to toggle sweepFlag
  const toggleArcSweep = (arcId: string) => {
    useCLDStore.setState(state => ({
      arcs: state.arcs.map(a => a.id === arcId ? { ...a, sweepFlag: a.sweepFlag === 1 ? 0 : 1 } : a)
    }));
  };

  // Helper to get dynamic node radius
  const getNodeRadius = (node: NodeType) => {
    const fontSize = (selection.nodeId === node.id || hoveredNodeId === node.id) ? 20 : 16;
    const { width, height } = estimateLabelSize(node.label, fontSize);
    const padding = 16;
    return Math.sqrt((width / 2) ** 2 + (height / 2) ** 2) + padding;
  };

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
    cx: number, cy: number, r: number, startAngle: number, endAngle: number, sweepFlag: number,
    ellipseCx: number, ellipseCy: number, rx: number, ry: number,
    searchFromStart: boolean = true,
    segments: number = 100
  ): { x: number, y: number } | null {
    // Sample points along the arc
    let delta = endAngle - startAngle;
    if (sweepFlag === 1 && delta < 0) delta += Math.PI * 2;
    if (sweepFlag === 0 && delta > 0) delta -= Math.PI * 2;
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
        return { x: x0, y: y0 };
      }
      prevInside = inside;
      prevPt = { x, y };
    }
    // Fallback: return closest sampled point
    return prevPt;
  }

  const getArcEndpoints = (from: NodeType, to: NodeType, refCircle: { cx: number; cy: number; r: number }) => {
    // Use robust arc-ellipse intersection for both nodes
    const fontSizeFrom = (selection.nodeId === from.id || hoveredNodeId === from.id) ? 20 : 16;
    const fontSizeTo = (selection.nodeId === to.id || hoveredNodeId === to.id) ? 20 : 16;
    const { width: wFrom, height: hFrom } = estimateLabelSize(from.label, fontSizeFrom);
    const { width: wTo, height: hTo } = estimateLabelSize(to.label, fontSizeTo);
    const padding = 16;
    const rxFrom = Math.abs(wFrom / 2 + padding);
    const ryFrom = Math.abs(hFrom / 2 + padding);
    const rxTo = Math.abs(wTo / 2 + padding);
    const ryTo = Math.abs(hTo / 2 + padding);
    // Arc angles
    const startAngle = Math.atan2(from.y - refCircle.cy, from.x - refCircle.cx);
    const endAngle = Math.atan2(to.y - refCircle.cy, to.x - refCircle.cx);
    // Sweep flag: always minor arc
    let delta = endAngle - startAngle;
    let sweepFlag = 1;
    if (Math.abs(delta) > Math.PI) sweepFlag = 0;
    // Start: intersection of arc with 'from' ellipse (search from start)
    const start = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle, sweepFlag,
      from.x, from.y, rxFrom, ryFrom, true
    );
    // End: intersection of arc with 'to' ellipse (search from end)
    const end = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle, sweepFlag,
      to.x, to.y, rxTo, ryTo, false
    );
    return { start, end };
  };

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

  // Add a helper to darken a hex color
  function darkenColor(hex: string, factor: number = 0.7) {
    // Remove # if present
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.min(255, Math.round(r * factor)));
    g = Math.max(0, Math.min(255, Math.round(g * factor)));
    b = Math.max(0, Math.min(255, Math.round(b * factor)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  const lightenDarkenColor = (col: string, amt: number) => {
    let usePound = false;
    if (col[0] === "#") {
      col = col.slice(1);
      usePound = true;
    }
    const num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    let g = ((num >> 8) & 0x00ff) + amt;
    let b = (num & 0x0000ff) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    const rStr = ("0" + (r.toString(16))).slice(-2);
    const gStr = ("0" + (g.toString(16))).slice(-2);
    const bStr = ("0" + (b.toString(16))).slice(-2);
    return (usePound ? "#" : "") + rStr + gStr + bStr;
  };

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

  // Track mouse position for arrow-draw mode
  const [arrowDrawMouse, setArrowDrawMouse] = useState<{x: number, y: number} | null>(null);

  // Update mouse position on mouse move (only in arrow-draw mode)
  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (ctrlPressed && pendingArcStart.current) {
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorpt = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      setArrowDrawMouse({ x: cursorpt.x, y: cursorpt.y });
    } else if (arrowDrawMouse) {
      setArrowDrawMouse(null);
    }
    handleMouseMove(e); // preserve existing drag logic
  };

  return (
    <>
      <svg
        width="100%"
        height="100%"
        style={{ background: '#fff', cursor: ctrlPressed ? 'crosshair' : (arcDrag ? 'pointer' : 'default'), display: 'block' }}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
      >
        <defs>
          {/* One marker per arc, colored to match the arc, always same size */}
          {arcs.map(arc => {
            const from = getNode(arc.from);
            const to = getNode(arc.to);
            if (!from || !to) return null;
            const isSelected = selection.arcId === arc.id;
            let color = arc.color;
            if (isSelected) {
              color = lightenDarkenColor(arc.color, -40);
            } else if (hoveredArcId === arc.id) {
              color = lightenDarkenColor(arc.color, -40);
            }
            return (
              <marker
                key={arc.id}
                id={`arrow-${arc.id}`}
                markerWidth="16"
                markerHeight="12"
                refX="16"
                refY="6"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <path d="M0,0 L16,6 L0,12 Z" fill={color} />
              </marker>
            );
          })}
        </defs>
        {/* Arrow-draw mode: draw straight dotted line to mouse and highlight TO node */}
        {ctrlPressed && pendingArcStart.current && arrowDrawMouse && (() => {
          const fromNode = getNode(pendingArcStart.current);
          if (fromNode) {
            return (
              <g>
                {/* Dotted line from origin to mouse position */}
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={arrowDrawMouse.x}
                  y2={arrowDrawMouse.y}
                  stroke="#43a047"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  pointerEvents="none"
                />
              </g>
            );
          }
          return null;
        })()}
        {/* Render arcs */}
        {arcs.map(arc => {
          const from = getNode(arc.from);
          const to = getNode(arc.to);
          if (!from || !to) return null;
          // Use local curvature if dragging this arc's control point
          const curvature = arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature;
          console.log(`Arc ${arc.id}: rendering with curvature`, curvature);
          const refCircle = getRefCircleParams(from, to, curvature);
          if (!refCircle) {
            console.warn('Reference circle could not be computed for arc', arc);
            return null;
          }
          const endpoints = getArcEndpoints(from, to, refCircle);
          if (!endpoints) return null;
          const { start, end } = endpoints;
          // Debug: print ellipse params and endpoints
          const fontSizeFrom = (arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature);
          const { width: wFrom, height: hFrom } = estimateLabelSize(from.label, fontSizeFrom);
          const { width: wTo, height: hTo } = estimateLabelSize(to.label, fontSizeFrom);
          const padding = 16;
          const rxFrom = Math.abs(wFrom / 2 + padding);
          const ryFrom = Math.abs(hFrom / 2 + padding);
          const rxTo = Math.abs(wTo / 2 + padding);
          const ryTo = Math.abs(hTo / 2 + padding);
          console.log(`Arc ${arc.id}: from ellipse center=(${from.x},${from.y}) rx=${rxFrom} ry=${ryFrom}, to ellipse center=(${to.x},${to.y}) rx=${rxTo} ry=${ryTo}, start=`, start, 'end=', end);
          // For debugging: draw the reference circle
          const isHovered = hoveredArcId === arc.id;
          const isSelected = selection.arcId === arc.id;
          let arcStroke = arc.color;
          if (isSelected) {
            arcStroke = lightenDarkenColor(arc.color, -40); // slightly darken
          } else if (isHovered) {
            arcStroke = lightenDarkenColor(arc.color, -40); // a bit more darken
          }
          // Arc midpoint for ID label
          const midAngle = Math.atan2(((start?.y ?? from.y) + (end?.y ?? to.y)) / 2 - refCircle.cy, ((start?.x ?? from.x) + (end?.x ?? to.x)) / 2 - refCircle.cx);
          const arcLabelX = refCircle.cx + refCircle.r * Math.cos(midAngle);
          const arcLabelY = refCircle.cy + refCircle.r * Math.sin(midAngle);

          // Compute angles for start and end relative to refCircle center
          const startAngle = Math.atan2((start?.y ?? from.y) - refCircle.cy, (start?.x ?? from.x) - refCircle.cx);
          const endAngle = Math.atan2((end?.y ?? to.y) - refCircle.cy, (end?.x ?? to.x) - refCircle.cx);

          // Compute sweepFlag so the arc passes through the control point
          // Recompute the control point (same as in getRefCircleParams)
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const nx = -dy / len;
          const ny = dx / len;
          const control = { x: mx + nx * curvature, y: my + ny * curvature };
          // Vectors from center to start and control
          const vStart = { x: (start?.x ?? from.x) - refCircle.cx, y: (start?.y ?? from.y) - refCircle.cy };
          const vControl = { x: control.x - refCircle.cx, y: control.y - refCircle.cy };
          // Cross product to determine sweep
          const cross = vStart.x * vControl.y - vStart.y * vControl.x;
          const sweepFlag = cross > 0 ? 1 : 0;

          const arcPolyline = describeArcPolyline(refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle, sweepFlag);

          // Compute arc-wise midpoint for dummy control point (t=0.5)
          let delta = endAngle - startAngle;
          if (sweepFlag === 1 && delta < 0) delta += Math.PI * 2;
          if (sweepFlag === 0 && delta > 0) delta -= Math.PI * 2;
          if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
          const midArcAngle = startAngle + 0.5 * delta;
          const midArcX = refCircle.cx + refCircle.r * Math.cos(midArcAngle);
          const midArcY = refCircle.cy + refCircle.r * Math.sin(midArcAngle);

          // Restore sign label position near arrowhead
          // Place sign at a fixed fraction along the arc, then offset perpendicularly
          const SIGN_T = 0.9; // fraction along the arc (0=start, 1=end)
          const SIGN_PERP = 10; // px perpendicular offset
          // Compute arc angles
          const arcStartAngle = Math.atan2((start?.y ?? from.y) - refCircle.cy, (start?.x ?? from.x) - refCircle.cx);
          const arcEndAngle = Math.atan2((end?.y ?? to.y) - refCircle.cy, (end?.x ?? to.x) - refCircle.cx);
          let arcDelta = arcEndAngle - arcStartAngle;
          if (Math.abs(arcDelta) > Math.PI) arcDelta = arcDelta > 0 ? arcDelta - 2 * Math.PI : arcDelta + 2 * Math.PI;
          const signAngle = arcStartAngle + SIGN_T * arcDelta;
          // Point on arc
          const arcX = refCircle.cx + refCircle.r * Math.cos(signAngle);
          const arcY = refCircle.cy + refCircle.r * Math.sin(signAngle);
          // Tangent at that point (derivative of circle parametric)
          const tangentX = -Math.sin(signAngle);
          const tangentY = Math.cos(signAngle);
          // Perpendicular (left side)
          const perpX = -tangentY;
          const perpY = tangentX;
          // Offset the sign
          const signX = arcX + perpX * SIGN_PERP;
          const signY = arcY + perpY * SIGN_PERP;

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
                style={{ cursor: ctrlPressed ? 'crosshair' : (arcDrag && arcDrag.arcId === arc.id ? 'pointer' : 'pointer') }}
                onMouseDown={e => {
                  selectArc(arc.id);
                  setArcDrag({ arcId: arc.id, curvature });
                  e.stopPropagation();
                }}
              />
              {/* Visible arc */}
              <path
                d={arcPolyline}
                stroke={arcStroke}
                strokeWidth={isSelected ? 4 : 2}
                fill="none"
                markerEnd={`url(#arrow-${arc.id})`}
              />
              {/* Arc ID label */}
              {devMode && (
                <text
                  x={arcLabelX}
                  y={arcLabelY}
                  fontSize={11}
                  fill="#b71c1c"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {arc.id}
                </text>
              )}
              {/* Dummy control point for sign toggle (arc-wise midpoint) */}
              {(isSelected || isHovered) && (
                <circle
                  cx={midArcX}
                  cy={midArcY}
                  r={HANDLE_RADIUS}
                  fill={
                    hoveredDummyControlArcId === arc.id
                      ? (arc.sign === '+' ? '#b9f6ca' : '#ffcdd2')
                      : (arc.sign === '+' ? '#e8f5e9' : '#ffebee')
                  }
                  stroke={arc.sign === '+' ? '#388e3c' : '#d32f2f'}
                  strokeWidth={hoveredDummyControlArcId === arc.id ? 4 : 2}
                  style={{
                    cursor: ctrlPressed ? 'crosshair' : (arcDrag && arcDrag.arcId === arc.id ? 'pointer' : 'pointer'),
                    filter: hoveredDummyControlArcId === arc.id ? 'drop-shadow(0 0 4px #8884)' : 'none'
                  }}
                  onMouseEnter={() => setHoveredDummyControlArcId(arc.id)}
                  onMouseLeave={() => setHoveredDummyControlArcId(null)}
                  onMouseDown={e => {
                    setArcDrag({ arcId: arc.id, curvature });
                    e.stopPropagation();
                  }}
                  onDoubleClick={e => {
                    updateArcSign(arc.id);
                    e.stopPropagation();
                  }}
                />
              )}
              {/* Arc sign toggle: transparent circle for click, text for display */}
              <text
                x={signX}
                y={signY}
                fontSize={26}
                fill={arc.sign === '+' ? '#388e3c' : '#d32f2f'}
                fontWeight="bold"
                fontFamily="'DejaVu Sans Mono', 'Consolas', 'Arial', 'Times New Roman', serif"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {arc.sign === '-' ? '−' : arc.sign}
              </text>
              {/* Debug overlay: show sign position as a magenta dot in dev mode */}
              {devMode && (
                <circle
                  cx={signX}
                  cy={signY}
                  r={6}
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
                    r={5}
                    fill="#2196f3"
                    stroke="#0d47a1"
                    strokeWidth={2}
                    style={{ pointerEvents: 'none' }}
                  />
                  <circle
                    cx={end?.x ?? to.x}
                    cy={end?.y ?? to.y}
                    r={5}
                    fill="#2196f3"
                    stroke="#0d47a1"
                    strokeWidth={2}
                    style={{ pointerEvents: 'none' }}
                  />
                </>
              )}
              {/* Draggable control point for curvature (crosshair, dev mode only) */}
              {devMode && isSelected && (
                <g
                  style={{ cursor: ctrlPressed ? 'crosshair' : (arcDrag && arcDrag.arcId === arc.id ? 'pointer' : 'pointer') }}
                  onMouseEnter={() => setHoveredControlArcId(arc.id)}
                  onMouseLeave={() => setHoveredControlArcId(null)}
                  onMouseDown={e => {
                    setArcDrag({ arcId: arc.id, curvature });
                    e.stopPropagation();
                  }}
                >
                  {/* Crosshair shape */}
                  <line
                    x1={(from.x + to.x) / 2 + (- (to.y - from.y) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature - HANDLE_RADIUS}
                    y1={(from.y + to.y) / 2 + ((to.x - from.x) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                    x2={(from.x + to.x) / 2 + (- (to.y - from.y) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature + HANDLE_RADIUS}
                    y2={(from.y + to.y) / 2 + ((to.x - from.x) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                    stroke={hoveredControlArcId === arc.id ? '#1565c0' : '#1976d2'}
                    strokeWidth={hoveredControlArcId === arc.id ? 3 : 2}
                  />
                  <line
                    x1={(from.x + to.x) / 2 + (- (to.y - from.y) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                    y1={(from.y + to.y) / 2 + ((to.x - from.x) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature - HANDLE_RADIUS}
                    x2={(from.x + to.x) / 2 + (- (to.y - from.y) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature}
                    y2={(from.y + to.y) / 2 + ((to.x - from.x) / Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2)) * curvature + HANDLE_RADIUS}
                    stroke={hoveredControlArcId === arc.id ? '#1565c0' : '#1976d2'}
                    strokeWidth={hoveredControlArcId === arc.id ? 3 : 2}
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
                const fontSize = isSelected || isHovered ? 20 : 16;
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
                      fontSize: isSelected || isHovered ? 20 : 16,
                      fontWeight: isSelected ? 'bold' : 'normal',
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
                      filter: isArrowDrawTo
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
                  fontSize={isSelected || isHovered ? 20 : 16}
                  fill={node.color}
                  fontStyle={'normal'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  filter={isArrowDrawTo
                    ? 'drop-shadow(0 0 32px rgba(67,160,71,0.9)) drop-shadow(0 0 16px #43a047) drop-shadow(0 0 8px #43a047)'
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
                  fontSize={11}
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
      </svg>
      {/* Developer console (HTML, outside SVG) */}
      <DevConsole selection={selection} hoveredNodeId={hoveredNodeId} hoveredArcId={hoveredArcId} pendingArcStart={pendingArcStart.current} arcError={arcError} />
      {/* Dev mode toggle checkbox */}
      <div style={{ position: 'fixed', bottom: 12, left: 12, background: '#fff', border: '1px solid #bbb', borderRadius: 6, padding: '6px 12px', zIndex: 1100, fontSize: 15, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          id="devModeToggle"
          checked={devMode}
          onChange={e => setDevMode(e.target.checked)}
          style={{ marginRight: 6 }}
        />
        <label htmlFor="devModeToggle" style={{ cursor: 'pointer', userSelect: 'none' }}>Dev Mode</label>
      </div>
    </>
  );
};

export default Canvas; 