import React, { useState, useRef, useEffect } from 'react';
import { SelectionType, InteractionState } from '../../types';

declare global {
  interface Window {
    devPanelUpdate?: () => void;
  }
}

interface DevPanelProps {
  selection: SelectionType;
  interactionState: InteractionState;
  arcError: string | null;
  draggingNodeId: string | null;
  arcDrag: { arcId: string, curvature: number } | null;
  editingNodeId?: string | null;
  isEditingNode?: boolean;
  arrowDrawMode?: boolean; // NEW
}

interface LogEntry {
  id: number;
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'warning' | 'debug';
}

let logId = 0;
const logs: LogEntry[] = [];

export const addLog = (message: string, type: LogEntry['type'] = 'info') => {
  const log: LogEntry = {
    id: logId++,
    timestamp: Date.now(),
    message,
    type
  };
  logs.push(log);
  if (logs.length > 50) logs.shift();
  if (window.devPanelUpdate) window.devPanelUpdate();
};

// State machine states and descriptions
const STATE_DESCRIPTIONS: Record<string, string> = {
  'default': 'No node or arrow is selected. Ready for user action.',
  'node_select': 'A node is selected. You can drag, edit, or delete it.',
  'node_drag': 'Dragging a node. Release to drop.',
  'node_edit': 'Editing a node label. Press Enter or click away to finish.',
  'arrow_add': 'Drawing a new arrow. Hold right click and release on target node.',
  'arrow_select': 'An arrow is selected. You can drag its control point or delete it.',
  'arrow_drag': 'Dragging an arrow control point. Release to set curvature.',
};

const STATE_LABELS: Record<string, string> = {
  'default': 'Default State',
  'node_select': 'Node Select',
  'node_drag': 'Node Drag',
  'node_edit': 'Node Edit',
  'arrow_add': 'Arrow Add',
  'arrow_select': 'Arrow Select',
  'arrow_drag': 'Arrow Drag',
};

// State machine logic based on the diagram
function getAppState(props: DevPanelProps): { state: string, label: string, description: string } {
  const { selection, interactionState, arcError, draggingNodeId, arcDrag, editingNodeId, arrowDrawMode } = props;
  if (editingNodeId) return { state: 'node_edit', label: STATE_LABELS['node_edit'], description: STATE_DESCRIPTIONS['node_edit'] };
  if (draggingNodeId) return { state: 'node_drag', label: STATE_LABELS['node_drag'], description: STATE_DESCRIPTIONS['node_drag'] };
  if (arcDrag && arcDrag.arcId) return { state: 'arrow_drag', label: STATE_LABELS['arrow_drag'], description: STATE_DESCRIPTIONS['arrow_drag'] };
  if (arrowDrawMode) return { state: 'arrow_add', label: STATE_LABELS['arrow_add'], description: STATE_DESCRIPTIONS['arrow_add'] };
  if (selection.arcId) return { state: 'arrow_select', label: STATE_LABELS['arrow_select'], description: STATE_DESCRIPTIONS['arrow_select'] };
  if (selection.nodeId) return { state: 'node_select', label: STATE_LABELS['node_select'], description: STATE_DESCRIPTIONS['node_select'] };
  return { state: 'default', label: STATE_LABELS['default'], description: STATE_DESCRIPTIONS['default'] };
}

let lastState = 'default';

