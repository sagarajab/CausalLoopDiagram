import React, { useState, useRef } from 'react';
import Canvas from './components/Canvas';
import { useCLDStore } from './state/cldStore';
import { LuUndo2 , LuRedo2 , LuInfinity , LuFolderOpen , LuSave, LuPalette, LuChevronDown, LuSpline, LuEraser } from 'react-icons/lu';
import { LuType  } from 'react-icons/lu';

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
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 32 }}>
        <div style={{ minWidth: 420, flex: '0 0 auto' }}>
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
                <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>Sign</th>
                <th style={{ border: '1px solid #bbb', padding: '6px 16px', background: '#f5f5f5' }}>To Node</th>
              </tr>
            </thead>
            <tbody>
              {arcs.map(arc => (
                <tr key={arc.id}>
                  <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{arc.id}</td>
                  <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{`${getNodeLabel(arc.from)} (${arc.from})`}</td>
                  <td style={{ border: '1px solid #bbb', padding: '6px 16px', textAlign: 'center', fontWeight: 'bold', color: arc.sign === '+' ? '#388e3c' : '#d32f2f' }}>{arc.sign}</td>
                  <td style={{ border: '1px solid #bbb', padding: '6px 16px' }}>{`${getNodeLabel(arc.to)} (${arc.to})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Vertical divider */}
        <div style={{ width: 1, background: '#eee', alignSelf: 'stretch', margin: '0 8px' }} />
        <div style={{ minWidth: 400, flex: '1 1 0' }}>
          <h3>Adjacency Matrix</h3>
          <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #bbb', padding: '6px 12px', background: '#f5f5f5' }}></th>
                {nodes.map(colNode => (
                  <th key={colNode.id} style={{ border: '1px solid #bbb', padding: '6px 12px', background: '#f5f5f5', textAlign: 'center' }}>{getNodeLabel(colNode.id)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map(rowNode => (
                <tr key={rowNode.id}>
                  <th style={{ border: '1px solid #bbb', padding: '6px 12px', background: '#f5f5f5', textAlign: 'right' }}>{getNodeLabel(rowNode.id)}</th>
                  {nodes.map(colNode => {
                    const arc = arcs.find(a => a.from === rowNode.id && a.to === colNode.id);
                    return (
                      <td key={colNode.id} style={{ border: '1px solid #bbb', padding: '6px 12px', textAlign: 'center', fontWeight: 'bold', color: arc?.sign === '+' ? '#388e3c' : arc?.sign === '-' ? '#d32f2f' : '#888' }}>
                        {arc ? arc.sign : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  const arcDragStart = React.useRef<null | { arcId: string, mx: number, my: number, nx: number, ny: number, sign: number }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [filename, setFilename] = useState('Untitled');
  const [editingFilename, setEditingFilename] = useState(false);
  const [tempFilename, setTempFilename] = useState(filename);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const FILENAME_BOX_WIDTH = 250;

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  // Export diagram as .cld file
  const handleExport = () => {
    const data = {
      version: 1,
      nodes,
      arcs,
      defaultNodeColor,
      defaultArcColor,
    };
    let exportName = filename.trim() || 'Untitled';
    if (!exportName.toLowerCase().endsWith('.cld')) {
      exportName += '.cld';
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // Import diagram from .cld file
  const handleLoad = () => {
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.cld')) {
      setImportError('File must have .cld extension.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        if (typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.nodes) || !Array.isArray(data.arcs)) {
          setImportError('Invalid or unsupported .cld file.');
          return;
        }
        // Optionally validate node and arc structure here
        useCLDStore.setState(state => ({
          nodes: data.nodes,
          arcs: data.arcs,
          selection: {},
          history: [],
          future: [],
          nodeCounter: data.nodes.reduce((max: number, n: {id: string}) => Math.max(max, Number(n.id)), 0) + 1,
          arcCounter: data.arcs.reduce((max: number, a: {id: string}) => Math.max(max, Number(a.id)), 0) + 1,
          defaultNodeColor: data.defaultNodeColor || '#222',
          defaultArcColor: data.defaultArcColor || '#888',
        }));
        // Set filename to file name without extension
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        setFilename(baseName || 'Untitled');
        setTab('canvas');
        setRefreshKey(k => k + 1);
      } catch (err) {
        setImportError('Failed to parse .cld file.');
      }
    };
    reader.readAsText(file);
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
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #ddd', background: '#fff', position: 'relative' }}>
        {editingFilename ? (
          <input
            ref={filenameInputRef}
            value={tempFilename}
            onChange={e => setTempFilename(e.target.value)}
            onBlur={() => {
              setFilename(tempFilename.trim() || 'Untitled');
              setEditingFilename(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setFilename(tempFilename.trim() || 'Untitled');
                setEditingFilename(false);
              } else if (e.key === 'Escape') {
                setTempFilename(filename);
                setEditingFilename(false);
              }
            }}
            style={{
              fontWeight: 700,
              fontSize: 20,
              marginRight: 24,
              color: '#222',
              minWidth: FILENAME_BOX_WIDTH,
              maxWidth: FILENAME_BOX_WIDTH,
              width: FILENAME_BOX_WIDTH,
              userSelect: 'auto',
              letterSpacing: 0.5,
              border: '1px solid #bbb',
              borderRadius: 4,
              padding: '2px 8px',
              outline: 'none',
              background: '#f9f9f9',
              boxSizing: 'border-box',
              transition: 'none',
            }}
            autoFocus
          />
        ) : (
          <span
            style={{
              fontWeight: 700,
              fontSize: 20,
              marginRight: 24,
              color: '#222',
              minWidth: FILENAME_BOX_WIDTH,
              maxWidth: FILENAME_BOX_WIDTH,
              width: FILENAME_BOX_WIDTH,
              userSelect: 'none',
              letterSpacing: 0.5,
              cursor: 'pointer',
              display: 'inline-block',
              overflow: 'hidden',/**\] */
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              transition: 'none',
            }}
            title="Click to edit filename"
            onClick={() => {
              setTempFilename(filename);
              setEditingFilename(true);
              setTimeout(() => filenameInputRef.current?.focus(), 0);
            }}
          >
            {filename}
          </span>
        )}
        {/* Open */}
        <button
          onClick={handleLoad}
          title="Open"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuFolderOpen size={22} stroke="#333" strokeWidth={2} />
        </button>
        <input
          type="file"
          accept=".cld,application/json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {/* Save */}
        <button
          onClick={handleExport}
          title="Save"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuSave size={22} stroke="#333" strokeWidth={2} />
        </button>
        {/* Sync */}
        <button
          onClick={handleRefresh}
          title="Sync"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuInfinity size={22} stroke="#333" strokeWidth={2} />
        </button>
        {/* Undo */}
        <button
          onClick={undo}
          title="Undo"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuUndo2 size={22} stroke="#333" strokeWidth={2} />
        </button>
        {/* Redo */}
        <button
          onClick={redo}
          title="Redo"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuRedo2 size={22} stroke="#333" strokeWidth={2} />
        </button>
        {/* Clear Canvas */}
        <button
          onClick={() => { useCLDStore.getState().clearAll(); }}
          title="Clear Canvas"
          style={menuBtnStyle}
          onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
          onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
          onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
          onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
        >
          <LuEraser size={22} stroke="#333" strokeWidth={2} />
        </button>
        {/* T_color (node color split button) */}
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
              transition: 'background 0.15s, box-shadow 0.15s',
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
            onMouseOver={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#f0f4fa';
              if (selection.nodeId) e.currentTarget.style.boxShadow = '0 2px 8px #1976d222';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#e3eaf5';
            }}
            onMouseUp={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#f0f4fa';
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <LuType size={22} strokeWidth={2} color="#333" style={{ display: 'block', marginBottom: 0 }} />
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
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
            disabled={!selection.nodeId}
            onClick={() => setNodeMenuOpen(open => !open)}
            onMouseOver={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#f0f4fa';
              if (selection.nodeId) e.currentTarget.style.boxShadow = '0 2px 8px #1976d222';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#e3eaf5';
            }}
            onMouseUp={e => {
              if (selection.nodeId) e.currentTarget.style.background = '#f0f4fa';
            }}
          >
            <LuChevronDown size={14} strokeWidth={2} color="#333"  />
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
        {/* Arrow_Color (arc color split button) */}
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
              transition: 'background 0.15s, box-shadow 0.15s',
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
            onMouseOver={e => {
              if (selection.arcId) e.currentTarget.style.background = '#f0f4fa';
              if (selection.arcId) e.currentTarget.style.boxShadow = '0 2px 8px #1976d222';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={e => {
              if (selection.arcId) e.currentTarget.style.background = '#e3eaf5';
            }}
            onMouseUp={e => {
              if (selection.arcId) e.currentTarget.style.background = '#f0f4fa';
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <LuSpline size={22} color="#333" style={{ display: 'block', marginBottom: 0 }} />
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
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
            disabled={!selection.arcId}
            onClick={() => setArcMenuOpen(open => !open)}
            onMouseOver={e => {
              if (selection.arcId) e.currentTarget.style.background = '#f0f4fa';
              if (selection.arcId) e.currentTarget.style.boxShadow = '0 2px 8px #1976d222';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onMouseDown={e => {
              if (selection.arcId) e.currentTarget.style.background = '#e3eaf5';
            }}
            onMouseUp={e => {
              if (selection.arcId) e.currentTarget.style.background = '#f0f4fa';
            }}
          >
            <LuChevronDown size={14} strokeWidth={2} color="#333"/>
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
      {importError && (
        <span style={{ color: '#d32f2f', marginLeft: 18, fontWeight: 500, fontSize: 15 }}>{importError}</span>
      )}
    </div>
  );
};

// Menu button style
const menuBtnStyle: React.CSSProperties = {
  background: '#fff',
  border: 'none',
  color: '#1976d2',
  fontSize: 22,
  marginRight: 16,
  cursor: 'pointer',
  padding: 6,
  borderRadius: 4,
  transition: 'background 0.15s, box-shadow 0.15s',
};

export default App;
