import { useState, useRef, useCallback, useEffect } from 'react';
import { Point, CanvasState, InteractionState, CONSTANTS } from '../types';

export function useCanvasInteraction() {
  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>({
    pan: { x: 0, y: 0 },
    scale: 1,
    isPanning: false,
  });

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

  // Pan handlers
  const handlePanMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 1) { // Middle mouse
      setCanvasState(prev => ({ ...prev, isPanning: true }));
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: canvasState.pan.x,
        panY: canvasState.pan.y,
      };
      e.preventDefault();
    }
  }, [canvasState.pan]);

  const handlePanMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (canvasState.isPanning && panStart.current) {
      const dx = (e.clientX - panStart.current.x) / canvasState.scale;
      const dy = (e.clientY - panStart.current.y) / canvasState.scale;
      setCanvasState(prev => ({
        ...prev,
        pan: { x: panStart.current!.panX + dx, y: panStart.current!.panY + dy }
      }));
    }
  }, [canvasState.isPanning, canvasState.scale]);

  const handlePanMouseUp = useCallback((e: React.MouseEvent) => {
    if (canvasState.isPanning) {
      setCanvasState(prev => ({ ...prev, isPanning: false }));
      panStart.current = null;
    }
  }, [canvasState.isPanning]);

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
    let newScale = canvasState.scale * (e.deltaY < 0 ? 1.1 : 0.9);
    newScale = Math.max(CONSTANTS.MIN_SCALE, Math.min(CONSTANTS.MAX_SCALE, newScale));
    
    // Adjust pan so zoom is centered on mouse
    const dx = cursorpt.x - canvasState.pan.x;
    const dy = cursorpt.y - canvasState.pan.y;
    const newPan = {
      x: cursorpt.x - dx * (newScale / canvasState.scale),
      y: cursorpt.y - dy * (newScale / canvasState.scale),
    };
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      pan: newPan,
    }));
  }, [canvasState.scale, canvasState.pan]);

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
    const dx = center.x - canvasState.pan.x;
    const dy = center.y - canvasState.pan.y;
    const newPan = {
      x: center.x - dx * (newScale / canvasState.scale),
      y: center.y - dy * (newScale / canvasState.scale),
    };
    
    setCanvasState(prev => ({
      ...prev,
      scale: newScale,
      pan: newPan,
    }));
  }, [canvasState.scale, canvasState.pan]);

  const resetView = useCallback(() => {
    setCanvasState({
      pan: { x: 0, y: 0 },
      scale: 1,
      isPanning: false,
    });
  }, []);

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
      x: (canvasPt.x - canvasState.pan.x) / canvasState.scale,
      y: (canvasPt.y - canvasState.pan.y) / canvasState.scale,
    };
  }, [canvasState.pan, canvasState.scale]);

  const canvasToScreen = useCallback((canvasX: number, canvasY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const pt = canvasRef.current.createSVGPoint();
    pt.x = canvasX * canvasState.scale + canvasState.pan.x;
    pt.y = canvasY * canvasState.scale + canvasState.pan.y;
    const screenPt = pt.matrixTransform(canvasRef.current.getScreenCTM() || undefined);
    
    return { x: screenPt.x, y: screenPt.y };
  }, [canvasState.pan, canvasState.scale]);

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