export const DevPanel: React.FC<DevPanelProps> = (props) => {
  const [, forceUpdate] = useState({});
  const [position, setPosition] = useState({ x: 40, y: 60 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [lastTransition, setLastTransition] = useState<string>('');
  const [minimized, setMinimized] = useState(false);

  // State machine
  const { state, label, description } = getAppState(props);

  // Log state transitions
  useEffect(() => {
    if (state !== lastState) {
      const transitionMsg = `Transition: ${STATE_LABELS[lastState] || lastState} → ${label}`;
      addLog(transitionMsg, 'info');
      setLastTransition(transitionMsg);
      lastState = state;
    }
  }, [state, label]);

  useEffect(() => {
    window.devPanelUpdate = () => forceUpdate({});
    return () => { delete window.devPanelUpdate; };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    }
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (dragStart.current) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      setPosition({ x: newX, y: newY });
    }
  };
  const handleMouseUp = () => {
    dragStart.current = null;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return '#d32f2f';
      case 'warning': return '#ff9800';
      default: return '#222';
    }
  };
  const getLogBg = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return '#fff5f5';
      case 'warning': return '#fff8e1';
      default: return '#f7f7f7';
    }
  };
  const getPillColor = (state: string) => {
    switch (state) {
      case 'default': return '#bdbdbd';
      case 'node_select': return '#1976d2';
      case 'node_drag': return '#0288d1';
      case 'node_edit': return '#388e3c';
      case 'arrow_add': return '#fbc02d';
      case 'arrow_select': return '#7b1fa2';
      case 'arrow_drag': return '#c62828';
      default: return '#bdbdbd';
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        left: position.x,
        top: position.y,
        background: '#fff', 
        color: '#222', 
        padding: minimized ? 6 : 12, 
        borderRadius: 10, 
        fontSize: minimized ? 11 : 13, 
        zIndex: 1000, 
        opacity: 0.98, 
        border: '1.5px solid #bbb', 
        minWidth: minimized ? 120 : 320, 
        maxWidth: 420,
        maxHeight: minimized ? 40 : '60vh',
        cursor: dragStart.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: minimized ? 0 : 8
      }}>
        {/* App State Pill */}
        <span style={{
          background: getPillColor(state),
          color: '#fff',
          fontWeight: 700,
          fontSize: minimized ? 12 : 14,
          borderRadius: 16,
          padding: minimized ? '2px 10px' : '4px 16px',
          marginRight: 8,
          letterSpacing: 0.5,
          minWidth: 0,
          display: 'inline-block',
        }}>{label}</span>
        {/* Minimize Button */}
        <button
          onClick={e => { e.stopPropagation(); setMinimized(m => !m); }}
          style={{
            fontSize: 13,
            padding: minimized ? '0 6px' : '0 10px',
            background: '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: 6,
            cursor: 'pointer',
            minWidth: 0,
            marginLeft: 'auto',
            color: '#444',
            height: minimized ? 22 : 26,
            lineHeight: minimized ? '18px' : '22px',
            fontWeight: 600,
          }}
          title={minimized ? 'Expand' : 'Minimize'}
        >{minimized ? '▸' : '▾'}</button>
      </div>
      {!minimized && (
        <>
          <div style={{ color: '#888', fontWeight: 400, fontSize: 12, marginBottom: 4 }}>{description}</div>
          {lastTransition && <div style={{ color: '#aaa', fontWeight: 400, fontSize: 11, marginBottom: 6 }}>Last transition: {lastTransition}</div>}
          {/* Logs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              fontWeight: 600,
              marginBottom: 4,
              fontSize: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>Recent Logs</span>
              <button
                onClick={() => {
                  logs.length = 0;
                  if (window.devPanelUpdate) window.devPanelUpdate();
                }}
                style={{
                  fontSize: 11,
                  padding: '1px 6px',
                  background: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  cursor: 'pointer',
                  minWidth: 0,
                }}
              >
                Clear
              </button>
            </div>
            <div style={{
              flex: 1,
              fontSize: 11,
              overflowY: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              padding: 6,
              background: '#fafafa',
              minHeight: 80,
              maxHeight: 180,
            }}>
              {logs.slice(-20).reverse().map(log => (
                <div key={log.id} style={{
                  marginBottom: 4,
                  padding: 6,
                  borderLeft: `3px solid ${getLogColor(log.type)}`,
                  background: getLogBg(log.type),
                  color: getLogColor(log.type),
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: log.type === 'error' ? 700 : 500,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}>
                  <span style={{ color: '#bbb', fontSize: 9, marginRight: 6 }}>{formatTime(log.timestamp)}</span>
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div style={{
                  color: '#999',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  padding: '10px',
                  fontSize: 11,
                }}>
                  No logs yet. Try interacting with the canvas.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 