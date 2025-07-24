import { NodeType, ArcType, LoopType } from '../types';

// Johnson's algorithm for finding all simple cycles in a directed graph
export function findAllSimpleCycles(nodes: NodeType[], arcs: ArcType[]): string[][] {
  const adj: Record<string, { to: string; sign: string }[]> = {};
  nodes.forEach((n: NodeType) => { adj[n.id] = []; });
  arcs.forEach((a: ArcType) => { adj[a.from].push({ to: a.to, sign: a.sign }); });
  
  const blocked: Record<string, boolean> = {};
  const B: Record<string, string[]> = {};
  const stack: string[] = [];
  const cycles: string[][] = [];
  
  function unblock(u: string) {
    blocked[u] = false;
    (B[u] || []).forEach((w: string) => {
      if (blocked[w]) unblock(w);
    });
    B[u] = [];
  }
  
  function circuit(v: string, s: string): boolean {
    let closed = false;
    stack.push(v);
    blocked[v] = true;
    
    for (const { to: w } of adj[v]) {
      if (w === s) {
        // Found a cycle
        cycles.push([...stack, s]);
        closed = true;
      } else if (!blocked[w]) {
        if (circuit(w, s)) closed = true;
      }
    }
    
    if (closed) {
      unblock(v);
    } else {
      for (const { to: w } of adj[v]) {
        if (!B[w]) B[w] = [];
        if (!B[w].includes(v)) B[w].push(v);
      }
    }
    
    stack.pop();
    return closed;
  }
  
  const nodeIds = nodes.map((n: NodeType) => n.id);
  for (let i = 0; i < nodeIds.length; ++i) {
    const s = nodeIds[i];
    // Subgraph induced by nodes >= s
    const subNodes = nodeIds.slice(i);
    // Reset blocked/B
    subNodes.forEach((n: string) => { blocked[n] = false; B[n] = []; });
    // Run circuit
    circuit(s, s);
  }
  
  // Remove duplicate cycles (cycles with same nodes, different start)
  const unique: string[][] = [];
  const seen = new Set<string>();
  
  for (const cyc of cycles) {
    const norm = [...cyc];
    norm.pop(); // remove duplicate start at end
    
    // Normalize: rotate so smallest id is first
    let minIdx = 0;
    for (let i = 1; i < norm.length; ++i) if (norm[i] < norm[minIdx]) minIdx = i;
    
    const rotated = [...norm.slice(minIdx), ...norm.slice(0, minIdx)];
    const key = rotated.join('-');
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(rotated);
    }
  }
  
  return unique;
}

// Classify loops as Reinforcing (R) or Balancing (B)
export function classifyLoops(cycles: string[][], arcs: ArcType[]): LoopType[] {
  return cycles.map((cyc, i) => {
    let product = 1;
    
    for (let j = 0; j < cyc.length; ++j) {
      const from = cyc[j];
      const to = cyc[(j + 1) % cyc.length];
      const arc = arcs.find(a => a.from === from && a.to === to);
      
      if (!arc) { 
        product = 0; 
        break; 
      }
      
      product *= (arc.sign === '+' ? 1 : -1);
    }
    
    return {
      id: `L${i + 1}`,
      nodes: cyc,
      length: cyc.length,
      type: product === 1 ? 'R' : product === -1 ? 'B' : '?',
    };
  });
}

// Get all loops with classification
export function getAllLoops(nodes: NodeType[], arcs: ArcType[]): LoopType[] {
  const cycles = findAllSimpleCycles(nodes, arcs);
  return classifyLoops(cycles, arcs);
}

// Check if an arc is part of a specific loop
export function isArcInLoop(arc: ArcType, loop: LoopType): boolean {
  for (let i = 0; i < loop.nodes.length; ++i) {
    const f = loop.nodes[i];
    const t = loop.nodes[(i + 1) % loop.nodes.length];
    if (arc.from === f && arc.to === t) {
      return true;
    }
  }
  return false;
}

// Get loop statistics
export function getLoopStats(loops: LoopType[]) {
  const reinforcing = loops.filter(l => l.type === 'R').length;
  const balancing = loops.filter(l => l.type === 'B').length;
  const unknown = loops.filter(l => l.type === '?').length;
  
  return {
    total: loops.length,
    reinforcing,
    balancing,
    unknown,
    averageLength: loops.length > 0 ? loops.reduce((sum, l) => sum + l.length, 0) / loops.length : 0
  };
} 