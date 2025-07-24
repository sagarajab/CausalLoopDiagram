import React from 'react';
import { SelectionType, InteractionState } from '../../types';

interface DevPanelProps {
  selection: SelectionType;
  interactionState: InteractionState;
  arcError: string | null;
  draggingNodeId: string | null;
  arcDrag: { arcId: string, curvature: number } | null;
}

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

function getCurrentDevState(props: DevPanelProps): string {
  const { selection, interactionState, arcError, draggingNodeId, arcDrag } = props;
  
  if (draggingNodeId) return 'node_drag';
  if (arcDrag && arcDrag.arcId) return 'arc_curvature';
  if (interactionState.rightMousePressed) return 'arc_add'; // Show "Arrow addition" whenever right mouse is pressed
  if (selection.arcId) return 'arc_select';
  if (selection.nodeId) return 'node_select';
  if (arcError) return 'arc_add';
  return 'default';
}

export const DevPanel: React.FC<DevPanelProps> = (props) => {
  const current = getCurrentDevState(props);

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 48, 
      right: 8, 
      background: '#fff', 
      color: '#222', 
      padding: 16, 
      borderRadius: 10, 
      fontSize: 14, 
      zIndex: 1000, 
      opacity: 0.97, 
      border: '1px solid #bbb', 
      minWidth: 260, 
      boxShadow: '0 2px 8px #0001', 
      maxWidth: 340 
    }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Dev Info</div>
      
      {/* App State List */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>App State</div>
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
            }}>
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Message Console */}
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Message Console</div>
      <div style={{ fontSize: 13, color: '#333' }}>
        <div>Selected node: <b>{props.selection.nodeId ?? 'none'}</b></div>
        <div>Selected arc: <b>{props.selection.arcId ?? 'none'}</b></div>
        <div>Hovered node: <b>{props.interactionState.hoveredNodeId ?? 'none'}</b></div>
        <div>Hovered arc: <b>{props.interactionState.hoveredArcId ?? 'none'}</b></div>
        <div>Pending arc start: <b>{props.interactionState.pendingArcStart ?? 'none'}</b></div>
        <div>Right mouse pressed: <b>{props.interactionState.rightMousePressed ? 'yes' : 'no'}</b></div>
        {props.arcError && <div style={{ color: '#ff5252', marginTop: 8 }}>Arc error: {props.arcError}</div>}
      </div>
    </div>
  );
}; 