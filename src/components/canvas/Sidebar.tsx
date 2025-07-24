import React from 'react';
import { LoopType } from '../../types';

interface SidebarProps {
  problemStatement: string;
  setProblemStatement: (statement: string) => void;
  loops: LoopType[];
  highlightedLoopId: string | null;
  setHighlightedLoopId: (loopId: string | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  problemStatement,
  setProblemStatement,
  loops,
  highlightedLoopId,
  setHighlightedLoopId,
}) => {
  return (
    <div style={{
      width: 320,
      minWidth: 220,
      maxWidth: 400,
      background: '#ebebeb',
      borderRight: '1px solid #e0e0e0',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      minHeight: 0,
      overflow: 'hidden'
    }}>
      {/* Problem Statement Box */}
      <div style={{ marginBottom: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Problem Statement</div>
        <textarea
          value={problemStatement}
          onChange={e => setProblemStatement(e.target.value)}
          style={{ 
            width: '100%', 
            minHeight: 80, 
            maxHeight: 500, 
            fontSize: 15, 
            padding: 8, 
            borderRadius: 6, 
            border: '1px solid #bbb', 
            resize: 'vertical', 
            background: '#fff', 
            color: '#222', 
            boxSizing: 'border-box', 
            overflowY: 'auto' 
          }}
        />
      </div>

      {/* Loops Box */}
      <div style={{ 
        background: '#fff', 
        border: '1px solid #bbb', 
        borderRadius: 8, 
        padding: 16, 
        boxShadow: '0 2px 8px #0001', 
        fontSize: 15, 
        maxHeight: '40vh', 
        overflowY: 'auto', 
        flexShrink: 1 
      }}>
        <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 10 }}>Loops</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #bbb', textAlign: 'left', padding: '4px 8px' }}>ID</th>
              <th style={{ borderBottom: '1px solid #bbb', textAlign: 'center', padding: '4px 8px' }}>Length</th>
              <th style={{ borderBottom: '1px solid #bbb', textAlign: 'center', padding: '4px 8px' }}>Type</th>
            </tr>
          </thead>
          <tbody>
            {loops.map(loop => (
              <tr
                key={loop.id}
                style={{ 
                  background: highlightedLoopId === loop.id ? '#e3eaf5' : 'none', 
                  cursor: 'pointer' 
                }}
                onClick={() => setHighlightedLoopId(highlightedLoopId === loop.id ? null : loop.id)}
              >
                <td style={{ padding: '4px 8px', fontWeight: 600, userSelect: 'none' }}>{loop.id}</td>
                <td style={{ padding: '4px 8px', textAlign: 'center', userSelect: 'none' }}>{loop.length}</td>
                <td style={{ 
                  padding: '4px 8px', 
                  textAlign: 'center', 
                  color: loop.type === 'R' ? '#d32f2f' : loop.type === 'B' ? '#388e3c' : '#888', 
                  fontWeight: 'bold', 
                  userSelect: 'none' 
                }}>
                  {loop.type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loops.length === 0 && <div style={{ color: '#888', marginTop: 8 }}>No loops found.</div>}
      </div>
    </div>
  );
}; 