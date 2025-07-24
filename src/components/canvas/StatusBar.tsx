import React from 'react';
import { LoopType, CONSTANTS } from '../../types';

interface StatusBarProps {
  numVariables: number;
  numConnections: number;
  numLoops: number;
  highlightedLoop: LoopType | null;
  scale: number;
  setScaleCentered: (scale: number) => void;
  resetView: () => void;
  devMode: boolean;
  setDevMode: (devMode: boolean) => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  numVariables,
  numConnections,
  numLoops,
  highlightedLoop,
  scale,
  setScaleCentered,
  resetView,
  devMode,
  setDevMode,
}) => {
  return (
    <div style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      height: 36,
      background: '#f5f5f7',
      borderTop: '1px solid #ddd',
      color: '#333',
      fontSize: 15,
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      zIndex: 10,
      justifyContent: 'space-between',
      boxSizing: 'border-box',
      minHeight: 36,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <span style={{
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '0 18px', 
          height: 22, 
          borderRadius: 19, 
          fontSize: 14, 
          fontWeight: 500, 
          marginRight: 8, 
          background: '#ffd86b', 
          color: '#222', 
          boxShadow: '0 1px 4px #0001',
        }}>
          <span style={{ fontWeight: 700, marginRight: 6 }}>{numVariables}</span> Variables
        </span>
        <span style={{
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '0 18px', 
          height: 22, 
          borderRadius: 19, 
          fontSize: 14, 
          fontWeight: 500, 
          marginRight: 8, 
          background: '#a6f4a6', 
          color: '#222', 
          boxShadow: '0 1px 4px #0001',
        }}>
          <span style={{ fontWeight: 700, marginRight: 6 }}>{numConnections}</span> Connections
        </span>
        <span style={{
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '0 18px', 
          height: 22, 
          borderRadius: 19, 
          fontSize: 14, 
          fontWeight: 500, 
          marginRight: 8, 
          background: '#7da6ff', 
          color: '#222', 
          boxShadow: '0 1px 4px #0001',
        }}>
          <span style={{ fontWeight: 700, marginRight: 6 }}>{numLoops}</span> Loops
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {highlightedLoop && highlightedLoop.id && highlightedLoop.type ? (
          <span>
            Highlighted: <b>{highlightedLoop?.id}</b> ({highlightedLoop?.type === 'R' ? 'Reinforcing' : highlightedLoop?.type === 'B' ? 'Balancing' : '?'})
          </span>
        ) : (
          <span style={{ color: '#888' }}>No loop highlighted</span>
        )}

        {/* Dev mode toggle icon */}
        <span
          title={devMode ? 'Dev mode ON' : 'Dev mode OFF'}
          onClick={() => setDevMode(!devMode)}
          style={{
            marginLeft: 18,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            userSelect: 'none',
            color: devMode ? '#444' : '#888',
            fontSize: 22,
            transition: 'color 0.2s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#e0e0e0'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill={devMode ? '#444' : 'none'} stroke={devMode ? '#444' : '#888'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
            <circle cx="11" cy="14" r="5" fill={devMode ? '#444' : 'none'} />
            <line x1="11" y1="3" x2="11" y2="8" />
            <line x1="4" y1="14" x2="18" y2="14" />
            <line x1="6" y1="10" x2="3" y2="7" />
            <line x1="16" y1="10" x2="19" y2="7" />
            <line x1="6" y1="18" x2="3" y2="21" />
            <line x1="16" y1="18" x2="19" y2="21" />
          </svg>
        </span>

        {/* Zoom slider */}
        <input
          type="range"
          min={CONSTANTS.MIN_SCALE}
          max={CONSTANTS.MAX_SCALE}
          step={0.01}
          value={scale}
          onChange={e => setScaleCentered(Number(e.target.value))}
          style={{ width: 90, marginLeft: 18 }}
          title="Zoom level"
        />
        <span style={{ minWidth: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1976d2', fontWeight: 600, fontSize: 15 }}>
          {(scale * 100).toFixed(0)}%
        </span>

        {/* Reset zoom button */}
        <span
          onClick={resetView}
          style={{ 
            marginLeft: 8, 
            background: 'none', 
            border: 'none', 
            borderRadius: 5, 
            padding: '2px 6px', 
            fontSize: 20, 
            cursor: 'pointer', 
            color: '#1976d2', 
            fontWeight: 600, 
            display: 'inline-flex', 
            alignItems: 'center' 
          }}
          title="Reset zoom and pan"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#1976d2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <circle cx="11" cy="11" r="3" />
            <line x1="11" y1="2" x2="11" y2="5" />
            <line x1="11" y1="17" x2="11" y2="20" />
            <line x1="2" y1="11" x2="5" y2="11" />
            <line x1="17" y1="11" x2="20" y2="11" />
          </svg>
        </span>
      </span>
    </div>
  );
}; 