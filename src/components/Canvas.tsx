import React, { useState, useRef, useEffect } from 'react';
import { useCLDStore } from '../state/cldStore';
import type { CLDState } from '../state/cldStore';

const NODE_RADIUS = 32;
const HANDLE_RADIUS = 8;
const DRAG_THRESHOLD = 4; // px

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
  }, [pendingArcStart.current]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; nodeX: number; nodeY: number; nodeId: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingArcId, setDraggingArcId] = useState<string | null>(null);
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

  // Dev mode toggle
  const [devMode, setDevMode] = useState(true);

  // Delete selected node or arc on Delete key
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
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
  }, [selection.nodeId, selection.arcId]);

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
      const startAngle = Math.atan2(start.y - refCircle.cy, start.x - refCircle.cx);
      const endAngle = Math.atan2(end.y - refCircle.cy, end.x - refCircle.cx);
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
      addNode(cursorpt.x, cursorpt.y);
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
    } else if (draggingArcId) {
      const arc = arcs.find(a => a.id === draggingArcId);
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

          setDraggingCurvature(clampedDist);
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
    if (draggingArcId && draggingCurvatureArcId === draggingArcId && draggingCurvature !== null) {
      setArcCurvature(draggingArcId, draggingCurvature);
    }
    setDraggingArcId(null);
    setDraggingCurvatureArcId(null);
    setDraggingCurvature(null);
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

  function getArcParams(from: { x: number; y: number }, to: { x: number; y: number }, sweepFlag: number) {
    // Compute direction from node1 to node2
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    // Tangent points on each node's circumference
    const startX = from.x + ux * NODE_RADIUS;
    const startY = from.y + uy * NODE_RADIUS;
    const endX = to.x - ux * NODE_RADIUS;
    const endY = to.y - uy * NODE_RADIUS;
    // Vectors from tangent points to centers
    const vx1 = from.x - startX;
    const vy1 = from.y - startY;
    const vx2 = to.x - endX;
    const vy2 = to.y - endY;
    // Find intersection of lines: (startX, startY) + t1*(vx1, vy1) and (endX, endY) + t2*(vx2, vy2)
    // Solve for t1, t2: (startX + t1*vx1, startY + t1*vy1) = (endX + t2*vx2, endY + t2*vy2)
    // => t1*vx1 - t2*vx2 = endX - startX
    //    t1*vy1 - t2*vy2 = endY - startY
    // Use Cramer's rule
    const a = vx1, b = -vx2, c = endX - startX;
    const d = vy1, e = -vy2, f = endY - startY;
    const det = a * e - b * d;
    let arcCenterX, arcCenterY, r;
    if (Math.abs(det) > 1e-6) {
      const t1 = (c * e - b * f) / det;
      arcCenterX = startX + t1 * vx1;
      arcCenterY = startY + t1 * vy1;
      r = Math.sqrt((arcCenterX - startX) ** 2 + (arcCenterY - startY) ** 2);
    } else {
      // Fallback: use midpoint and large radius
      arcCenterX = (startX + endX) / 2;
      arcCenterY = (startY + endY) / 2;
      r = len / 2 / Math.sin(Math.PI / 6); // 60 deg arc
    }
    return {
      startX,
      startY,
      endX,
      endY,
      r,
      sweepFlag,
    };
  }

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

  // Arc rendering helpers
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

  function getArcEndpoints(from: Point, to: Point, refCircle: { cx: number; cy: number; r: number }) {
    // Find intersection points of refCircle with each node's reference circle
    const center: Point = { x: refCircle.cx, y: refCircle.cy };
    const intersections1 = getCircleCircleIntersections(center, refCircle.r, from, NODE_RADIUS);
    const intersections2 = getCircleCircleIntersections(center, refCircle.r, to, NODE_RADIUS);
    if (intersections1.length === 0 || intersections2.length === 0) {
      console.warn('No intersection found for arc endpoints', { from, to, refCircle, intersections1, intersections2 });
      return null;
    }
    // Choose the intersection in the direction of the other node
    const dir1 = { x: to.x - from.x, y: to.y - from.y };
    const dir2 = { x: from.x - to.x, y: from.y - to.y };
    const pickClosestInDirection = (pts: Point[], origin: Point, dir: Point) => {
      if (pts.length === 1) return pts[0];
      const d0 = (pts[0].x - origin.x) * dir.x + (pts[0].y - origin.y) * dir.y;
      const d1 = (pts[1].x - origin.x) * dir.x + (pts[1].y - origin.y) * dir.y;
      return d0 > d1 ? pts[0] : pts[1];
    };
    const start = pickClosestInDirection(intersections1, from, dir1);
    const end = pickClosestInDirection(intersections2, to, dir2);
    return { start, end };
  }

  function distance(p1: Point, p2: Point) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
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

  return (
    <>
      <svg
        width="100%"
        height="100%"
        style={{ background: '#fff', cursor: ctrlPressed ? 'crosshair' : (draggingArcId ? 'pointer' : 'default'), display: 'block' }}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="12"
            markerHeight="8"
            refX="11"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L12,4 L0,8 Z" fill="#888" />
          </marker>
        </defs>
        {/* Render arcs */}
        {arcs.map(arc => {
          const from = getNode(arc.from);
          const to = getNode(arc.to);
          if (!from || !to) return null;
          // Use local curvature if dragging this arc's control point
          const curvature = draggingCurvatureArcId === arc.id && draggingCurvature !== null ? draggingCurvature : arc.curvature;
          const refCircle = getRefCircleParams(from, to, curvature);
          if (!refCircle) {
            console.warn('Reference circle could not be computed for arc', arc);
            return null;
          }
          const endpoints = getArcEndpoints(from, to, refCircle);
          if (!endpoints) return null;
          const { start, end } = endpoints;
          // For debugging: draw the reference circle
          const isHovered = hoveredArcId === arc.id;
          const isSelected = selection.arcId === arc.id;
          const arcStroke = (isHovered || isSelected) ? '#1976d2' : arc.color;
          // Arc midpoint for ID label
          const midAngle = Math.atan2((start.y + end.y) / 2 - refCircle.cy, (start.x + end.x) / 2 - refCircle.cx);
          const arcLabelX = refCircle.cx + refCircle.r * Math.cos(midAngle);
          const arcLabelY = refCircle.cy + refCircle.r * Math.sin(midAngle);

          // Compute angles for start and end relative to refCircle center
          const startAngle = Math.atan2(start.y - refCircle.cy, start.x - refCircle.cx);
          const endAngle = Math.atan2(end.y - refCircle.cy, end.x - refCircle.cx);

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
          const vStart = { x: start.x - refCircle.cx, y: start.y - refCircle.cy };
          const vControl = { x: control.x - refCircle.cx, y: control.y - refCircle.cy };
          // Cross product to determine sweep
          const cross = vStart.x * vControl.y - vStart.y * vControl.x;
          const sweepFlag = cross > 0 ? 1 : 0;

          const arcPath = describeArc(refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle, sweepFlag);
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
          // Place sign along the line from node center through arc endpoint, outside the node's reference circle
          const SIGN_MARGIN = 32; // px outside the node reference circle
          const dxSign = end.x - to.x;
          const dySign = end.y - to.y;
          const lenSign = Math.sqrt(dxSign * dxSign + dySign * dySign);
          const uxSign = dxSign / lenSign;
          const uySign = dySign / lenSign;
          // Compute normal (perpendicular) to the arrow direction at the endpoint
          const nxSign = -uySign;
          const nySign = uxSign;
          // Offset the sign both radially and perpendicularly to avoid the arrow
          const NORMAL_MARGIN = 18; // px perpendicular offset
          const relLabelX = to.x + uxSign * (NODE_RADIUS + SIGN_MARGIN) + nxSign * NORMAL_MARGIN;
          const relLabelY = to.y + uySign * (NODE_RADIUS + SIGN_MARGIN) + nySign * NORMAL_MARGIN;

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
                style={{ cursor: ctrlPressed ? 'crosshair' : (draggingArcId === arc.id ? 'pointer' : 'pointer') }}
                onMouseDown={e => {
                  selectArc(arc.id);
                  setDraggingArcId(arc.id);
                  setDraggingCurvatureArcId(arc.id);
                  setDraggingCurvature(curvature);
                  e.stopPropagation();
                }}
              />
              {/* Visible arc */}
              <path
                d={arcPolyline}
                stroke={arcStroke}
                strokeWidth={2}
                fill="none"
                markerEnd="url(#arrow)"
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
                    cursor: ctrlPressed ? 'crosshair' : (draggingArcId === arc.id ? 'pointer' : 'pointer'),
                    filter: hoveredDummyControlArcId === arc.id ? 'drop-shadow(0 0 4px #8884)' : 'none'
                  }}
                  onMouseEnter={() => setHoveredDummyControlArcId(arc.id)}
                  onMouseLeave={() => setHoveredDummyControlArcId(null)}
                  onMouseDown={e => {
                    setDraggingArcId(arc.id);
                    setDraggingCurvatureArcId(arc.id);
                    setDraggingCurvature(curvature);
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
                x={relLabelX}
                y={relLabelY}
                fontSize={26}
                fill={arc.sign === '+' ? '#388e3c' : '#d32f2f'}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {arc.sign}
              </text>
              {/* Draggable control point for curvature (crosshair, dev mode only) */}
              {devMode && isSelected && (
                <g
                  style={{ cursor: ctrlPressed ? 'crosshair' : (draggingArcId === arc.id ? 'pointer' : 'pointer') }}
                  onMouseEnter={() => setHoveredControlArcId(arc.id)}
                  onMouseLeave={() => setHoveredControlArcId(null)}
                  onMouseDown={e => {
                    setDraggingArcId(arc.id);
                    setDraggingCurvatureArcId(arc.id);
                    setDraggingCurvature(curvature);
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
              {devMode && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS + 8}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                />
              )}
              {devMode && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS}
                  fill="none"
                  stroke="#bbb"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              )}
              {(isSelected || isHovered || isPendingArcStart) && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={NODE_RADIUS}
                  fill={isHovered && !isSelected && !isPendingArcStart ? '#e3f2fd' : 'none'}
                  stroke={borderColor}
                  strokeWidth={2}
                />
              )}
              {/* Node label: editable on double click */}
              {editingNodeId === node.id ? (
                <foreignObject
                  x={node.x - 50}
                  y={node.y - 16}
                  width={100}
                  height={32}
                  style={{ pointerEvents: 'auto' }}
                >
                  <input
                    ref={inputRef}
                    value={editingLabel}
                    onChange={e => setEditingLabel(e.target.value)}
                    onBlur={() => {
                      updateNodeLabel(node.id, editingLabel.trim() || 'Variable');
                      setEditingNodeId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        updateNodeLabel(node.id, editingLabel.trim() || 'Variable');
                        setEditingNodeId(null);
                      } else if (e.key === 'Escape') {
                        setEditingNodeId(null);
                      }
                    }}
                    style={{ width: '100%', fontSize: 16, textAlign: 'center', border: '1px solid #1976d2', borderRadius: 4, outline: 'none', padding: 0 }}
                  />
                </foreignObject>
              ) : (
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={16}
                  fill={node.color}
                  style={{ userSelect: 'none' }}
                  onDoubleClick={e => {
                    setEditingNodeId(node.id);
                    setEditingLabel(node.label);
                    e.stopPropagation();
                  }}
                >
                  {node.label}
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
      <div style={{ position: 'fixed', bottom: 12, right: 12, background: '#fff', border: '1px solid #bbb', borderRadius: 6, padding: '6px 12px', zIndex: 1100, fontSize: 15, boxShadow: '0 2px 8px #0001', display: 'flex', alignItems: 'center', gap: 8 }}>
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