import React, { useMemo } from 'react';
import { ArcType, NodeType, CONSTANTS } from '../../types';
import { getRefCircleParams, getArcEndpoints, describeArcPolyline, estimateLabelSize, findArcEllipseIntersection } from '../../utils/geometry';

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
  showConstruction?: boolean; // NEW
}

export const Arc: React.FC<ArcProps> = React.memo(({
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
  showConstruction,
}) => {
  // Debug: log arc.id and isSelected on every render
  console.log('Arc.tsx render arc', arc.id, 'isSelected:', isSelected);
  // Memoized arc geometry calculations
  const arcGeometry = useMemo(() => {
    // Use local curvature if dragging this arc's control point
    const curvature = arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature;
    const refCircle = getRefCircleParams(fromNode, toNode, curvature);
    
    if (!refCircle) return null;
    
    // Use the same ellipse calculation as Node component for intersection points
    const fontSize = 16;
    const maxLabelWidth = 150;
    const padding = 16;
    
    const fromLabelSize = estimateLabelSize(fromNode.label, fontSize, maxLabelWidth);
    const toLabelSize = estimateLabelSize(toNode.label, fontSize, maxLabelWidth);
    
    const fromRx = fromLabelSize.width / 2 + padding;
    const fromRy = fromLabelSize.height / 2 + padding;
    const toRx = toLabelSize.width / 2 + padding;
    const toRy = toLabelSize.height / 2 + padding;
    
    // Calculate intersection points using the same ellipse dimensions as Node component
    const startAngle = Math.atan2(fromNode.y - refCircle.cy, fromNode.x - refCircle.cx);
    const endAngle = Math.atan2(toNode.y - refCircle.cy, toNode.x - refCircle.cx);
    
    const start = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
      fromNode.x, fromNode.y, fromRx, fromRy, arc.curvatureSign > 0
    );
    
    const end = findArcEllipseIntersection(
      refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
      toNode.x, toNode.y, toRx, toRy, arc.curvatureSign > 0
    );
    
    if (!start || !end) return null;
    
    // Compute angles for start and end relative to refCircle center using intersection points
    const startAngleFromIntersection = Math.atan2(start.y - refCircle.cy, start.x - refCircle.cx);
    const endAngleFromIntersection = Math.atan2(end.y - refCircle.cy, end.x - refCircle.cx);
    
    // Set sweepFlag based only on arc.curvatureSign
    const sweepFlag = arc.curvatureSign > 0 ? 1 : 0;
    const arcPolyline = describeArcPolyline(refCircle.cx, refCircle.cy, refCircle.r, startAngleFromIntersection, endAngleFromIntersection, sweepFlag);
    
    // Arc midpoint for ID label
    let delta = endAngleFromIntersection - startAngleFromIntersection;
    if (sweepFlag === 1 && delta < 0) delta += Math.PI * 2;
    if (sweepFlag === 0 && delta > 0) delta -= Math.PI * 2;
    if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
    
    const midArcAngle = startAngleFromIntersection + 0.5 * delta;
    const midArcX = refCircle.cx + refCircle.r * Math.cos(midArcAngle);
    const midArcY = refCircle.cy + refCircle.r * Math.sin(midArcAngle);
    
    // Dynamic SIGN_T calculation
    const SIGN_DIST = CONSTANTS.SIGN_DIST;
    const arcLength = refCircle.r * Math.abs(delta);
    let SIGN_T = 1 - (SIGN_DIST / arcLength);
    SIGN_T = Math.max(0, Math.min(1, SIGN_T)); // Clamp to [0, 1]
    
    return {
      refCircle,
      arcPolyline,
      startAngle: startAngleFromIntersection,
      endAngle: endAngleFromIntersection,
      delta,
      midArcX,
      midArcY,
      SIGN_T,
      start,
      end,
    };
  }, [arc, fromNode, toNode, arcDrag]);

  // Memoized arc styling (must be before early return)
  const arcStyle = useMemo(() => {
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
    
    return {
      arcStroke,
      arcStrokeWidth,
      shadowFilter,
    };
  }, [arc.color, isInHighlightedLoop, isSelected, isHovered]);

  // Memoized marker ID (must be before early return)
  const markerId = useMemo(() => {
    return `arrow-${arc.id}-${arc.color.replace('#','')}`;
  }, [arc.id, arc.color]);

  // Memoized sign position (must be before early return)
  const signPosition = useMemo(() => {
    if (!arcGeometry) return { x: 0, y: 0 }; // Safe fallback
    
    const SIGN_PERP = 10;
    const signAngle = arcGeometry.startAngle + arcGeometry.SIGN_T * arcGeometry.delta;
    const arcX = arcGeometry.refCircle.cx + arcGeometry.refCircle.r * Math.cos(signAngle);
    const arcY = arcGeometry.refCircle.cy + arcGeometry.refCircle.r * Math.sin(signAngle);
    const tangentX = -Math.sin(signAngle);
    const tangentY = Math.cos(signAngle);
    const perpX = -tangentY;
    const perpY = tangentX;
    
    return {
      x: arcX + perpX * SIGN_PERP,
      y: arcY + perpY * SIGN_PERP,
    };
  }, [arcGeometry]);

  // Early return if geometry calculation failed
  if (!arcGeometry) return null;

  const { arcPolyline, midArcX, midArcY, refCircle, startAngle, endAngle } = arcGeometry;
  const { arcStroke, arcStrokeWidth, shadowFilter } = arcStyle;

  // Calculate control point for construction overlay
  let controlPoint = null;
  if (refCircle) {
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const curvature = arcDrag && arcDrag.arcId === arc.id ? arcDrag.curvature : arc.curvature;
    controlPoint = { x: mx + nx * curvature, y: my + ny * curvature };
  }

  return (
    <g
      key={arc.id}
      onMouseEnter={() => onMouseEnter(arc.id)}
      onMouseLeave={onMouseLeave}
    >
      {/* Construction objects for dev mode */}
      {showConstruction && refCircle && (
        <>
          {/* Reference circle */}
          <circle
            cx={refCircle.cx}
            cy={refCircle.cy}
            r={refCircle.r}
            fill="none"
            stroke="#00bcd4"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
            pointerEvents="none"
          />
          
          {/* Control point */}
          {controlPoint && (
            <circle
              cx={controlPoint.x}
              cy={controlPoint.y}
              r={6 / scale}
              fill="#ff9800"
              stroke="#fff"
              strokeWidth={2 / scale}
              opacity={0.8}
              pointerEvents="none"
            />
          )}
          
          {/* Control point to reference circle center line */}
          {controlPoint && (
            <line
              x1={controlPoint.x}
              y1={controlPoint.y}
              x2={refCircle.cx}
              y2={refCircle.cy}
              stroke="#ff9800"
              strokeWidth={1 / scale}
              strokeDasharray="2 2"
              opacity={0.6}
              pointerEvents="none"
            />
          )}
          
          {/* Node center points (for reference) */}
          <circle
            cx={fromNode.x}
            cy={fromNode.y}
            r={2 / scale}
            fill="#666"
            stroke="none"
            opacity={0.5}
            pointerEvents="none"
          />
          <circle
            cx={toNode.x}
            cy={toNode.y}
            r={2 / scale}
            fill="#666"
            stroke="none"
            opacity={0.5}
            pointerEvents="none"
          />
          
          {/* Debug text labels */}
          <text
            x={refCircle.cx + 10}
            y={refCircle.cy - 10}
            fontSize={10 / scale}
            fill="#00bcd4"
            opacity={0.8}
            pointerEvents="none"
          >
            R: {Math.round(refCircle.r)}
          </text>
          
          {controlPoint && (
            <text
              x={controlPoint.x + 10}
              y={controlPoint.y - 10}
              fontSize={10 / scale}
              fill="#ff9800"
              opacity={0.8}
              pointerEvents="none"
            >
              C: {Math.round(arc.curvature)}
            </text>
          )}
          
          {/* Arc endpoints (node centers) */}
          <circle
            cx={fromNode.x}
            cy={fromNode.y}
            r={4 / scale}
            fill="#4caf50"
            stroke="#fff"
            strokeWidth={1 / scale}
            opacity={0.8}
            pointerEvents="none"
          />
          <circle
            cx={toNode.x}
            cy={toNode.y}
            r={4 / scale}
            fill="#f44336"
            stroke="#fff"
            strokeWidth={1 / scale}
            opacity={0.8}
            pointerEvents="none"
          />
          
          {/* Actual intersection points (where arc meets ellipse) */}
          {arcGeometry.start && arcGeometry.end && (
            <>
              {/* Start intersection point */}
              <circle
                cx={arcGeometry.start.x}
                cy={arcGeometry.start.y}
                r={5 / scale}
                fill="#4caf50"
                stroke="#fff"
                strokeWidth={2 / scale}
                opacity={1}
                pointerEvents="none"
              />
              
              {/* End intersection point */}
              <circle
                cx={arcGeometry.end.x}
                cy={arcGeometry.end.y}
                r={5 / scale}
                fill="#f44336"
                stroke="#fff"
                strokeWidth={2 / scale}
                opacity={1}
                pointerEvents="none"
              />
              
              {/* Lines from reference circle center to intersection points */}
              <line
                x1={refCircle.cx}
                y1={refCircle.cy}
                x2={arcGeometry.start.x}
                y2={arcGeometry.start.y}
                stroke="#4caf50"
                strokeWidth={1 / scale}
                strokeDasharray="3 2"
                opacity={0.7}
                pointerEvents="none"
              />
              <line
                x1={refCircle.cx}
                y1={refCircle.cy}
                x2={arcGeometry.end.x}
                y2={arcGeometry.end.y}
                stroke="#f44336"
                strokeWidth={1 / scale}
                strokeDasharray="3 2"
                opacity={0.7}
                pointerEvents="none"
              />
            </>
          )}
        </>
      )}
      {/* Invisible thick path for easy interaction */}
      <path
        d={arcPolyline}
        stroke="black"
        strokeWidth={24}
        strokeOpacity={0}
        fill="none"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, arc.id); }}
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
      <circle
        cx={signPosition.x}
        cy={signPosition.y}
        r={16 / scale}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={e => { onSignClick(arc.id); e.stopPropagation(); }}
      />
      
      {/* Arc sign text */}
      <text
        x={signPosition.x}
        y={signPosition.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={14 / scale}
        fontWeight="bold"
        fill={arc.sign === '+' ? '#388e3c' : '#d32f2f'}
        style={{ 
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {arc.sign}
      </text>
      
      {/* Control point for arc curvature adjustment */}
      {isSelected && (
        <circle
          cx={midArcX}
          cy={midArcY}
          r={6 / scale}
          fill="#1976d2"
          stroke="#fff"
          strokeWidth={2 / scale}
          style={{ cursor: 'pointer' }}
          onMouseDown={e => onControlPointMouseDown(e, arc.id)}
        />
      )}
    </g>
  );
}); 