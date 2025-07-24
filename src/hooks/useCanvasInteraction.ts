import { useState, useRef, useCallback, useEffect } from 'react';
import { Point, CanvasState, InteractionState, CONSTANTS } from '../types';

export function useCanvasInteraction(
  externalPan?: { x: number; y: number },
  externalScale?: number,
  setExternalPan?: (pan: { x: number; y: number }) => void,
  setExternalScale?: (scale: number) => void
) {
  // Canvas state - use external state if provided, otherwise use local state
  const [localCanvasState, setLocalCanvasState] = useState<CanvasState>({
    pan: { x: 0, y: 0 },
    scale: 1,
    isPanning: false,
  });
  
  const canvasState = externalPan && externalScale ? {
    pan: externalPan,
    scale: externalScale,
    isPanning: localCanvasState.isPanning,
  } : localCanvasState;
  
  const setCanvasState = externalPan && externalScale ? 
    (updater: CanvasState | ((prev: CanvasState) => CanvasState)) => {
      const newState = typeof updater === 'function' ? updater(canvasState) : updater;
      if (setExternalPan) setExternalPan(newState.pan);
      if (setExternalScale) setExternalScale(newState.scale);
      setLocalCanvasState(prev => ({ ...prev, isPanning: newState.isPanning }));
    } : setLocalCanvasState;

  // Interaction state
  const [interactionState, setInteractionState] = useState<InteractionState>({
    hoveredNodeId: null,
    hoveredArcId: null,
    rightMousePressed: false,
    pendingArcStart: null,
  });

  // Refs
  const canvasRef = useRef<SVGSVGElement>(null);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  
  // Store current state in refs to avoid stale closures
  const currentStateRef = useRef(canvasState);
  currentStateRef.current = canvasState;

  // Pan handlers
  const handlePanMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1) { // Middle mouse
      setCanvasState(prev => ({ ...prev, isPanning: true }));
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: currentStateRef.current.pan.x,
        panY: currentStateRef.current.pan.y,
      };
      e.preventDefault();
    }
  }, [setCanvasState]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (currentStateRef.current.isPanning && panStart.current) {
      const dx = (e.clientX - panStart.current.x) / currentStateRef.current.scale;
      const dy = (e.clientY - panStart.current.y) / currentStateRef.current.scale;
      setCanvasState(prev => ({
        ...prev,
        pan: { x: panStart.current!.panX + dx, y: panStart.current!.panY + dy }
      }));
    }
  }, [setCanvasState]);

  const handlePanMouseUp = useCallback((e: React.MouseEvent) => {
    if (currentStateRef.current.isPanning) {
      setCanvasState(prev => ({ ...prev, isPanning: false }));
      panStart.current = null;
    }
  }, [setCanvasState]);

  // Zoom handler
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    if (e.ctrlKey) return; // Let browser handle ctrl+scroll
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    const pt = canvasRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const cursorpt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    
    // Compute new scale
    let newScale = currentStateRef.current.scale * (e.deltaY < 0 ? 1.1 : 0.9);
    newScale = Math.max(CONSTANTS.MIN_SCALE, Math.min(CONSTANTS.MAX_SCALE, newScale));
    
    // Adjust pan so zoom is centered on mouse
    const dx = cursorpt.x - currentStateRef.current.pan.x;
    const dy = cursorpt.y - currentStateRef.current.pan.y;
    const newPan = {
      x: cursorpt.x - dx * (newScale / currentStateRef.current.scale),
      y: cursorpt.y - dy * (newScale / currentStateRef.current.scale),
    };
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      pan: newPan,
    }));
  }, [setCanvasState]);

  // Zoom controls
  const setScaleCentered = useCallback((newScale: number) => {
    if (!canvasRef.current) {
      setCanvasState(prev => ({ ...prev, scale: newScale }));
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
    const dx = center.x - currentStateRef.current.pan.x;
    const dy = center.y - currentStateRef.current.pan.y;
    const newPan = {
      x: center.x - dx * (newScale / currentStateRef.current.scale),
      y: center.y - dy * (newScale / currentStateRef.current.scale),
    };
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      pan: newPan,
    }));
  }, [setCanvasState]);

  const resetView = useCallback(() => {
    setCanvasState({
      pan: { x: 0, y: 0 },
      scale: 1,
      isPanning: false,
    });
  }, [setCanvasState]);

  // Context menu prevention
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu
    };

    window.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Utility functions
  const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const pt = canvasRef.current.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const canvasPt = pt.matrixTransform(canvasRef.current.getScreenCTM()?.inverse());
    
    return {
      x: (canvasPt.x - currentStateRef.current.pan.x) / currentStateRef.current.scale,
      y: (canvasPt.y - currentStateRef.current.pan.y) / currentStateRef.current.scale,
    };
  }, []);

  const canvasToScreen = useCallback((canvasX: number, canvasY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const pt = canvasRef.current.createSVGPoint();
    pt.x = canvasX * currentStateRef.current.scale + currentStateRef.current.pan.x;
    pt.y = canvasY * currentStateRef.current.scale + currentStateRef.current.pan.y;
    const screenPt = pt.matrixTransform(canvasRef.current.getScreenCTM() || undefined);
    
    return { x: screenPt.x, y: screenPt.y };
  }, []);

  return {
    // State
    canvasState,
    interactionState,
    canvasRef,
    
    // Setters
    setCanvasState,
    setInteractionState,
    
    // Event handlers
    handlePanMouseDown,
    handlePanMouseMove,
    handlePanMouseUp,
    handleWheel,
    
    // Zoom controls
    setScaleCentered,
    resetView,
    
    // Utility functions
    screenToCanvas,
    canvasToScreen,
  };
} 