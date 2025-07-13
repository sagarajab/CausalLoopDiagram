import React, { useState } from 'react';
import Canvas from './components/Canvas';
import { useCLDStore } from './state/cldStore';
import { FaUndo, FaRedo, FaSync, FaFileImport, FaFileExport, FaPalette, FaChevronDown, FaLongArrowAltRight } from 'react-icons/fa';
import { MdTextFields } from 'react-icons/md';

const Analysis: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const arcs = useCLDStore(state => state.arcs);
  const nodes = useCLDStore(state => state.nodes);
  const getNodeLabel = (id: string) => nodes.find(n => n.id === id)?.label || id;

  // Compute #input and #output for each node
  const nodeStats = nodes.map(node => {
    const numInput = arcs.filter(arc => arc.to === node.id).length;
    const numOutput = arcs.filter(arc => arc.from === node.id).length;
    return { ...node, numInput, numOutput };
  });

  // Use refreshKey to force re-render if needed
  React.useEffect(() => {}, [refreshKey]);

  return (
    <div style={{ padding: 32 }}>
      <h2>Analysis</h2>
      <h3>Node Summary</h3>
      <table style={{ borderCollapse: 'collapse', minWidth: 400, marginBottom: 32 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>ID</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>Name</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}># Input</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}># Output</th>
          </tr>
        </thead>
        <tbody>
          {nodeStats.map(node => (
            <tr key={node.id}>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{node.id}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{node.label}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px', textAlign: 'center' }}>{node.numInput}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px', textAlign: 'center' }}>{node.numOutput}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Connections</h3>
      <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>ID</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>From Node</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>To Node</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>Sign</th>
          </tr>
        </thead>
        <tbody>
          {arcs.map(arc => (
            <tr key={arc.id}>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{arc.id}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{`${getNodeLabel(arc.from)} (${arc.from})`}</td>
              <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{`${getNodeLabel(arc.to)} (${arc.to})`}</td>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const undo = useCLDStore(state => state.undo);
  const redo = useCLDStore(state => state.redo);
  const selection = useCLDStore(state => state.selection);
  const nodes = useCLDStore(state => state.nodes);
  const arcs = useCLDStore(state => state.arcs);
  const defaultNodeColor = useCLDStore(state => state.defaultNodeColor);
  const defaultArcColor = useCLDStore(state => state.defaultArcColor);
  const setDefaultNodeColor = useCLDStore(state => state.setDefaultNodeColor);
  const setDefaultArcColor = useCLDStore(state => state.setDefaultArcColor);
  const [colorPickerOpen, setColorPickerOpen] = useState<'selected' | 'node' | 'arc' | null>(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [arcMenuOpen, setArcMenuOpen] = useState(false);
  const nodeBtnRef = React.useRef<HTMLDivElement>(null);
  const arcBtnRef = React.useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // Placeholder handlers for load/export
  const handleLoad = () => {
    alert('Load functionality not implemented yet.');
  };
  const handleExport = () => {
    alert('Export functionality not implemented yet.');
  };

  // Get current color for selected node/arc
  const currentColor = (() => {
    if (selection.nodeId) {
      const node = nodes.find(n => n.id === selection.nodeId);
      return node?.color || '#222';
    } else if (selection.arcId) {
      const arc = arcs.find(a => a.id === selection.arcId);
      return arc?.color || '#888';
    }
    return '#222';
  })();

  // Update color in store
  const handleColorChange = (color: string) => {
    if (selection.nodeId) {
      useCLDStore.setState(state => ({
        nodes: state.nodes.map(n => n.id === selection.nodeId ? { ...n, color } : n),
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
      }));
    } else if (selection.arcId) {
      useCLDStore.setState(state => ({
        arcs: state.arcs.map(a => a.id === selection.arcId ? { ...a, color } : a),
        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
        future: [],
      }));
    }
  };

  // Standard color palette (PowerPoint-like)
  const STANDARD_COLORS = [
    '#000000', '#444444', '#888888', '#CCCCCC', '#FFFFFF',
    '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00B0F0', '#0070C0', '#7030A0',
    '#F4B183', '#C6E0B4', '#BDD7EE', '#D9D9D9', '#A9D08E', '#FFD966', '#ED7D31',
  ];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      {/* Menu bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #ddd', background: '#f0f4f8', position: 'relative' }}>
        <button onClick={undo} title="Undo" style={menuBtnStyle}><FaUndo size={22} /></button>
        <button onClick={redo} title="Redo" style={menuBtnStyle}><FaRedo size={22} /></button>
        <button onClick={handleLoad} title="Load" style={menuBtnStyle}><FaFileImport size={22} /></button>
        <button onClick={handleExport} title="Export" style={menuBtnStyle}><FaFileExport size={22} /></button>
        <button onClick={handleRefresh} title="Sync" style={menuBtnStyle}><FaSync size={22} /></button>
        {/* Default node color split button */}
        <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'row', alignItems: 'flex-end', verticalAlign: 'top' }} ref={nodeBtnRef}>
          <button
            title="Apply node color"
            style={{
              ...menuBtnStyle,
              marginRight: 0,
              position: 'relative',
              cursor: selection.nodeId ? 'pointer' : 'not-allowed',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: selection.nodeId ? 1 : 0.5,
              pointerEvents: selection.nodeId ? 'auto' : 'none',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRight: 'none',
              paddingRight: 0,
              background: '#fff',
              width: 36,
              height: 36,
            }}
            disabled={!selection.nodeId}
            onClick={() => {
              if (selection.nodeId) {
                useCLDStore.setState(state => ({
                  nodes: state.nodes.map(n => n.id === selection.nodeId ? { ...n, color: defaultNodeColor } : n),
                  history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                  future: [],
                }));
              }
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <MdTextFields size={22} color="#1976d2" style={{ display: 'block', marginBottom: 0 }} />
              <div style={{
                width: 20,
                height: 4,
                background: defaultNodeColor,
                borderRadius: 2,
                marginTop: 2,
                marginBottom: 0,
                pointerEvents: 'none',
              }} />
            </span>
          </button>
          <button
            title="Pick node color"
            style={{
              ...menuBtnStyle,
              marginLeft: 0,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: '1px solid #bbb',
              padding: '6px 8px',
              opacity: selection.nodeId ? 1 : 0.5,
              pointerEvents: selection.nodeId ? 'auto' : 'none',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              width: 28,
              height: 36,
              justifyContent: 'center',
            }}
            disabled={!selection.nodeId}
            onClick={() => setNodeMenuOpen(open => !open)}
          >
            <FaChevronDown size={14} />
          </button>
          {/* Context menu for node color */}
          {nodeMenuOpen && selection.nodeId && (
            <div
              style={{
                position: 'absolute',
                top: 38,
                left: 0,
                background: '#fff',
                border: '1px solid #bbb',
                borderRadius: 8,
                padding: 10,
                zIndex: 2000,
                boxShadow: '0 2px 8px #0002',
                minWidth: 180,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 6,
              }}
              onMouseLeave={() => setNodeMenuOpen(false)}
            >
              {STANDARD_COLORS.map(color => (
                <button
                  key={color}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: color === defaultNodeColor ? '2px solid #1976d2' : '1px solid #bbb',
                    background: color,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setDefaultNodeColor(color);
                    // Apply to selected node
                    if (selection.nodeId) {
                      useCLDStore.setState(state => ({
                        nodes: state.nodes.map(n => n.id === selection.nodeId ? { ...n, color } : n),
                        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                        future: [],
                      }));
                    }
                    setNodeMenuOpen(false);
                  }}
                  title={color}
                />
              ))}
              {/* More Colors... */}
              <label style={{ gridColumn: 'span 7', marginTop: 6, cursor: 'pointer', textAlign: 'center', fontSize: 13, color: '#1976d2', fontWeight: 500 }}>
                More Colors…
                <input
                  type="color"
                  value={defaultNodeColor}
                  onChange={e => {
                    setDefaultNodeColor(e.target.value);
                    // Apply to selected node
                    if (selection.nodeId) {
                      useCLDStore.setState(state => ({
                        nodes: state.nodes.map(n => n.id === selection.nodeId ? { ...n, color: e.target.value } : n),
                        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                        future: [],
                      }));
                    }
                    setNodeMenuOpen(false);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
        {/* Default arc color split button */}
        <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'row', alignItems: 'flex-end', verticalAlign: 'top' }} ref={arcBtnRef}>
          <button
            title="Apply arrow color"
            style={{
              ...menuBtnStyle,
              marginRight: 0,
              position: 'relative',
              cursor: selection.arcId ? 'pointer' : 'not-allowed',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: selection.arcId ? 1 : 0.5,
              pointerEvents: selection.arcId ? 'auto' : 'none',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRight: 'none',
              paddingRight: 0,
              background: '#fff',
              width: 36,
              height: 36,
            }}
            disabled={!selection.arcId}
            onClick={() => {
              if (selection.arcId) {
                useCLDStore.setState(state => ({
                  arcs: state.arcs.map(a => a.id === selection.arcId ? { ...a, color: defaultArcColor } : a),
                  history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                  future: [],
                }));
              }
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <FaLongArrowAltRight size={22} color="#1976d2" style={{ display: 'block', marginBottom: 0 }} />
              <div style={{
                width: 22,
                height: 4,
                background: defaultArcColor,
                borderRadius: 2,
                marginTop: 2,
                marginBottom: 0,
                pointerEvents: 'none',
              }} />
            </span>
          </button>
          <button
            title="Pick arrow color"
            style={{
              ...menuBtnStyle,
              marginLeft: 0,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: '1px solid #bbb',
              padding: '6px 8px',
              opacity: selection.arcId ? 1 : 0.5,
              pointerEvents: selection.arcId ? 'auto' : 'none',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              width: 28,
              height: 36,
              justifyContent: 'center',
            }}
            disabled={!selection.arcId}
            onClick={() => setArcMenuOpen(open => !open)}
          >
            <FaChevronDown size={14} />
          </button>
          {/* Context menu for arc color */}
          {arcMenuOpen && selection.arcId && (
            <div
              style={{
                position: 'absolute',
                top: 38,
                left: 0,
                background: '#fff',
                border: '1px solid #bbb',
                borderRadius: 8,
                padding: 10,
                zIndex: 2000,
                boxShadow: '0 2px 8px #0002',
                minWidth: 180,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 6,
              }}
              onMouseLeave={() => setArcMenuOpen(false)}
            >
              {STANDARD_COLORS.map(color => (
                <button
                  key={color}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: color === defaultArcColor ? '2px solid #1976d2' : '1px solid #bbb',
                    background: color,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setDefaultArcColor(color);
                    // Apply to selected arc
                    if (selection.arcId) {
                      useCLDStore.setState(state => ({
                        arcs: state.arcs.map(a => a.id === selection.arcId ? { ...a, color } : a),
                        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                        future: [],
                      }));
                    }
                    setArcMenuOpen(false);
                  }}
                  title={color}
                />
              ))}
              {/* More Colors... */}
              <label style={{ gridColumn: 'span 7', marginTop: 6, cursor: 'pointer', textAlign: 'center', fontSize: 13, color: '#1976d2', fontWeight: 500 }}>
                More Colors…
                <input
                  type="color"
                  value={defaultArcColor}
                  onChange={e => {
                    setDefaultArcColor(e.target.value);
                    // Apply to selected arc
                    if (selection.arcId) {
                      useCLDStore.setState(state => ({
                        arcs: state.arcs.map(a => a.id === selection.arcId ? { ...a, color: e.target.value } : a),
                        history: [...state.history, { nodes: state.nodes, arcs: state.arcs }],
                        future: [],
                      }));
                    }
                    setArcMenuOpen(false);
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', background: '#f5f5f5', alignItems: 'center' }}>
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
        {tab === 'canvas' ? <Canvas key={refreshKey} /> : <Analysis refreshKey={refreshKey} />}
      </div>
    </div>
  );
};

// Menu button style
const menuBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#1976d2',
  fontSize: 22,
  marginRight: 16,
  cursor: 'pointer',
  padding: 6,
  borderRadius: 4,
  transition: 'background 0.2s',
};

export default App;
