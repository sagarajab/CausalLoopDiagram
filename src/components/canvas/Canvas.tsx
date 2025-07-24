import React, { useState, useRef, useEffect } from 'react';
import { useCLDStore } from '../../state/cldStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { getAllLoops, isArcInLoop } from '../../utils/loopAnalysis';
import { CONSTANTS } from '../../types';
import { Node } from '../../components/canvas/Node';
import { Arc } from '../../components/canvas/Arc';
import { Sidebar } from '../../components/canvas/Sidebar';
import { StatusBar } from '../../components/canvas/StatusBar';
import { DevPanel } from '../../components/canvas/DevPanel';
import '../globalLayoutFix.css';

export const Canvas: React.FC = () => {
  // Store state
  const nodes = useCLDStore(state => state.nodes);
  const arcs = useCLDStore(state => state.arcs);
  const selection = useCLDStore(state => state.selection);
  const addNode = useCLDStore(state => state.addNode);
  const addArc = useCLDStore(state => state.addArc);
  const selectNode = useCLDStore(state => state.selectNode);
  const selectArc = useCLDStore(state => state.selectArc);
  const moveNode = useCLDStore(state => state.moveNode);
  const updateNodeLabel = useCLDStore(state => state.updateNodeLabel);
  const updateArcSign = useCLDStore(state => state.updateArcSign);
  const removeNode = useCLDStore(state => state.removeNode);
  const removeArc = useCLDStore(state => state.removeArc);

  // Canvas interaction hook
  const {
    canvasState,
    interactionState,
    canvasRef,
    setInteractionState,
    handlePanMouseDown,
    handlePanMouseMove,
    handlePanMouseUp,
    handleWheel,
    setScaleCentered,
    resetView,
    screenToCanvas,
  } = useCanvasInteraction();

  // Local state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [arcDrag, setArcDrag] = useState<{ arcId: string, curvature: number } | null>(null);
  const [arcError, setArcError] = useState<string | null>(null);
  const [problemStatement, setProblemStatement] = useState('Describe the problem here...');
  const [highlightedLoopId, setHighlightedLoopId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [arrowDrawMouse, setArrowDrawMouse] = useState<{ x: number; y: number } | null>(null);

  // Refs
  const dragStart = useRef<{ x: number; y: number; nodeX: number; nodeY: number; nodeId: string } | null>(null);
  const arcDragStart = useRef<null | { arcId: string, mx: number, my: number, nx: number, ny: number, sign: number }>(null);
  const pendingArcDragStart = useRef<null | {
    arc: any;
    from: any;
    to: any;
    startClientX: number;
    startClientY: number;
  }>(null);

  // Computed values
  const loops = getAllLoops(nodes, arcs);
  const highlightedLoop = highlightedLoopId ? loops.find(l => l.id === highlightedLoopId) : null;

  // Delete key handler and global mouse handlers
  useEffect(() => {
    const handleDelete = (e: KeyboardEvent) => {
      if (e.key === 'Delete') {
        if (selection.nodeId) {
          removeNode(selection.nodeId);
        } else if (selection.arcId) {
          removeArc(selection.arcId);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu
    };



    window.addEventListener('keydown', handleDelete);
    window.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      window.removeEventListener('keydown', handleDelete);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [selection.nodeId, selection.arcId, removeNode, removeArc, setInteractionState]);




  // Mouse event handlers
  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    
    const pt = canvasRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    const canvasPoint = screenToCanvas(e.clientX, e.clientY);
    
    // Check if clicking over existing elements
    const overNode = nodes.some(node => {
      const dx = canvasPoint.x - node.x;
      const dy = canvasPoint.y - node.y;
      return Math.sqrt(dx * dx + dy * dy) < CONSTANTS.NODE_RADIUS + 8;
    });

    if (!overNode) {
      const nextId = (nodes.length > 0 ? Math.max(...nodes.map(n => Number(n.id))) + 1 : 1).toString();
      addNode(canvasPoint.x, canvasPoint.y);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button === 2) { // Right mouse button
      e.preventDefault();
      e.stopPropagation();
      
      // If we already have a FROM node and we're clicking on a different node, create the arc
      if (interactionState.pendingArcStart && interactionState.pendingArcStart !== nodeId) {
        // Check if arc already exists
        if (arcs.some(a => a.from === interactionState.pendingArcStart && a.to === nodeId)) {
          setArcError(`Arc from ${interactionState.pendingArcStart} to ${nodeId} already exists.`);
        } else {
          // Create the arc
          addArc(interactionState.pendingArcStart!, nodeId);
          setArcError(null);
        }
        // Clear the pending arc start but keep right mouse pressed for potential more arcs
        setInteractionState(prev => ({ 
          ...prev, 
          pendingArcStart: null 
        }));
      } else if (!interactionState.pendingArcStart) {
        // First click - set this as the FROM node
        setInteractionState(prev => ({ 
          ...prev, 
          rightMousePressed: true,
          pendingArcStart: nodeId 
        }));
        setArcError(null);
      } else if (interactionState.pendingArcStart === nodeId) {
        // Clicking on the same node, cancel the operation
        setArcError('Cannot create self-loop.');
        setInteractionState(prev => ({ 
          ...prev, 
          pendingArcStart: null 
        }));
      }
      return;
    }
    
    // Left mouse button - check if right mouse is already pressed
    if (interactionState.rightMousePressed) {
      // If we already have a FROM node and we're clicking on a different node, create the arc
      if (interactionState.pendingArcStart && interactionState.pendingArcStart !== nodeId) {
        // Check if arc already exists
        if (arcs.some(a => a.from === interactionState.pendingArcStart && a.to === nodeId)) {
          setArcError(`Arc from ${interactionState.pendingArcStart} to ${nodeId} already exists.`);
        } else {
          // Create the arc
          addArc(interactionState.pendingArcStart!, nodeId);
          setArcError(null);
        }
        // Clear the pending arc start but keep right mouse pressed for potential more arcs
        setInteractionState(prev => ({ 
          ...prev, 
          pendingArcStart: null 
        }));
      } else if (!interactionState.pendingArcStart) {
        // First click while holding right mouse - set this as the FROM node
        setInteractionState(prev => ({ 
          ...prev, 
          pendingArcStart: nodeId 
        }));
        setArcError(null);
      } else if (interactionState.pendingArcStart === nodeId) {
        // Clicking on the same node, cancel the operation
        setArcError('Cannot create self-loop.');
        setInteractionState(prev => ({ 
          ...prev, 
          pendingArcStart: null 
        }));
      }
      return;
    }

    const node = nodes.find(n => n.id === nodeId);
    if (node && canvasRef.current) {
      const pt = canvasRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgStart = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
      
      dragStart.current = {
        x: svgStart.x,
        y: svgStart.y,
        nodeX: node.x,
        nodeY: node.y,
        nodeId,
      };
      setDraggingNodeId(nodeId);
      setIsDragging(false);
    }
  };



  const handleMouseMove = (e: React.MouseEvent) => {
    // Handle arrow drawing preview
    if (interactionState.rightMousePressed) {
      if (!canvasRef.current) return;
      const canvasPoint = screenToCanvas(e.clientX, e.clientY);
      setArrowDrawMouse(canvasPoint);
    } else if (arrowDrawMouse) {
      setArrowDrawMouse(null);
    }

    // Handle node dragging
    if (draggingNodeId && dragStart.current) {
      if (!canvasRef.current) return;
      
      const pt = canvasRef.current.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
      const dx = cursorpt.x - dragStart.current.x;
      const dy = cursorpt.y - dragStart.current.y;
      
      if (!isDragging && (Math.abs(dx) > CONSTANTS.DRAG_THRESHOLD || Math.abs(dy) > CONSTANTS.DRAG_THRESHOLD)) {
        setIsDragging(true);
      }
      
      if (isDragging) {
        useCLDStore.getState().moveNodeNoHistory(
          draggingNodeId, 
          dragStart.current.nodeX + dx, 
          dragStart.current.nodeY + dy
        );
      }
    }

    // Handle arc curvature dragging
    if (arcDrag && arcDragStart.current && arcDrag.arcId === arcDragStart.current.arcId) {
      const arc = arcs.find(a => a.id === arcDrag.arcId);
      if (arc) {
        const from = nodes.find(n => n.id === arc.from);
        const to = nodes.find(n => n.id === arc.to);
        if (from && to && canvasRef.current) {
          const pt = canvasRef.current.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
          const logicalX = (cursorpt.x - canvasState.pan.x) / canvasState.scale;
          const logicalY = (cursorpt.y - canvasState.pan.y) / canvasState.scale;
          
          const px = logicalX - arcDragStart.current.mx;
          const py = logicalY - arcDragStart.current.my;
          let curvature = px * arcDragStart.current.nx + py * arcDragStart.current.ny;
          
          // Clamp curvature
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const maxCurvature = (len / 2) - 1e-3;
          let clampedCurvature = Math.max(-maxCurvature, Math.min(curvature, maxCurvature));
          
          if (Math.abs(clampedCurvature) < CONSTANTS.MIN_CURVATURE) {
            clampedCurvature = CONSTANTS.MIN_CURVATURE * Math.sign(clampedCurvature || 1);
          }
          
          setArcDrag({ arcId: arc.id, curvature: clampedCurvature });
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {

    if (draggingNodeId && dragStart.current) {
      if (!isDragging) {
        selectNode(dragStart.current.nodeId);
      } else if (canvasRef.current) {
        const pt = canvasRef.current.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
        const dx = cursorpt.x - dragStart.current.x;
        const dy = cursorpt.y - dragStart.current.y;
        moveNode(
          draggingNodeId,
          dragStart.current.nodeX + dx,
          dragStart.current.nodeY + dy
        );
      }
    }
    
    setDraggingNodeId(null);
    setIsDragging(false);
    pendingArcDragStart.current = null;
    
    if (arcDrag) {
      useCLDStore.setState(state => ({
        arcs: state.arcs.map(a => a.id === arcDrag.arcId ? { ...a, curvature: arcDrag.curvature } : a)
      }));
    }
    setArcDrag(null);
    dragStart.current = null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === e.currentTarget) {
      if (e.button === 2) { // Right mouse button on empty canvas
        e.preventDefault();
        e.stopPropagation();
        // Don't clear pendingArcStart when right-clicking on empty space
        // This allows dragging from a node to empty space
      } else {
        // Left click on empty canvas - clear everything
        selectNode(undefined);
        selectArc(undefined);
        setInteractionState(prev => ({ ...prev, pendingArcStart: null }));
        setArcError(null);
        setHighlightedLoopId(null);
      }
    }
  };

  // Arc event handlers
  const handleArcMouseDown = (e: React.MouseEvent, arcId: string) => {
    selectArc(arcId);
    const arc = arcs.find(a => a.id === arcId);
    if (arc) {
      const from = nodes.find(n => n.id === arc.from);
      const to = nodes.find(n => n.id === arc.to);
      if (from && to) {
        const dxArc = to.x - from.x;
        const dyArc = to.y - from.y;
        const len = Math.sqrt(dxArc * dxArc + dyArc * dyArc);
        const offsetX = (dxArc / len) * CONSTANTS.NODE_RADIUS;
        const offsetY = (dyArc / len) * CONSTANTS.NODE_RADIUS;
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
      }
    }
    e.stopPropagation();
  };

  const handleControlPointMouseDown = (e: React.MouseEvent, arcId: string) => {
    const arc = arcs.find(a => a.id === arcId);
    if (arc) {
      const from = nodes.find(n => n.id === arc.from);
      const to = nodes.find(n => n.id === arc.to);
      if (from && to) {
        pendingArcDragStart.current = { 
          arc, from, to, startClientX: e.clientX, startClientY: e.clientY 
        };
      }
    }
    e.stopPropagation();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'row', height: '100%', width: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <Sidebar
          problemStatement={problemStatement}
          setProblemStatement={setProblemStatement}
          loops={loops}
          highlightedLoopId={highlightedLoopId}
          setHighlightedLoopId={setHighlightedLoopId}
        />

        {/* Canvas area */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', height: '100%', overflow: 'hidden' }}>
          <svg
            ref={canvasRef}
            width="100%"
            height="100%"
            style={{ 
              background: '#fff', 
              cursor: canvasState.isPanning ? 'grabbing' : 
                     (interactionState.rightMousePressed ? 'crosshair' : 
                     (arcDrag ? 'pointer' : 'default')), 
              display: 'block' 
            }}
            onDoubleClick={handleDoubleClick}
            onMouseMove={e => { 
              handleMouseMove(e); 
              handlePanMouseMove(e); 
            }}
            onMouseUp={e => { 
              // Handle right mouse button release
              if (e.button === 2) {

                // Use callback to get current state
                setInteractionState(prev => {
                  // When right mouse is released, clear everything
                  setArrowDrawMouse(null);
                  return {
                    ...prev,
                    pendingArcStart: null,
                    rightMousePressed: false
                  };
                });
              }
              handleMouseUp(e); 
              handlePanMouseUp(e); 
            }}
            onMouseDown={e => { 
              // Handle right mouse button on empty canvas
              if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                // Set right mouse pressed for empty canvas clicks
                setInteractionState(prev => ({ ...prev, rightMousePressed: true }));
              }
              handlePanMouseDown(e); 
              handleCanvasMouseDown(e); 
            }}
            onWheel={handleWheel}
          >
            {/* Arrow markers */}
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

            <g transform={`translate(${canvasState.pan.x},${canvasState.pan.y}) scale(${canvasState.scale})`}>
              {/* Guideline for arc creation */}
              {interactionState.rightMousePressed && arrowDrawMouse && (() => {
                if (interactionState.pendingArcStart) {
                  // Show line from start node to mouse cursor
                  const from = nodes.find(n => n.id === interactionState.pendingArcStart);
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
                } else {
                  // Show a small indicator at mouse cursor when in arrow mode but no start node
                  return (
                    <circle
                      cx={arrowDrawMouse.x}
                      cy={arrowDrawMouse.y}
                      r={3}
                      fill="#43a047"
                      opacity={0.7}
                      pointerEvents="none"
                    />
                  );
                }
              })()}

              {/* Render arcs */}
              {arcs.map(arc => {
                const fromNode = nodes.find(n => n.id === arc.from);
                const toNode = nodes.find(n => n.id === arc.to);
                if (!fromNode || !toNode) return null;

                const isInHighlightedLoop = highlightedLoopId && highlightedLoop ? 
                  isArcInLoop(arc, highlightedLoop) : false;

                return (
                  <Arc
                    key={arc.id}
                    arc={arc}
                    fromNode={fromNode}
                    toNode={toNode}
                    isSelected={selection.arcId === arc.id}
                    isHovered={interactionState.hoveredArcId === arc.id}
                    isInHighlightedLoop={isInHighlightedLoop}
                    highlightedLoopType={highlightedLoop?.type || '?'}
                    scale={canvasState.scale}
                    arcDrag={arcDrag}
                    onMouseEnter={(arcId) => setInteractionState(prev => ({ ...prev, hoveredArcId: arcId }))}
                    onMouseLeave={() => setInteractionState(prev => ({ ...prev, hoveredArcId: null }))}
                    onMouseDown={handleArcMouseDown}
                    onSignClick={updateArcSign}
                    onControlPointMouseDown={handleControlPointMouseDown}
                  />
                );
              })}

              {/* Render nodes */}
              {nodes.map(node => (
                <Node
                  key={node.id}
                  node={node}
                  isSelected={selection.nodeId === node.id}
                  isHovered={interactionState.hoveredNodeId === node.id}
                  isPendingArcStart={interactionState.pendingArcStart === node.id}
                  isArcFromNode={interactionState.rightMousePressed && interactionState.pendingArcStart === node.id}
                  isArrowDrawTo={!!(interactionState.rightMousePressed && interactionState.pendingArcStart && 
                                interactionState.hoveredNodeId === node.id && 
                                node.id !== interactionState.pendingArcStart)}
                  scale={canvasState.scale}
                  onMouseDown={handleNodeMouseDown}
                  onMouseEnter={(nodeId) => setInteractionState(prev => ({ ...prev, hoveredNodeId: nodeId }))}
                  onMouseLeave={() => setInteractionState(prev => ({ ...prev, hoveredNodeId: null }))}
                  onDoubleClick={(nodeId) => {/* Handle double click if needed */}}
                  onLabelUpdate={updateNodeLabel}
                />
              ))}

            </g>
          </svg>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        numVariables={nodes.length}
        numConnections={arcs.length}
        numLoops={loops.length}
        highlightedLoop={highlightedLoop || null}
        scale={canvasState.scale}
        setScaleCentered={setScaleCentered}
        resetView={resetView}
        devMode={devMode}
        setDevMode={setDevMode}
      />

      {/* Dev panel */}
      {devMode && (
        <DevPanel
          selection={selection}
          interactionState={interactionState}
          arcError={arcError}
          draggingNodeId={draggingNodeId}
          arcDrag={arcDrag}
        />
      )}
    </div>
  );
}; 