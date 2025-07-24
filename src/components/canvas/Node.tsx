import React, { useState, useRef, useEffect, useMemo } from 'react';
import { NodeType } from '../../types';
import { addLog } from './DevPanel';
import { estimateLabelSize, wrapTextToWidth } from '../../utils/geometry';
import { useCLDStore } from '../../state/cldStore';

interface NodeProps {
  node: NodeType;
  isSelected: boolean;
  isHovered: boolean;
  isPendingArcStart: boolean;
  isArcFromNode: boolean;
  isArrowDrawTo: boolean;
  scale: number;
  devMode?: boolean;
  isArrowDrawMode?: boolean;
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
  isArrowDrawMode = false,
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
  const inputRef = useRef<HTMLDivElement>(null);

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
      // Select all text in contentEditable div
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [isEditing]);

  // Get global font settings
  const nodeFontFamily = useCLDStore(state => state.nodeFontFamily);
  const nodeFontSize = useCLDStore(state => state.nodeFontSize);

  // Memoized label size calculation to prevent recalculation
  const labelSize = useMemo(() => {
    const maxLabelWidth = 150;
    return estimateLabelSize(node.label, nodeFontSize, maxLabelWidth);
  }, [node.label, nodeFontSize]);

  // Memoized edit mode label size (same constraints as display)
  const editLabelSize = useMemo(() => {
    const maxLabelWidth = 150; // Same as display mode
    const baseSize = estimateLabelSize(editingLabel, nodeFontSize, maxLabelWidth);
    
    // Add minimal extra height for better text rendering
    return {
      ...baseSize,
      height: baseSize.height + 8, // Add 8px extra height
      width: baseSize.width + 4    // Add 4px extra width
    };
  }, [editingLabel, nodeFontSize]);



  // Memoized padding and dimensions
  const nodeDimensions = useMemo(() => {
    const padding = 16;
    const rx = labelSize.width / 2 + padding;
    const ry = labelSize.height / 2 + padding;
    return { padding, rx, ry };
  }, [labelSize.width, labelSize.height]);

  // Memoized wrapped text lines - handle both word wrapping and explicit line breaks
  const wrappedTextLines = useMemo(() => {
    const maxLabelWidth = 150;
    
    // Split by explicit line breaks first
    const paragraphs = node.label.split('\n');
    const allLines: string[] = [];
    
    for (const paragraph of paragraphs) {
      // Apply word wrapping to each paragraph
      const wrappedParagraph = wrapTextToWidth(paragraph, maxLabelWidth, nodeFontSize);
      allLines.push(...wrappedParagraph);
    }
    
    return allLines;
  }, [node.label, nodeFontSize]);

  // Memoized wrapped text lines for edit mode - handle both word wrapping and explicit line breaks
  const editWrappedTextLines = useMemo(() => {
    const maxLabelWidth = 150;
    
    // Split by explicit line breaks first
    const paragraphs = editingLabel.split('\n');
    const allLines: string[] = [];
    
    for (const paragraph of paragraphs) {
      // Apply word wrapping to each paragraph
      const wrappedParagraph = wrapTextToWidth(paragraph, maxLabelWidth, nodeFontSize);
      allLines.push(...wrappedParagraph);
    }
    
    return allLines;
  }, [editingLabel, nodeFontSize]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    setIsEditing(true);
    setEditingLabel(node.label);
    setCaretPos(node.label.length);
    e.stopPropagation();
    // Focus the input after a short delay to ensure the DOM is updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Select all text in contentEditable div
        const range = document.createRange();
        range.selectNodeContents(inputRef.current);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
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
      // Enter without Shift: save and exit edit mode
      handleLabelSave();
      e.preventDefault();
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: insert new line (let default behavior handle it)
      e.stopPropagation();
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
        // Only prevent context menu if we're editing, otherwise allow it to bubble up for arrow draw mode
        if (isEditing) {
          e.preventDefault();
        }
      }}
      style={{ cursor: isEditing ? 'text' : (isArrowDrawMode ? 'crosshair' : 'pointer') }}
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
          y={node.y - labelSize.height / 2 + nodeFontSize * 1.2 / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={nodeFontSize}
          fill={node.color}
          fontStyle="normal"
          fontWeight={isArcFromNode || isSelected || isHovered ? 'bold' : 'normal'}
          filter="none"
          style={{ ...nodeStyle, fontFamily: nodeFontFamily }}
        >
          {wrappedTextLines.map((line, i) => (
            <tspan key={i} x={node.x} dy={i === 0 ? 0 : nodeFontSize * 1.2}>
              {line}
            </tspan>
          ))}
        </text>
            ) : (
              <>
                {/* Elegant background highlight for edit mode */}
                <ellipse
                  cx={node.x}
                  cy={node.y}
                  rx={editLabelSize.width / 2 + 18}
                  ry={editLabelSize.height / 2 + 18}
                  fill="#f8f9fa"
                  stroke="#dee2e6"
                  strokeWidth={1.5}
                  opacity={0.9}
                  style={{ 
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))',
                    transition: 'all 0.2s ease'
                  }}
                />
                
                <foreignObject
                  x={node.x - editLabelSize.width / 2}
                  y={node.y - editLabelSize.height / 2 - 2}
                  width={editLabelSize.width}
                  height={Math.max(editLabelSize.height + 20, 60)}
                >
                  <div
                    ref={inputRef}
                    className="node-edit-textarea"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => setEditingLabel(e.currentTarget.textContent?.replace(/\n/g, ' ') || '')}
                    onKeyDown={handleKeyDown}
                    onBlur={handleLabelSave}
                    style={{
                      width: '100%',
                      minHeight: '100%',
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontSize: `${nodeFontSize}px`,
                      fontFamily: nodeFontFamily,
                      textAlign: 'center',
                      color: node.color,
                      fontWeight: 'normal',
                      padding: '4px 2px',
                      boxSizing: 'border-box',
                      lineHeight: '1.3',
                      whiteSpace: 'pre',
                      caretColor: node.color,
                      overflow: 'visible',
                      borderRadius: '3px',
                      transition: 'all 0.15s ease',
                      wordBreak: 'break-word'
                    }}
                  >
                    {editWrappedTextLines.join('\n')}
                  </div>
                </foreignObject>
              </>
            )}
      </g>
    </>
  );
}); 