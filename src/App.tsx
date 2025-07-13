import React, { useState } from 'react';
import Canvas from './components/Canvas';
import { useCLDStore } from './state/cldStore';

const Analysis: React.FC = () => {
  const arcs = useCLDStore(state => state.arcs);
  const nodes = useCLDStore(state => state.nodes);
  const getNodeLabel = (id: string) => nodes.find(n => n.id === id)?.label || id;
  return (
    <div style={{ padding: 32 }}>
      <h2>Analysis</h2>
      <h3>Arc List</h3>
      <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>From Node</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>To Node</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>Causal Sign</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map(arc => (
            <tr key={arc.id}>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{getNodeLabel(arc.from)}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{getNodeLabel(arc.to)}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px', textAlign: 'center', fontWeight: 'bold', color: arc.sign === '+' ? '#388e3c' : '#d32f2f' }}>{arc.sign}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const App: React.FC = () => {
  const [tab, setTab] = useState<'canvas' | 'analysis'>('canvas');

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
        <button
          onClick={() => setTab('canvas')}
          style={{
            padding: '12px 32px',
            border: 'none',
            borderBottom: tab === 'canvas' ? '3px solid #1976d2' : '3px solid transparent',
            background: 'none',
            fontWeight: 600,
            color: tab === 'canvas' ? '#1976d2' : '#333',
            cursor: 'pointer',
            outline: 'none',
            fontSize: 18,
          }}
        >
          Canvas
        </button>
        <button
          onClick={() => setTab('analysis')}
          style={{
            padding: '12px 32px',
            border: 'none',
            borderBottom: tab === 'analysis' ? '3px solid #1976d2' : '3px solid transparent',
            background: 'none',
            fontWeight: 600,
            color: tab === 'analysis' ? '#1976d2' : '#333',
            cursor: 'pointer',
            outline: 'none',
            fontSize: 18,
          }}
        >
          Analysis
        </button>
      </div>
      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        {tab === 'canvas' ? <Canvas /> : <Analysis />}
      </div>
    </div>
  );
};

export default App;
