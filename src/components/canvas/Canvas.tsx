import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useCLDStore } from '../../state/cldStore';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import { getAllLoops, isArcInLoop } from '../../utils/loopAnalysis';
import { Node } from '../../components/canvas/Node';
import { Arc } from '../../components/canvas/Arc';
import { Sidebar } from '../../components/canvas/Sidebar';
import { StatusBar } from '../../components/canvas/StatusBar';
import { DevPanel, addLog } from '../../components/canvas/DevPanel';
import '../globalLayoutFix.css';

// Debounce hook for performance optimization
const useDebounce = (value: any, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Memoized Canvas component
export const Canvas: React.FC = React.memo(() => {
  // Store state - use selective subscriptions to prevent unnecessary re-renders
  const nodes = useCLDStore(state => state.nodes);
  const arcs = useCLDStore(state => state.arcs);
  const selection = useCLDStore(state => state.selection);
  // Debug: log selection.arcId on every render
  console.log('Canvas selection.arcId:', selection.arcId);
  const addNode = useCLDStore(state => state.addNode);
  const addArc = useCLDStore(state => state.addArc);
  const selectNode = useCLDStore(state => state.selectNode);
  const selectArc = useCLDStore(state => state.selectArc);
  console.log('selectArc function reference:', selectArc);
  const moveNode = useCLDStore(state => state.moveNode);
  const updateNodeLabel = useCLDStore(state => state.updateNodeLabel);
  const updateArcSign = useCLDStore(state => state.updateArcSign);
  const removeNode = useCLDStore(state => state.removeNode);
  const removeArc = useCLDStore(state => state.removeArc);
  
  // Canvas state from global store
  const canvasPan = useCLDStore(state => state.canvasPan);
  const canvasScale = useCLDStore(state => state.canvasScale);
  const problemStatement = useCLDStore(state => state.problemStatement);
  const setCanvasPan = useCLDStore(state => state.setCanvasPan);
  const setCanvasScale = useCLDStore(state => state.setCanvasScale);
  const setProblemStatement = useCLDStore(state => state.setProblemStatement);
  const resetCanvasView = useCLDStore(state => state.resetCanvasView);

  // Canvas interaction hook with global state
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
  } = useCanvasInteraction(canvasPan, canvasScale, setCanvasPan, setCanvasScale);
  


  // Local state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [arcDrag, setArcDrag] = useState<{ arcId: string, curvature: number } | null>(null);
  const [arcError, setArcError] = useState<string | null>(null);
  const [highlightedLoopId, setHighlightedLoopId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [arrowDrawMouse, setArrowDrawMouse] = useState<{ x: number; y: number } | null>(null);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  // Add editingNodeId state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  // Add new state for arrow draw mode and from node
  const [arrowDrawMode, setArrowDrawMode] = useState(false);
  const [arrowFromNodeId, setArrowFromNodeId] = useState<string | null>(null);

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
  const pendingArcStart = useRef<string | null>(null);
  const arcDragData = useRef<{ arcId: string, startCurvature: number, startX: number, startY: number, fromNode: any, toNode: any, offsetX: number, offsetY: number, curvature: number } | null>(null);

  // Debounced mouse position for better performance
  const debouncedArrowDrawMouse = useDebounce(arrowDrawMouse, 16); // ~60fps

  // Helper function to get node by ID
  const getNode = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);

  // Memoized computed values to prevent recalculation on every render
  const loops = useMemo(() => {
    // Only calculate loops when nodes or arcs change significantly
    if (nodes.length > 50 || arcs.length > 100) {
      // For large diagrams, use a simplified loop detection or cache results
      return [];
    }
    return getAllLoops(nodes, arcs);
  }, [nodes.length, arcs.length, nodes, arcs]);

  const highlightedLoop = useMemo(() => {
    return highlightedLoopId ? loops.find(l => l.id === highlightedLoopId) : null;
  }, [highlightedLoopId, loops]);

  // Arrow drawing logic
  const handleNodeRightClick = useCallback((nodeId: string) => {
    if (!pendingArcStart.current) {
      pendingArcStart.current = nodeId;
      setArcError(null);
      addLog(`Right-click on node ${nodeId}, starting arc creation`, 'info');
      return;
    }
    if (pendingArcStart.current === nodeId) {
      setArcError('Cannot create self-loop.');
      pendingArcStart.current = null;
      addLog(`Right-click on node ${nodeId}, cannot create self-loop`, 'warning');
      return;
    }
    // Check if arc already exists in this direction
    if (arcs.some(a => a.from === pendingArcStart.current && a.to === nodeId)) {
      setArcError(`Arc from ${pendingArcStart.current} to ${nodeId} already exists.`);
      pendingArcStart.current = null;
      addLog(`Right-click on node ${nodeId}, arc already exists`, 'warning');
      return;
    }
    // Create arc
    const fromNode = pendingArcStart.current;
    addArc(fromNode, nodeId);
    setArcError(null);
    pendingArcStart.current = null;
    addLog(`Arc created from ${fromNode} to ${nodeId}`, 'info');
  }, [arcs, addArc]);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    addLog(`Node mouse down: ${nodeId}, button: ${e.button}, arrowDrawMode: ${arrowDrawMode}, arrowFromNodeId: ${arrowFromNodeId}`, 'debug');
    if (arrowDrawMode && e.button === 0) { // Left click while in arrow draw mode
      if (!arrowFromNodeId) {
        setArrowFromNodeId(nodeId); // Select FROM node
        console.log('FROM node selected for arrow draw:', nodeId);
        addLog(`FROM node selected for arrow draw: ${nodeId}`, 'info');
        e.stopPropagation();
        return;
      } else if (arrowFromNodeId && arrowFromNodeId !== nodeId) {
        // Create arc from FROM to TO
        if (!arcs.some(a => a.from === arrowFromNodeId && a.to === nodeId)) {
          addArc(arrowFromNodeId, nodeId);
        } else {
          setArcError(`Arc from ${arrowFromNodeId} to ${nodeId} already exists.`);
        }
        setArrowDrawMode(false);
        setArrowFromNodeId(null);
        e.stopPropagation();
        return;
      }
    }
    if (e.button === 2) { // Right mouse button
      addLog(`Right mouse button detected on node: ${nodeId}`, 'info');
      // Don't stop propagation - let the global handler enter arrow draw mode
      // The old arc creation logic is handled by handleNodeRightClick if needed
      handleNodeRightClick(nodeId);
      // Don't call e.stopPropagation() - let the event bubble up to global handler
      return;
    }
    // Left click - start drag only
    if (e.button === 0) {
      addLog(`Left click on node: ${nodeId}, will select on mouse up if not dragged`, 'info');
      selectArc(undefined); // Clear arc selection when selecting node
      addLog(`Selection updated - nodeId: (pending), arcId: undefined`, 'debug');
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - canvasState.pan.x) / canvasState.scale;
      const y = (e.clientY - rect.top - canvasState.pan.y) / canvasState.scale;
      dragStart.current = { x: e.clientX, y: e.clientY, nodeX: x, nodeY: y, nodeId };
      setDraggingNodeId(nodeId);
      setIsDragging(false);
    }
  }, [canvasRef, canvasState.pan.x, canvasState.pan.y, canvasState.scale, handleNodeRightClick, selectArc, arrowDrawMode, arrowFromNodeId, arcs, addArc, setArcError, setArrowDrawMode, setArrowFromNodeId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.pan.x) / canvasState.scale;
    const y = (e.clientY - rect.top - canvasState.pan.y) / canvasState.scale;
    
    // Update arrow draw mouse position (debounced) - only for arrow draw mode
    console.log('Mouse move - checking arrow draw conditions:', { arrowDrawMode, arrowFromNodeId, arrowDrawMouse: !!arrowDrawMouse });
    if (arrowDrawMode && arrowFromNodeId) {
      setArrowDrawMouse({ x, y });
      console.log('Updating arrow draw mouse position:', { x, y, arrowDrawMode, arrowFromNodeId });
    } else if (arrowDrawMouse) {
      setArrowDrawMouse(null);
      console.log('Clearing arrow draw mouse position');
    }
    
    if (draggingNodeId && dragStart.current) {
      const deltaX = e.clientX - dragStart.current.x;
      const deltaY = e.clientY - dragStart.current.y;
      
      if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        setIsDragging(true);
      }
      
      if (isDragging) {
        const newX = dragStart.current.nodeX + deltaX / canvasState.scale;
        const newY = dragStart.current.nodeY + deltaY / canvasState.scale;
        moveNode(draggingNodeId, newX, newY);
      }
    }
  }, [canvasRef, canvasState.pan.x, canvasState.pan.y, canvasState.scale, draggingNodeId, isDragging, moveNode, arrowDrawMode, arrowFromNodeId, arrowDrawMouse]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (draggingNodeId) {
      if (!isDragging) {
        // If we didn't drag, the node was just clicked (select it now)
        addLog(`Node ${draggingNodeId} selected (no drag, mouse up)`, 'info');
        selectNode(draggingNodeId);
      } else {
        // Node was dragged, finalize the move
        addLog(`Node ${draggingNodeId} moved`, 'info');
      }
      setDraggingNodeId(null);
      setIsDragging(false);
      dragStart.current = null;
    }
  }, [draggingNodeId, isDragging, selectNode]);

  // Track if an arc was just clicked to prevent immediate deselection
  const arcJustClicked = useRef(false);

  const handleArcMouseDown = useCallback((e: React.MouseEvent, arcId: string) => {
    console.log('Arc mouse down:', arcId);
    addLog(`Arc mouse down: ${arcId}`, 'info');
    console.log('About to call selectArc with:', arcId);
    console.log('selectArc function:', selectArc);
    selectArc(arcId);
    console.log('After calling selectArc');
    selectNode(undefined);
    e.stopPropagation();
    
    // Add a delay to check if selection is cleared
    setTimeout(() => {
      const currentSelection = useCLDStore.getState().selection;
      console.log('Selection after 100ms:', currentSelection);
      if (currentSelection.arcId !== arcId) {
        console.log('WARNING: Selection was cleared!');
        console.trace('Stack trace for selection clearing');
      }
    }, 100);
  }, [selectArc, selectNode]);

  const handleControlPointMouseDown = useCallback((e: React.MouseEvent, arcId: string) => {
    e.stopPropagation();
    const arc = arcs.find(a => a.id === arcId);
    if (!arc) return;
    const fromNode = nodes.find(n => n.id === arc.from);
    const toNode = nodes.find(n => n.id === arc.to);
    if (!fromNode || !toNode) return;
    // Calculate control point position
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const controlPoint = { x: mx + nx * arc.curvature, y: my + ny * arc.curvature };
    // Get mouse position in SVG coordinates
    const svg = document.querySelector('svg');
    let mouseX = e.clientX, mouseY = e.clientY;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      mouseX = (e.clientX - rect.left);
      mouseY = (e.clientY - rect.top);
    }
    // Store offset between mouse and control point
    const offsetX = mouseX - controlPoint.x;
    const offsetY = mouseY - controlPoint.y;
    arcDragData.current = {
      arcId,
      startCurvature: arc.curvature,
      startX: e.clientX,
      startY: e.clientY,
      fromNode,
      toNode,
      offsetX,
      offsetY,
      curvature: arc.curvature,
    };
    setArcDrag({ arcId, curvature: arc.curvature });
    window.addEventListener('mousemove', handleArcDragMouseMove);
    window.addEventListener('mouseup', handleArcDragMouseUp);
  }, [arcs, nodes]);

  const handleArcDragMouseMove = useCallback((e: MouseEvent) => {
    if (!arcDragData.current) return;
    const { arcId, fromNode, toNode, offsetX = 0, offsetY = 0 } = arcDragData.current;
    // Calculate midpoint and normal
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const nx = -dy / len;
    const ny = dx / len;
    // Project mouse position (minus offset) onto normal at midpoint
    const svg = document.querySelector('svg');
    let mouseX = e.clientX, mouseY = e.clientY;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      mouseX = (e.clientX - rect.left);
      mouseY = (e.clientY - rect.top);
    }
    const adjMouseX = mouseX - offsetX;
    const adjMouseY = mouseY - offsetY;
    // Convert midpoint to screen coordinates
    let midScreenX = mx, midScreenY = my;
    if (svg) {
      const rect = svg.getBoundingClientRect();
      const g = svg.querySelector('g');
      let panX = 0, panY = 0, scale = 1;
      if (g && g.hasAttribute('transform')) {
        const match = g.getAttribute('transform')?.match(/translate\(([-\d.]+),\s*([-\d.]+)\) scale\(([-\d.]+)\)/);
        if (match) {
          panX = parseFloat(match[1]);
          panY = parseFloat(match[2]);
          scale = parseFloat(match[3]);
        }
      }
      midScreenX = panX + mx * scale;
      midScreenY = panY + my * scale;
    }
    // Vector from midpoint to adjusted mouse in screen space
    const vx = adjMouseX - midScreenX;
    const vy = adjMouseY - midScreenY;
    // Project onto normal (in screen space, but scale is uniform)
    const dot = vx * nx + vy * ny;
    // Use dot/scaling as curvature (convert to diagram units)
    let newCurvature = dot / (svg ? (svg.width.baseVal.value / svg.clientWidth) : 1);
    // Clamp curvature to less than half the distance between nodes
    const maxCurvature = 0.49 * len;
    newCurvature = Math.max(-maxCurvature, Math.min(maxCurvature, newCurvature));
    setArcDrag({ arcId, curvature: newCurvature });
    arcDragData.current.curvature = newCurvature; // Save latest curvature in ref
  }, []);

  const handleArcDragMouseUp = useCallback((e: MouseEvent) => {
    if (!arcDragData.current) return;
    const { arcId, curvature } = arcDragData.current;
    // Use the latest curvature from the ref
    useCLDStore.setState(state => ({
      arcs: state.arcs.map(a => a.id === arcId ? { ...a, curvature } : a),
      history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
      future: [],
    }));
    setArcDrag(null);
    arcDragData.current = null;
    window.removeEventListener('mousemove', handleArcDragMouseMove);
    window.removeEventListener('mouseup', handleArcDragMouseUp);
  }, []);

  // Double click handler for adding nodes
  const handleDoubleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasState.pan.x) / canvasState.scale;
    const y = (e.clientY - rect.top - canvasState.pan.y) / canvasState.scale;
    
    addNode(x, y);
  }, [canvasRef, canvasState.pan.x, canvasState.pan.y, canvasState.scale, addNode]);

  // Keyboard and mouse event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keys if we're editing text
      if (e.target && (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }
      
      console.log('Key down:', e.key, 'Ctrl key:', e.ctrlKey);
      if (e.ctrlKey) {
        setCtrlPressed(true);
        console.log('Ctrl pressed, setting ctrlPressed to true');
        // If a node is selected and no arc is selected and not already in arrow draw mode, activate arrow draw mode
        if (selection.nodeId && !selection.arcId && !pendingArcStart.current) {
          pendingArcStart.current = selection.nodeId;
          setArcError(null);
          console.log('Auto-starting arc from selected node:', selection.nodeId);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      console.log('Global mousedown:', e.button, e.target);
      if (e.button === 2) { // Right mouse button
        setArrowDrawMode(true);
        setArrowFromNodeId(null);
        console.log('ENTER arrow draw mode (right mouse down)');
        addLog('ENTER arrow draw mode (right mouse down)', 'info');
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) { // Right mouse button
        setArrowDrawMode(false);
        setArrowFromNodeId(null);
        setArrowDrawMouse(null); // Clear arrow draw mouse position
        console.log('EXIT arrow draw mode (right mouse up)');
        addLog('EXIT arrow draw mode (right mouse up)', 'info');
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // Don't handle keys if we're editing text
      if (e.target && (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }
      
      console.log('Key up:', e.key, 'Ctrl key:', e.ctrlKey);
      if (!e.ctrlKey) {
        setCtrlPressed(false);
        console.log('Ctrl released, setting ctrlPressed to false');
        // If pendingArcStart was set due to Ctrl+node selection, clear it
        if (pendingArcStart.current && selection.nodeId && pendingArcStart.current === selection.nodeId) {
          pendingArcStart.current = null;
          setArcError(null);
          console.log('Clearing pendingArcStart due to Ctrl release');
        }
      }
    };

    const handleDelete = (e: KeyboardEvent) => {
      // Don't handle delete if we're editing text
      if (e.target && (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }
      
      if (e.key === 'Delete') {
        if (selection.nodeId) {
          removeNode(selection.nodeId);
        } else if (selection.arcId) {
          removeArc(selection.arcId);
        }
      }
    };

    const preventContextMenu = (e: MouseEvent) => {
      console.log('Global contextmenu event prevented:', e.target);
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleDelete);
    window.addEventListener('contextmenu', preventContextMenu);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleDelete);
      window.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selection.nodeId, selection.arcId, removeNode, removeArc, setArrowDrawMode, setArrowFromNodeId, setArrowDrawMouse]);



  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement | SVGGElement>) => {
    if (e.target === e.currentTarget) {
      addLog('handleCanvasMouseDown called - this should NOT happen when clicking arcs', 'warning');
      selectNode(undefined);
      selectArc(undefined);
      setHighlightedLoopId(null);
      setArcError(null);
      setEditingNodeId(null); // Exit node edit mode
      setArrowDrawMode(false); // Reset arrow draw mode
      setArrowFromNodeId(null); // Reset FROM node
      setArrowDrawMouse(null); // Clear arrow draw mouse position
      addLog('Canvas clicked: Reset to Default State', 'info');
    }
  }, [selectNode, selectArc]);

  // Memoized node and arc rendering to prevent unnecessary re-renders
  const renderedNodes = useMemo(() => {
    return nodes.map(node => (
      <Node
        key={node.id}
        node={node}
        isSelected={selection.nodeId === node.id}
        isHovered={interactionState.hoveredNodeId === node.id}
        isPendingArcStart={false}
        isArcFromNode={arrowDrawMode && arrowFromNodeId === node.id}
        isArrowDrawTo={false}
        scale={canvasState.scale}
        devMode={devMode}
        isArrowDrawMode={arrowDrawMode}
        onMouseDown={handleNodeMouseDown}
        onMouseEnter={(nodeId) => setInteractionState(prev => ({ ...prev, hoveredNodeId: nodeId }))}
        onMouseLeave={() => setInteractionState(prev => ({ ...prev, hoveredNodeId: null }))}
        onDoubleClick={(nodeId) => {/* Handle double click if needed */}}
        onLabelUpdate={updateNodeLabel}
      />
    ));
  }, [nodes, selection.nodeId, interactionState.hoveredNodeId, arrowDrawMode, arrowFromNodeId, canvasState.scale, handleNodeMouseDown, updateNodeLabel]);

  const renderedArcs = useMemo(() => {
    return arcs.map(arc => {
      const fromNode = nodes.find(n => n.id === arc.from);
      const toNode = nodes.find(n => n.id === arc.to);
      if (!fromNode || !toNode) return null;
      const isSelected = selection.arcId === arc.id;
      // Debug: log arc.id and isSelected
      console.log('Arc', arc.id, 'isSelected:', isSelected);

      const isInHighlightedLoop = highlightedLoopId && highlightedLoop ? 
        isArcInLoop(arc, highlightedLoop) : false;

      return (
        <Arc
          key={arc.id}
          arc={arc}
          fromNode={fromNode}
          toNode={toNode}
          isSelected={isSelected}
          isHovered={interactionState.hoveredArcId === arc.id}
          isInHighlightedLoop={isInHighlightedLoop}
          highlightedLoopType={highlightedLoop?.type || '?'}
          scale={canvasState.scale}
          arcDrag={arcDrag}
          isArrowDrawMode={arrowDrawMode}
          onMouseEnter={(arcId) => setInteractionState(prev => ({ ...prev, hoveredArcId: arcId }))}
          onMouseLeave={() => setInteractionState(prev => ({ ...prev, hoveredArcId: null }))}
          onMouseDown={handleArcMouseDown}
          onSignClick={updateArcSign}
          onControlPointMouseDown={handleControlPointMouseDown}
          showConstruction={devMode}
        />
      );
    });
  }, [arcs, nodes, selection.arcId, interactionState.hoveredArcId, highlightedLoopId, 
      highlightedLoop, canvasState.scale, arcDrag, handleArcMouseDown, updateArcSign, handleControlPointMouseDown, devMode]);

  // Memoized arrow markers to prevent recreation on every render
  const arrowMarkers = useMemo(() => {
    return arcs.map(arc => {
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
    });
  }, [arcs]);

  const svgCursor = arrowDrawMode ? 'crosshair' : (canvasState.isPanning ? 'grabbing' : 'default');

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Sidebar */}
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
            cursor: svgCursor,
            display: 'block' 
          }}
          onDoubleClick={handleDoubleClick}
          onMouseMove={e => { handleMouseMove(e); handlePanMouseMove(e); }}
          onMouseUp={e => { handleMouseUp(e); handlePanMouseUp(e); }}
          onMouseDown={e => { 
            addLog(`SVG mouse down: target=${e.target}, currentTarget=${e.currentTarget}`, 'debug');
            if (e.target === e.currentTarget) {
              addLog('Calling handleCanvasMouseDown because target === currentTarget', 'debug');
              handleCanvasMouseDown(e);
            } else {
              addLog('NOT calling handleCanvasMouseDown because target !== currentTarget', 'debug');
            }
            handlePanMouseDown(e); 
          }}
          onWheel={handleWheel}
          onContextMenu={(e) => {
            addLog('SVG context menu prevented', 'debug');
            e.preventDefault();
          }}
        >
          {/* Arrow markers */}
          <defs>
            {arrowMarkers}
          </defs>

          <g 
            transform={`translate(${canvasState.pan.x}, ${canvasState.pan.y}) scale(${canvasState.scale})`}
            // Remove onMouseDown from <g>
          >

            {/* Guideline for arc creation - only show in arrow draw mode */}
            {(() => {
              if (arrowDrawMode && arrowFromNodeId) {
                const from = getNode(arrowFromNodeId);
                if (!from) {
                  return null;
                }
                
                // Use non-debounced mouse position for responsive guideline
                const mousePos = arrowDrawMouse || debouncedArrowDrawMouse;
                if (!mousePos) {
                  return null;
                }
                
                return (
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    stroke="#43a047"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    opacity={0.7}
                    pointerEvents="none"
                  />
                );
              }
              return null;
            })()}

            {/* Render arcs */}
            {renderedArcs}

            {/* Render nodes */}
            {renderedNodes}
          </g>
        </svg>
      </div>

      {/* Status bar */}
      <StatusBar
        numVariables={nodes.length}
        numConnections={arcs.length}
        numLoops={loops.length}
        highlightedLoop={highlightedLoop || null}
        scale={canvasState.scale}
        setScaleCentered={setScaleCentered}
        resetView={resetCanvasView}
        devMode={devMode}
        setDevMode={setDevMode}
      />

      {/* Dev panel - only show in dev mode */}
      {devMode && (
        <DevPanel
          selection={selection}
          interactionState={interactionState}
          arcError={arcError}
          draggingNodeId={draggingNodeId}
          arcDrag={arcDrag}
          editingNodeId={editingNodeId}
          arrowDrawMode={arrowDrawMode}
        />
      )}
    </div>
  );
}); 