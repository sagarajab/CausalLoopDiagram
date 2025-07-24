import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeType } from '../../types';
import { addLog } from './DevPanel';
import { estimateLabelSize, wrapTextToWidth } from '../../utils/geometry';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  isHovered: boolean;
  isPendingArcStart: boolean;
  isArcFromNode: boolean;
  isArrowDrawTo: boolean;
  scale: number;
  devMode?: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onMouseEnter: (nodeId: string) => void;
  onMouseLeave: () => void;
  onDoubleClick: (nodeId: string) => void;
  onLabelUpdate: (nodeId: string, label: string) => void;
}

export const Node: React.FC<NodeProps> = React.memo(({
  node,
  isSelected,
  isHovered,
  isPendingArcStart,
  isArcFromNode,
  isArrowDrawTo,
  scale,
  devMode = false,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
  onLabelUpdate,
}) => {
  // Log when selection state changes
  useEffect(() => {
    if (isSelected) {
      addLog(`Node ${node.id} is now SELECTED`, 'info');
    }
  }, [isSelected, node.id]);
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

  // Memoized label size calculation to prevent recalculation
  const labelSize = useMemo(() => {
    const displayFontSize = 16;
    const maxLabelWidth = 150;
    return estimateLabelSize(node.label, displayFontSize, maxLabelWidth);
  }, [node.label]);

  // Memoized edit mode label size (same constraints as display)
  const editLabelSize = useMemo(() => {
    const editFontSize = 16;
    const maxLabelWidth = 150; // Same as display mode
    return estimateLabelSize(editingLabel, editFontSize, maxLabelWidth);
  }, [editingLabel]);



  // Memoized padding and dimensions
  const nodeDimensions = useMemo(() => {
    const padding = 16;
    const rx = labelSize.width / 2 + padding;
    const ry = labelSize.height / 2 + padding;
    return { padding, rx, ry };
  }, [labelSize.width, labelSize.height]);

  // Memoized wrapped text lines
  const wrappedTextLines = useMemo(() => {
    const displayFontSize = 16;
    const maxLabelWidth = 150;
    return wrapTextToWidth(node.label, maxLabelWidth, displayFontSize);
  }, [node.label]);

  // Memoized wrapped text lines for edit mode
  const editWrappedTextLines = useMemo(() => {
    const editFontSize = 16;
    const maxLabelWidth = 150;
    return wrapTextToWidth(editingLabel, maxLabelWidth, editFontSize);
  }, [editingLabel]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    setIsEditing(true);
    setEditingLabel(node.label);
    setCaretPos(node.label.length);
    e.stopPropagation();
    // Focus the input after a short delay to ensure the DOM is updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 10);
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
    } else if (e.key === 'Tab') {
      // Allow tab navigation but prevent default behavior
      e.preventDefault();
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      // Let the default behavior handle backspace and delete
      e.stopPropagation();
    }
  };

  // Memoized node styling
  const nodeStyle = useMemo(() => {
    const fontWeight = isArcFromNode || isSelected || isHovered ? 'bold' : 'normal';
    return {
      userSelect: 'none' as const,
      whiteSpace: 'pre' as const,
      transition: 'font-size 0.15s, filter 0.15s',
      pointerEvents: 'none' as const,
    };
  }, [isArcFromNode, isSelected, isHovered]);

  return (
    <>
      <style>
        {`
          .node-edit-textarea::selection {
            background-color: rgba(0, 123, 255, 0.3) !important;
            color: ${node.color} !important;
          }
          .node-edit-textarea::-moz-selection {
            background-color: rgba(0, 123, 255, 0.3) !important;
            color: ${node.color} !important;
          }
        `}
      </style>
      <g
      onMouseDown={e => {
        addLog(`Node ${node.id} <g> onMouseDown fired, button: ${e.button}`, 'debug');
        onMouseDown(e, node.id);
      }}
      onMouseEnter={() => onMouseEnter(node.id)}
      onMouseLeave={onMouseLeave}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => {
        addLog(`Node ${node.id} context menu prevented`, 'debug');
        e.preventDefault();
      }}
      style={{ cursor: isEditing ? 'text' : 'pointer' }}
      pointerEvents="all"
    >
      {/* Transparent blue border for selected node */}
      {isSelected && !isEditing && (
        <ellipse
          cx={node.x}
          cy={node.y}
          rx={labelSize.width / 2 + 20}
          ry={labelSize.height / 2 + 20}
          fill="none"
          stroke="#2196F3"
          strokeWidth={3}
          opacity={0.6}
        />
      )}



      {/* Dark orange border for FROM node (thicker and more visible) */}
      {isArcFromNode && (
        <ellipse
          cx={node.x}
          cy={node.y}
          rx={labelSize.width / 2 + 24}
          ry={labelSize.height / 2 + 24}
          fill="none"
          stroke="#FF9800"
          strokeWidth={5}
          opacity={0.95}
          style={{ filter: 'drop-shadow(0 0 6px #FF9800AA)' }}
        />
      )}

      {/* Dev mode: show ellipse edges */}
      {devMode && (
        <ellipse
          cx={node.x}
          cy={node.y}
          rx={nodeDimensions.rx}
          ry={nodeDimensions.ry}
          fill="none"
          stroke="#bbb"
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}

      {/* Transparent rect for better hover/select interaction */}
      <rect
        x={node.x - labelSize.width / 2 - 8}
        y={node.y - labelSize.height / 2 - 8}
        width={labelSize.width + 16}
        height={labelSize.height + 16}
        fill="transparent"
        pointerEvents="all"
      />

      {/* Node label */}
      {!isEditing ? (
        <text
          x={node.x}
          y={node.y - labelSize.height / 2 + 16 * 1.2 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          fill={node.color}
          fontStyle="normal"
          fontWeight={isArcFromNode || isSelected || isHovered ? 'bold' : 'normal'}
          filter="none"
          style={nodeStyle}
        >
          {wrappedTextLines.map((line, i) => (
            <tspan key={i} x={node.x} dy={i === 0 ? 0 : 16 * 1.2}>
              {line}
            </tspan>
          ))}
        </text>
            ) : (
                  <foreignObject
            x={node.x - editLabelSize.width / 2}
            y={node.y - editLabelSize.height / 2}
            width={editLabelSize.width}
            height={Math.max(editLabelSize.height + 24, 60)}
          >
                        <textarea
              ref={inputRef}
              className="node-edit-textarea"
              value={editingLabel}
              onChange={e => setEditingLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleLabelSave}
              style={{
                width: '100%',
                minHeight: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 16,
                fontFamily: 'inherit',
                textAlign: 'center',
                color: node.color,
                fontWeight: 'normal',
                padding: '6px 0',
                boxSizing: 'border-box',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                caretColor: node.color,
                overflow: 'visible',
                resize: 'none'
              }}
            />
        </foreignObject>
      )}
      </g>
    </>
  );
}); 