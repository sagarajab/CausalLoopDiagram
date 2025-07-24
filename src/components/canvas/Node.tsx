import React, { useState, useRef, useEffect } from 'react';
import { NodeType, CONSTANTS } from '../../types';
import { estimateLabelSize, wrapTextToWidth } from '../../utils/geometry';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  isHovered: boolean;
  isPendingArcStart: boolean;
  isArcFromNode: boolean;
  isArrowDrawTo: boolean;
  scale: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: (nodeId: string) => void;
  onMouseLeave: () => void;
  onDoubleClick: (nodeId: string) => void;
  onLabelUpdate: (nodeId: string, label: string) => void;
}

export const Node: React.FC<NodeProps> = ({
  node,
  isSelected,
  isHovered,
  isPendingArcStart,
  isArcFromNode,
  isArrowDrawTo,
  scale,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onLabelUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingLabel, setEditingLabel] = useState(node.label);
  const [caretPos, setCaretPos] = useState(0);
  const [showCaret, setShowCaret] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Caret blink effect
  useEffect(() => {
    if (isEditing) {
      setShowCaret(true);
      const blink = setInterval(() => setShowCaret(s => !s), 500);
      return () => clearInterval(blink);
    }
  }, [isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const displayFontSize = 16;
  const maxLabelWidth = 150;
  const labelSize = estimateLabelSize(node.label, displayFontSize, maxLabelWidth);
  const padding = 16;
  const rx = labelSize.width / 2 + padding;
  const ry = labelSize.height / 2 + padding;

  const handleDoubleClick = (e: React.MouseEvent) => {
    setIsEditing(true);
    setEditingLabel(node.label);
    setCaretPos(node.label.length);
    e.stopPropagation();
  };

  const handleLabelSave = () => {
    const newLabel = editingLabel.trim() || `var_${node.id}`;
    onLabelUpdate(node.id, newLabel);
    setIsEditing(false);
  };

  const handleLabelCancel = () => {
    setEditingLabel(node.label);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleLabelSave();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      handleLabelCancel();
      e.preventDefault();
    }
  };

  return (
    <g
      onMouseDown={e => onMouseDown(e, node.id)}
      onMouseEnter={() => onMouseEnter(node.id)}
      onMouseLeave={onMouseLeave}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
      pointerEvents="all"
    >
      {/* Dark orange border for FROM node */}
      {isPendingArcStart && (
        <ellipse
          cx={node.x}
          cy={node.y}
          rx={labelSize.width / 2 + 20}
          ry={labelSize.height / 2 + 20}
          fill="none"
          stroke="#FF8C00"
          strokeWidth={3}
          opacity={0.8}
        />
      )}


      {/* Debug ellipse in dev mode */}
      {/* <ellipse
        cx={node.x}
        cy={node.y}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="#bbb"
        strokeWidth={1}
        strokeDasharray="4 3"
      /> */}

      {/* Transparent rect for better hover/select interaction */}
      <rect
        x={node.x - labelSize.width / 2}
        y={node.y - labelSize.height / 2}
        width={labelSize.width}
        height={labelSize.height}
        fill="transparent"
        pointerEvents="all"
      />

      {/* Node label */}
      {isEditing ? (
        <foreignObject
          x={node.x - Math.max(labelSize.width + 32, 120, maxLabelWidth + 32) / 2}
          y={node.y - Math.max(labelSize.height + 24, 40) / 2}
          width={Math.max(labelSize.width + 32, 120, maxLabelWidth + 32)}
          height={Math.max(labelSize.height + 24, 40)}
          style={{ pointerEvents: 'auto' }}
        >
          <div style={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <textarea
              ref={inputRef}
              autoFocus
              value={editingLabel}
              onChange={e => setEditingLabel(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={handleKeyDown}
              wrap="soft"
              style={{
                width: '100%',
                minWidth: 60,
                maxWidth: maxLabelWidth,
                height: '100%',
                minHeight: 24,
                maxHeight: 120,
                fontSize: displayFontSize,
                fontWeight: 'normal',
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
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                filter: 'none',
              }}
            />
          </div>
        </foreignObject>
      ) : (
        <text
          x={node.x}
          y={node.y - labelSize.height / 2 + displayFontSize * 1.2 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          fill={node.color}
          fontStyle="normal"
          fontWeight={isArcFromNode || isSelected || isHovered ? 'bold' : 'normal'}
          filter="none"
          style={{ 
            userSelect: 'none', 
            whiteSpace: 'pre', 
            transition: 'font-size 0.15s, filter 0.15s',
            pointerEvents: 'none'
          }}
        >
          {(() => {
            const lineHeight = displayFontSize * 1.2;
            const lines = wrapTextToWidth(node.label, maxLabelWidth, displayFontSize);
            return lines.map((line, i) => (
              <tspan key={i} x={node.x} dy={i === 0 ? 0 : lineHeight}>
                {line}
              </tspan>
            ));
          })()}
        </text>
      )}
    </g>
  );
}; 