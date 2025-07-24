import React from 'react';
import { ArcType, NodeType, LoopType, CONSTANTS } from '../../types';
import { 
  getRefCircleParams, 
  getArcEndpoints, 
  describeArcPolyline 
} from '../../utils/geometry';

interface ArcProps {
  arc: ArcType;
  fromNode: NodeType;
  toNode: NodeType;
  isSelected: boolean;
  isHovered: boolean;
  isInHighlightedLoop: boolean;
  highlightedLoopType: string;
  scale: number;
  arcDrag: { arcId: string, curvature: number } | null;
  onMouseEnter: (arcId: string) => void;
  onMouseLeave: () => void;
  onMouseDown: (e: React.MouseEvent, arcId: string) => void;
  onSignClick: (arcId: string) => void;
  onControlPointMouseDown: (e: React.MouseEvent, arcId: string) => void;
}

export const Arc: React.FC<ArcProps> = ({
  arc,
  fromNode,
  toNode,
  isSelected,
  isHovered,
  isInHighlightedLoop,
  highlightedLoopType,
  scale,
  arcDrag,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onSignClick,
  onControlPointMouseDown,
}) => {
  // Use local curvature if dragging this arc's control point
  const curvature = arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature;
  const refCircle = getRefCircleParams(fromNode, toNode, curvature);
  
  if (!refCircle) return null;
  
  const endpoints = getArcEndpoints(fromNode, toNode, refCircle, arc);
  if (!endpoints) return null;
  
  const { start, end } = endpoints;
  
  // Compute angles for start and end relative to refCircle center
  const startAngle = Math.atan2((start?.y ?? fromNode.y) - refCircle.cy, (start?.x ?? fromNode.x) - refCircle.cx);
  const endAngle = Math.atan2((end?.y ?? toNode.y) - refCircle.cy, (end?.x ?? toNode.x) - refCircle.cx);
  
  // Set sweepFlag based only on arc.curvatureSign
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
  
  // Dynamic SIGN_T calculation
  const SIGN_DIST = CONSTANTS.SIGN_DIST;
  const arcLength = refCircle.r * Math.abs(delta);
  let SIGN_T = 1 - (SIGN_DIST / arcLength);
  SIGN_T = Math.max(0, Math.min(1, SIGN_T)); // Clamp to [0, 1]
  
  // Arc styling
  let arcStroke = arc.color;
  let arcStrokeWidth = 2;
  let shadowFilter = 'none';
  
  if (isInHighlightedLoop) {
    arcStrokeWidth = 4;
    shadowFilter = 'drop-shadow(0px 0px 16px #ffe066) drop-shadow(0px 0px 8px #ffd600)';
  } else if (isSelected) {
    arcStrokeWidth = 4;
  } else if (isHovered) {
    arcStrokeWidth = 5;
  }
  
  const markerId = `arrow-${arc.id}-${arc.color.replace('#','')}`;
  
  return (
    <g
      key={arc.id}
      onMouseEnter={() => onMouseEnter(arc.id)}
      onMouseLeave={onMouseLeave}
    >
      {/* Invisible thick path for easy interaction */}
      <path
        d={arcPolyline}
        stroke="black"
        strokeWidth={24}
        strokeOpacity={0}
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseDown={e => onMouseDown(e, arc.id)}
      />
      
      {/* Visible arc with shadow if highlighted */}
      <path
        d={arcPolyline}
        stroke={arcStroke}
        strokeWidth={arcStrokeWidth}
        fill="none"
        markerEnd={`url(#${markerId})`}
        style={{ 
          filter: shadowFilter, 
          transition: 'filter 0.2s', 
          cursor: 'pointer', 
          pointerEvents: 'none' 
        }}
      />
      
      {/* Arc sign toggle */}
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
          onClick={e => { onSignClick(arc.id); e.stopPropagation(); }}
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
      
      {/* Draggable control point for curvature */}
      {isSelected && (
        <g
          style={{ cursor: 'pointer' }}
          onMouseDown={e => onControlPointMouseDown(e, arc.id)}
        >
          <circle
            cx={(fromNode.x + toNode.x) / 2 + (- (toNode.y - fromNode.y) / Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2)) * curvature}
            cy={(fromNode.y + toNode.y) / 2 + ((toNode.x - fromNode.x) / Math.sqrt((toNode.x - fromNode.x) ** 2 + (toNode.y - fromNode.y) ** 2)) * curvature}
            r={9 / scale}
            fill="#fff"
            stroke={arc.sign === '+' ? '#388e3c' : '#b71c1c'}
            strokeWidth={2}
            style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke 0.15s' }}
            onDoubleClick={e => { onSignClick(arc.id); e.stopPropagation(); }}
            onMouseDown={e => onControlPointMouseDown(e, arc.id)}
          />
        </g>
      )}
    </g>
  );
}; 