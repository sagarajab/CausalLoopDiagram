import React, { useState, useRef } from 'react';
import { Canvas } from './components/canvas/Canvas';
import { useCLDStore } from './state/cldStore';
import { 
  LuUndo2, 
  LuRedo2, 
  LuFolderOpen, 
  LuSave, 
  LuChevronDown, 
  LuSpline, 
  LuEraser, 
  LuLayout, 
  LuBarChart, 
  LuMenu,
  LuType,
  LuDiamond,
  LuAlignLeft
} from 'react-icons/lu';

// Responsive breakpoints
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};

// Hook for responsive design
const useResponsive = () => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return {
    isMobile: windowWidth < BREAKPOINTS.mobile,
    isTablet: windowWidth >= BREAKPOINTS.mobile && windowWidth < BREAKPOINTS.tablet,
    isDesktop: windowWidth >= BREAKPOINTS.tablet,
    windowWidth,
  };
};

const Analysis: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const arcs = useCLDStore(state => state.arcs);
  const nodes = useCLDStore(state => state.nodes);
  const { isMobile, isTablet } = useResponsive();
  const getNodeLabel = (id: string) => nodes.find(n => n.id === id)?.label || id;

  // Compute #input and #output for each node
  const nodeStats = nodes.map(node => {
    const numInput = arcs.filter(arc => arc.to === node.id).length;
    const numOutput = arcs.filter(arc => arc.from === node.id).length;
    return { ...node, numInput, numOutput };
  });

  // Use refreshKey to force re-render if needed
  React.useEffect(() => {}, [refreshKey]);

  const containerStyle = {
    padding: isMobile ? 16 : 32,
    display: 'flex',
    flexDirection: (isMobile ? 'column' : 'row') as 'column' | 'row',
    alignItems: 'flex-start',
    gap: isMobile ? 16 : 32,
  };

  const leftColumnStyle = {
    minWidth: isMobile ? '100%' : 420,
    flex: isMobile ? 'none' : '0 0 auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: isMobile ? 16 : 24,
    width: isMobile ? '100%' : 'auto',
  };

  const rightColumnStyle = {
    minWidth: isMobile ? '100%' : 400,
    flex: isMobile ? 'none' : '1 1 0' as const,
    background: '#fafbfc',
    borderRadius: 8,
    boxShadow: '0 1px 4px #0001',
    padding: 12,
    maxHeight: isMobile ? 400 : 540,
    overflow: 'auto',
    width: isMobile ? '100%' : 'auto',
  };

  const tableContainerStyle = {
    background: '#fafbfc',
    borderRadius: 8,
    boxShadow: '0 1px 4px #0001',
    padding: 12,
    maxHeight: isMobile ? 200 : 260,
    overflow: 'auto',
    marginBottom: 0,
  };

  const tableStyle = {
    borderCollapse: 'collapse' as const,
    minWidth: isMobile ? 300 : 400,
    marginBottom: 0,
    fontSize: isMobile ? 12 : 13,
  };

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      <h2 style={{ fontSize: isMobile ? 20 : 24, marginBottom: isMobile ? 16 : 24 }}>Analysis</h2>
      <div style={containerStyle}>
        {/* Left column: Node Summary and Connections, stacked and scrollable */}
        <div style={leftColumnStyle}>
          {/* Node Summary Table Container */}
          <div style={tableContainerStyle}>
            <h3 style={{ marginTop: 0, fontSize: isMobile ? 16 : 18 }}>Node Summary</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>ID</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>Name</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}># Input</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}># Output</th>
                </tr>
              </thead>
              <tbody>
                {nodeStats.map(node => (
                  <tr key={node.id}>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', fontSize: isMobile ? 12 : 13 }}>{node.id}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', fontSize: isMobile ? 12 : 13 }}>{node.label}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', textAlign: 'center', fontSize: isMobile ? 12 : 13 }}>{node.numInput}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', textAlign: 'center', fontSize: isMobile ? 12 : 13 }}>{node.numOutput}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Connections Table Container */}
          <div style={tableContainerStyle}>
            <h3 style={{ marginTop: 0, fontSize: isMobile ? 16 : 18 }}>Connections</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>ID</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>From Node</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>Sign</th>
                  <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', background: '#f5f5f5', fontSize: isMobile ? 12 : 13 }}>To Node</th>
                </tr>
              </thead>
              <tbody>
                {arcs.map(arc => (
                  <tr key={arc.id}>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', fontSize: isMobile ? 12 : 13 }}>{arc.id}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', fontSize: isMobile ? 12 : 13 }}>{`${getNodeLabel(arc.from)} (${arc.from})`}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', textAlign: 'center', fontWeight: 'bold', color: arc.sign === '+' ? '#388e3c' : '#d32f2f', fontSize: isMobile ? 12 : 13 }}>{arc.sign}</td>
                    <td style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 16px', fontSize: isMobile ? 12 : 13 }}>{`${getNodeLabel(arc.to)} (${arc.to})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* Right column: Adjacency Matrix in its own scrollable container */}
        <div style={rightColumnStyle}>
          <h3 style={{ marginTop: 0, fontSize: isMobile ? 16 : 18 }}>Adjacency Matrix</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                {/* Top-left cell: sticky both top and left */}
                <th style={{ border: '1px solid #bbb', padding: isMobile ? '4px 8px' : '6px 12px', background: '#f5f5f5', position: 'sticky', top: 0, left: 0, zIndex: 3, fontSize: isMobile ? 12 : 13 }}></th>
                {nodes.map(colNode => (
                  <th
                    key={colNode.id}
                    style={{
                      border: '1px solid #bbb',
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      background: '#f5f5f5',
                      textAlign: 'center',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      fontSize: isMobile ? 12 : 13,
                    }}
                  >
                    {getNodeLabel(colNode.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nodes.map(rowNode => (
                <tr key={rowNode.id}>
                  {/* Row header: sticky left */}
                  <th
                    style={{
                      border: '1px solid #bbb',
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      background: '#f5f5f5',
                      textAlign: 'right',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      fontSize: isMobile ? 12 : 13,
                    }}
                  >
                    {getNodeLabel(rowNode.id)}
                  </th>
                  {nodes.map(colNode => {
                    const arc = arcs.find(a => a.from === rowNode.id && a.to === colNode.id);
                    return (
                      <td
                        key={colNode.id}
                        style={{
                          border: '1px solid #bbb',
                          padding: isMobile ? '4px 8px' : '6px 12px',
                          textAlign: 'center',
                          fontWeight: 'bold',
                          color: arc?.sign === '+' ? '#388e3c' : arc?.sign === '-' ? '#d32f2f' : '#888',
                          background: '#fff',
                          fontSize: isMobile ? 12 : 13,
                        }}
                      >
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isMobile, isTablet } = useResponsive();
  
  const undo = useCLDStore(state => state.undo);
  const redo = useCLDStore(state => state.redo);
  const selection = useCLDStore(state => state.selection);
  const nodes = useCLDStore(state => state.nodes);
  const arcs = useCLDStore(state => state.arcs);
  const defaultNodeColor = useCLDStore(state => state.defaultNodeColor);
  const defaultArcColor = useCLDStore(state => state.defaultArcColor);
  const nodeFontFamily = useCLDStore(state => state.nodeFontFamily);
  const nodeFontSize = useCLDStore(state => state.nodeFontSize);
  const setDefaultNodeColor = useCLDStore(state => state.setDefaultNodeColor);
  const setDefaultArcColor = useCLDStore(state => state.setDefaultArcColor);
  const setNodeFontFamily = useCLDStore(state => state.setNodeFontFamily);
  const setNodeFontSize = useCLDStore(state => state.setNodeFontSize);
  const [colorPickerOpen, setColorPickerOpen] = useState<'selected' | 'node' | 'arc' | null>(null);
  const [nodeMenuOpen, setNodeMenuOpen] = useState(false);
  const [arcMenuOpen, setArcMenuOpen] = useState(false);
  const [fontFamilyMenuOpen, setFontFamilyMenuOpen] = useState(false);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const nodeBtnRef = React.useRef<HTMLDivElement>(null);
  const arcBtnRef = React.useRef<HTMLDivElement>(null);
  const fontBtnRef = React.useRef<HTMLDivElement>(null);
  const arcDragStart = React.useRef<null | { arcId: string, mx: number, my: number, nx: number, ny: number, sign: number }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [filename, setFilename] = useState('Untitled');
  const [editingFilename, setEditingFilename] = useState(false);
  const [tempFilename, setTempFilename] = useState(filename);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  const FILENAME_BOX_WIDTH = 250;



  // Export diagram as .cld file
  const handleExport = () => {
    const data = {
      version: 1,
      nodes,
      arcs,
      defaultNodeColor,
      defaultArcColor,
      nodeFontFamily,
      nodeFontSize,
      canvasPan: useCLDStore.getState().canvasPan,
      canvasScale: useCLDStore.getState().canvasScale,
      problemStatement: useCLDStore.getState().problemStatement,
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
          nodeFontFamily: data.nodeFontFamily || 'Arial',
          nodeFontSize: data.nodeFontSize || 16,
          canvasPan: data.canvasPan || { x: 0, y: 0 },
          canvasScale: data.canvasScale || 1,
          problemStatement: data.problemStatement || 'Describe the problem here...',
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

  // Font options for node labels
  const FONT_OPTIONS = [
    { name: 'Arial', value: 'Arial' },
    { name: 'Helvetica', value: 'Helvetica' },
    { name: 'Times New Roman', value: 'Times New Roman' },
    { name: 'Georgia', value: 'Georgia' },
    { name: 'Verdana', value: 'Verdana' },
    { name: 'Courier New', value: 'Courier New' }
  ];

  const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      {/* Title bar for filename */}
      <div style={{ 
        width: '100%', 
        background: '#212121', 
        borderBottom: '1px solid rgb(36, 36, 36)', 
        padding: isMobile ? '8px 16px' : '10px 32px', 
        display: 'flex', 
        alignItems: 'center', 
        minHeight: 20, 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8
      }}>
        {/* Left: App icon and name */}
        <div style={{ display: 'flex', alignItems: 'center', height: 38, position: 'relative', gap: isMobile ? 12 : 18 }}>
          {/* App Icon Placeholder replaced with actual logo */}
          <img
            src={require('./assets/sysloop.png')}
            alt="SysLoop Logo"
            style={{ 
              maxWidth: isMobile ? 28 : 34, 
              maxHeight: isMobile ? 28 : 34, 
              marginRight: isMobile ? 8 : 10, 
              background: 'transparent', 
              display: 'inline-block' 
            }}
          />
          {/* App Name */}
          <span style={{ 
            fontWeight: 700, 
            fontSize: isMobile ? 12 : 14, 
            color: '#fff', 
            letterSpacing: 1, 
            marginRight: isMobile ? 8 : 10, 
            userSelect: 'none' 
          }}>SysLoop</span>
        </div>
        {/* Right: Filename pill and logo */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? 12 : 18,
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          {/* Filename pill */}
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
                fontWeight: 500,
                fontSize: isMobile ? 12 : 14,
                color: '#222',
                width: isMobile ? 200 : 340,
                userSelect: 'none',
                letterSpacing: 0.5,
                border: 'none',
                borderRadius: 999,
                padding: isMobile ? '4px 16px' : '6px 32px',
                outline: 'none',
                background: '#ffbc1f',
                boxSizing: 'border-box',
                transition: 'none',
                boxShadow: '0 1px 4px #0001',
                verticalAlign: 'middle',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                marginLeft: 0,
                marginRight: 0,
              }}
              autoFocus
            />
          ) :
            <span
              style={{
                fontWeight: 500,
                fontSize: isMobile ? 12 : 14,
                color: '#222',
                width: isMobile ? 200 : 340,
                userSelect: 'none',
                letterSpacing: 0.5,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                transition: 'none',
                padding: isMobile ? '4px 16px' : '6px 32px',
                borderRadius: 999,
                background: '#ffbc1f',
                marginLeft: 0,
                marginRight: 0,
                boxShadow: '0 1px 4px #0001',
                verticalAlign: 'middle',
                display: 'inline-block',
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
          }
          {!isMobile && (
            <img
              src={require('./assets/TBT.png')}
              alt="Logo"
              style={{ height: 36, maxWidth: 120, objectFit: 'contain', marginLeft: 32, paddingRight: 50 }}
            />
          )}
        </div>
      </div>
      {/* Menu bar */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: isMobile ? '4px 8px' : '6px 16px', 
        background: '#ffffff', 
        borderBottom: '1px solid #e2e8f0',
        position: 'relative', 
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        flexWrap: 'wrap',
        gap: isMobile ? 4 : 8,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Menu bar content: icon group left, tab buttons right */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: isMobile ? 8 : 12 }}>
          {/* Mobile menu button */}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Menu"
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: '8px',
                marginRight: 8
              }}
            >
              <LuMenu size={20} stroke="#333" strokeWidth={2} />
            </button>
          )}
          
          {/* File operations group */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            flexWrap: 'wrap',
            ...(isMobile && !mobileMenuOpen && { display: 'none' })
          }}>
            {/* Open */}
            <button
              onClick={handleLoad}
              title="Open"
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: isMobile ? '6px 8px' : 6
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#cfcfcf'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseDown={e => { e.currentTarget.style.background = '#999'; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1976d2'; }}
            >
              <LuFolderOpen size={isMobile ? 18 : 22} stroke="#333" strokeWidth={2} color="inherit" />

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
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: isMobile ? '6px 8px' : 6
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#cfcfcf'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseDown={e => { e.currentTarget.style.background = '#999'; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1976d2'; }}
            >
              <LuSave size={isMobile ? 18 : 22} stroke="#333" strokeWidth={2} color="inherit" />

            </button>

          </div>

          {/* Edit operations group */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            flexWrap: 'wrap',
            ...(isMobile && !mobileMenuOpen && { display: 'none' })
          }}>
            {/* Undo */}
            <button
              onClick={undo}
              title="Undo"
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: isMobile ? '6px 8px' : 6
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#cfcfcf'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseDown={e => { e.currentTarget.style.background = '#999'; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1976d2'; }}
            >
              <LuUndo2 size={isMobile ? 18 : 22} stroke="#333" strokeWidth={2} color="inherit" />

            </button>
            {/* Redo */}
            <button
              onClick={redo}
              title="Redo"
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: isMobile ? '6px 8px' : 6
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#cfcfcf'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseDown={e => { e.currentTarget.style.background = '#999'; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1976d2'; }}
            >
              <LuRedo2 size={isMobile ? 18 : 22} stroke="#333" strokeWidth={2} color="inherit" />

            </button>
            {/* Clear Canvas */}
            <button
              onClick={() => { useCLDStore.getState().clearAll(); }}
              title="Clear Canvas"
              style={{ 
                ...menuBtnStyle, 
                display: 'flex', 
                alignItems: 'center',
                padding: isMobile ? '6px 8px' : 6
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#cfcfcf'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; e.currentTarget.style.color = '#fff'; }}
              onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseDown={e => { e.currentTarget.style.background = '#999'; e.currentTarget.style.color = '#fff'; }}
              onMouseUp={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1976d2'; }}
            >
              <LuEraser size={isMobile ? 18 : 22} stroke="#333" strokeWidth={2} color="inherit" />

            </button>
                    </div>

          {/* Color tools group */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            flexWrap: 'wrap',
            ...(isMobile && !mobileMenuOpen && { display: 'none' })
          }}>
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: selection.nodeId ? 1 : 0.5,
                  pointerEvents: selection.nodeId ? 'auto' : 'none',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                  paddingRight: 0,
                  background: '#fff',
                  width: 'auto',
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
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <LuDiamond size={isMobile ? 18 : 20} strokeWidth={2} color="#475569" style={{ display: 'block' }} />
                  <div style={{
                    width: 16,
                    height: 3,
                    background: defaultNodeColor,
                    borderRadius: 1.5,
                    pointerEvents: 'none',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
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
                  if (selection.nodeId) e.currentTarget.style.background = '#cfcfcf';
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
                    top: 44,
                    left: 0,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 12,
                    zIndex: 2000,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: 200,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 8,
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseLeave={() => setNodeMenuOpen(false)}
                >
                  {STANDARD_COLORS.map(color => (
                    <button
                      key={color}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: color === defaultNodeColor ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        background: color,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  opacity: selection.arcId ? 1 : 0.5,
                  pointerEvents: selection.arcId ? 'auto' : 'none',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                  paddingRight: 0,
                  background: '#fff',
                  width: 'auto',
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
                  if (selection.arcId) e.currentTarget.style.background = '#cfcfcf';
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
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <LuSpline size={isMobile ? 18 : 20} color="#475569" style={{ display: 'block' }} />
                  <div style={{
                    width: 18,
                    height: 3,
                    background: defaultArcColor,
                    borderRadius: 1.5,
                    pointerEvents: 'none',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
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
                    top: 44,
                    left: 0,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 12,
                    zIndex: 2000,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: 200,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 8,
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseLeave={() => setArcMenuOpen(false)}
                >
                  {STANDARD_COLORS.map(color => (
                    <button
                      key={color}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: color === defaultArcColor ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        background: color,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
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

          {/* Font tools group */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? 8 : 12,
            flexWrap: 'wrap',
            ...(isMobile && !mobileMenuOpen && { display: 'none' })
          }}>
            {/* Font Family */}
            <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'row', alignItems: 'flex-end', verticalAlign: 'top' }} ref={fontBtnRef}>
              <button
                title="Font Family"
                style={{
                  ...menuBtnStyle,
                  marginRight: 0,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                  paddingRight: 0,
                  background: '#fff',
                  width: 'auto',
                  minWidth: 120,
                  height: 40,
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
                onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
                onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                  <div style={{
                    fontSize: 13,
                    color: '#475569',
                    fontFamily: nodeFontFamily,
                    fontWeight: 500,
                    letterSpacing: '0.025em'
                  }}>
                    {FONT_OPTIONS.find(f => f.value === nodeFontFamily)?.name || nodeFontFamily}
                  </div>
                </span>
              </button>
              <button
                title="Select Font"
                style={{
                  ...menuBtnStyle,
                  marginLeft: 0,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: '6px 8px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  width: 32,
                  height: 40,
                  justifyContent: 'center',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onClick={() => setFontFamilyMenuOpen(open => !open)}
                onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
                onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
                onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
              >
                <LuChevronDown size={14} strokeWidth={2} color="#475569"/>
              </button>
              {/* Context menu for font family */}
              {fontFamilyMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 44,
                    left: 0,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 8,
                    zIndex: 2000,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: 160,
                    maxHeight: 240,
                    overflow: 'auto',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseLeave={() => setFontFamilyMenuOpen(false)}
                >
                  {FONT_OPTIONS.map(font => (
                    <button
                      key={font.value}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        background: font.value === nodeFontFamily ? '#f1f5f9' : 'transparent',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 14,
                        fontFamily: font.value,
                        color: font.value === nodeFontFamily ? '#1e293b' : '#475569',
                        fontWeight: font.value === nodeFontFamily ? '600' : '400',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        setNodeFontFamily(font.value);
                        setFontFamilyMenuOpen(false);
                      }}
                    >
                      {font.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font Size */}
            <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'row', alignItems: 'flex-end', verticalAlign: 'top' }}>
              <button
                title="Font Size"
                style={{
                  ...menuBtnStyle,
                  marginRight: 0,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                  paddingRight: 0,
                  background: '#fff',
                  width: 'auto',
                  minWidth: 60,
                  height: 40,
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
                onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
                onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
                  <div style={{
                    fontSize: 13,
                    color: '#475569',
                    fontWeight: 500,
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {nodeFontSize}
                  </div>
                </span>
              </button>
              <button
                title="Select Font Size"
                style={{
                  ...menuBtnStyle,
                  marginLeft: 0,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  padding: '6px 8px',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  width: 32,
                  height: 40,
                  justifyContent: 'center',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}
                onClick={() => setFontSizeMenuOpen(open => !open)}
                onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.boxShadow = '0 2px 8px #1976d222'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none'; }}
                onMouseDown={e => { e.currentTarget.style.background = '#e3eaf5'; }}
                onMouseUp={e => { e.currentTarget.style.background = '#f0f4fa'; }}
              >
                <LuChevronDown size={14} strokeWidth={2} color="#475569"/>
              </button>
              {/* Context menu for font size */}
              {fontSizeMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 44,
                    left: 0,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 8,
                    zIndex: 2000,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1)',
                    minWidth: 90,
                    maxHeight: 240,
                    overflow: 'auto',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseLeave={() => setFontSizeMenuOpen(false)}
                >
                  {FONT_SIZE_OPTIONS.map(size => (
                    <button
                      key={size}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        background: size === nodeFontSize ? '#f1f5f9' : 'transparent',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontSize: 14,
                        color: size === nodeFontSize ? '#1e293b' : '#475569',
                        fontWeight: size === nodeFontSize ? '600' : '400',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => {
                        setNodeFontSize(size);
                        setFontSizeMenuOpen(false);
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Spacer to push tab buttons right */}
          <div style={{ flex: 1 }} />
          {/* Canvas/Analysis tab buttons right-aligned */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0, 
            marginLeft: isMobile ? 8 : 32, 
            fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setTab('canvas')}
              style={{
                padding: isMobile ? '8px 16px' : '10px 28px',
                border: 'none',
                borderBottom: tab === 'canvas' ? '3px solid #1976d2' : '3px solid transparent',
                background: 'none',
                fontWeight: 600,
                color: tab === 'canvas' ? '#1976d2' : '#333',
                cursor: 'pointer',
                outline: 'none',
                fontSize: isMobile ? 14 : 17,
                transition: 'color 0.15s, border-bottom 0.15s, background 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 4 : 8,
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = tab === 'canvas' ? '#1976d2' : '#333'; }}
            >
              <LuLayout size={isMobile ? 16 : 20} style={{ marginRight: isMobile ? 4 : 6, verticalAlign: 'middle' }} />

            </button>
            <button
              onClick={() => setTab('analysis')}
              style={{
                padding: isMobile ? '8px 16px' : '10px 28px',
                border: 'none',
                borderBottom: tab === 'analysis' ? '3px solid #1976d2' : '3px solid transparent',
                background: 'none',
                fontWeight: 600,
                color: tab === 'analysis' ? '#1976d2' : '#333',
                cursor: 'pointer',
                outline: 'none',
                fontSize: isMobile ? 14 : 17,
                transition: 'color 0.15s, border-bottom 0.15s, background 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 4 : 8,
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#f0f4fa'; e.currentTarget.style.color = '#1976d2'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = tab === 'analysis' ? '#1976d2' : '#333'; }}
            >
              <LuBarChart size={isMobile ? 16 : 20} style={{ marginRight: isMobile ? 4 : 6, verticalAlign: 'middle' }} />

            </button>
          </div>
        </div>
      </div>
      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        {tab === 'canvas' ? <Canvas key={refreshKey} /> : <Analysis refreshKey={refreshKey} />}
      </div>
      {importError && (
        <span style={{ 
          color: '#d32f2f', 
          marginLeft: isMobile ? 8 : 18, 
          fontWeight: 500, 
          fontSize: isMobile ? 13 : 15,
          padding: isMobile ? '8px 16px' : '12px 24px'
        }}>{importError}</span>
      )}
    </div>
  );
};

// Modern menu button style
const menuBtnStyle: React.CSSProperties = {
  background: '#ffffff',
  border: 'none',
  color: '#475569',
  fontSize: 16,
  cursor: 'pointer',
  padding: 6,
  borderRadius: 6,
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  minWidth: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'none',
  outline: 'none',
  userSelect: 'none',
};

// Modern button hover effects
const modernButtonHoverEffects = {
  onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#f8fafc';
    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  },
  onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#ffffff';
    e.currentTarget.style.boxShadow = 'none';
  },
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#f1f5f9';
    e.currentTarget.style.transform = 'translateY(1px)';
  },
  onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#f8fafc';
    e.currentTarget.style.transform = 'translateY(0)';
  }
};

export default App;
