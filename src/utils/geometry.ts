import { Point, NodeType, ArcType } from '../types';

// Circle calculations
export function getCircleFrom3Points(p1: Point, p2: Point, p3: Point) {
  const A = p2.x - p1.x;
  const B = p2.y - p1.y;
  const C = p3.x - p1.x;
  const D = p3.y - p1.y;
  const E = A * (p1.x + p2.x) + B * (p1.y + p2.y);
  const F = C * (p1.x + p3.x) + D * (p1.y + p3.y);
  const G = 2 * (A * (p3.y - p2.y) - B * (p3.x - p2.x));
  
  if (Math.abs(G) < 1e-6) return null; // Collinear
  
  const cx = (D * E - B * F) / G;
  const cy = (A * F - C * E) / G;
  const r = Math.sqrt((p1.x - cx) ** 2 + (p1.y - cy) ** 2);
  
  return { cx, cy, r };
}

export function getCircleCircleIntersections(c1: Point, r1: number, c2: Point, r2: number): Point[] {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];
  
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const xm = c1.x + (a * dx) / d;
  const ym = c1.y + (a * dy) / d;
  const xs1 = xm + (h * dy) / d;
  const ys1 = ym - (h * dx) / d;
  const xs2 = xm - (h * dy) / d;
  const ys2 = ym + (h * dx) / d;
  
  return [{ x: xs1, y: ys1 }, { x: xs2, y: ys2 }];
}

// Arc calculations
export function getRefCircleParams(from: Point, to: Point, curvature: number) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const control = { x: mx + nx * curvature, y: my + ny * curvature };
  
  return getCircleFrom3Points(from, to, control);
}

export function ellipseLineIntersection(
  cx: number, cy: number, rx: number, ry: number, px: number, py: number
) {
  const dx = px - cx;
  const dy = py - cy;
  
  if (dx === 0 && dy === 0) return { x: cx + rx, y: cy };
  
  const denom = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (denom === 0) return { x: cx + rx, y: cy };
  
  const t = Math.sqrt(1 / denom);
  let x = cx + t * dx;
  let y = cy + t * dy;
  
  // Clamp to ellipse boundary
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  const norm = Math.sqrt(nx * nx + ny * ny);
  
  if (Math.abs(norm - 1) > 1e-6 && norm !== 0) {
    x = cx + (nx / norm) * rx;
    y = cy + (ny / norm) * ry;
  }
  
  return { x, y };
}

export function findArcEllipseIntersection(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number,
  ellipseCx: number, ellipseCy: number, rx: number, ry: number,
  searchFromStart: boolean = true, segments: number = 1000
): Point | null {
  let delta = endAngle - startAngle;
  if (searchFromStart ? delta < 0 : delta > 0) delta += Math.PI * 2;
  if (Math.abs(delta) > Math.PI) delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
  
  let prevInside = null;
  let prevPt = null;
  
  for (let i = 0; i <= segments; ++i) {
    const t = searchFromStart ? i / segments : 1 - i / segments;
    const angle = startAngle + t * delta;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    
    const ex = (x - ellipseCx) / rx;
    const ey = (y - ellipseCy) / ry;
    const inside = (ex * ex + ey * ey) < 1;
    
    if (prevInside !== null && inside !== prevInside && prevPt) {
      const interp = (a: number, b: number) => a + (b - a) * 0.5;
      let x0 = prevPt.x, y0 = prevPt.y, x1 = x, y1 = y;
      
      // Binary search for boundary
      for (let j = 0; j < 8; ++j) {
        const mx = interp(x0, x1);
        const my = interp(y0, y1);
        const mex = (mx - ellipseCx) / rx;
        const mey = (my - ellipseCy) / ry;
        const minside = (mex * mex + mey * mey) < 1;
        
        if (minside === inside) {
          x1 = mx; y1 = my;
        } else {
          x0 = mx; y0 = my;
        }
      }
      
      const dx = x0 - ellipseCx;
      const dy = y0 - ellipseCy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const epsilon = 1.0;
      
      return {
        x: ellipseCx + dx / len * (len + epsilon),
        y: ellipseCy + dy / len * (len + epsilon)
      };
    }
    
    prevInside = inside;
    prevPt = { x, y };
  }
  
  // Fallback
  if (prevPt) {
    const dx = prevPt.x - ellipseCx;
    const dy = prevPt.y - ellipseCy;
    const len = Math.sqrt(dx * dx + dy * dy);
    const epsilon = 1.0;
    
    return {
      x: ellipseCx + dx / len * (len + epsilon),
      y: ellipseCy + dy / len * (len + epsilon)
    };
  }
  
  return prevPt;
}

// Path generation
export function describeArc(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number, sweepFlag: number
) {
  const start = {
    x: cx + r * Math.cos(startAngle),
    y: cy + r * Math.sin(startAngle),
  };
  const end = {
    x: cx + r * Math.cos(endAngle),
    y: cy + r * Math.sin(endAngle),
  };
  
  const largeArcFlag = 0;
  return `M${start.x},${start.y} A${r},${r} 0 ${largeArcFlag} ${sweepFlag} ${end.x},${end.y}`;
}

export function describeArcPolyline(
  cx: number, cy: number, r: number, startAngle: number, endAngle: number, 
  sweepFlag: number, segments = 40
) {
  let delta = endAngle - startAngle;
  if (Math.abs(delta) > Math.PI) {
    delta = delta > 0 ? delta - 2 * Math.PI : delta + 2 * Math.PI;
  }
  
  const points = [];
  for (let i = 0; i <= segments; ++i) {
    const t = i / segments;
    const angle = startAngle + t * delta;
    points.push([
      cx + r * Math.cos(angle),
      cy + r * Math.sin(angle)
    ]);
  }
  
  return 'M' + points.map(([x, y]) => `${x},${y}`).join(' L');
}

// Node size calculations
export function estimateLabelSize(label: string, fontSize: number, maxWidth = 220) {
  const lines = wrapTextToWidth(label, maxWidth, fontSize);
  const longest = lines.reduce((a, b) => a.length > b.length ? a : b, '');
  
  let width = 1;
  for (const line of lines) {
    width = Math.max(width, measureTextWidth(line, fontSize, 'bold', 'normal'));
  }
  
  const lineHeight = fontSize * 1.2;
  const height = lines.length * lineHeight;
  
  return { width, height, lines };
}

export function wrapTextToWidth(
  text: string, maxWidth: number, fontSize: number, 
  fontWeight = 'bold', fontStyle = 'normal'
) {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      const testWidth = measureTextWidth(testLine, fontSize, fontWeight, fontStyle);
      
      if (testWidth > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    lines.push(line);
  }
  
  return lines;
}

export function measureTextWidth(
  text: string, fontSize = 20, fontWeight = 'bold', fontStyle = 'italic'
) {
  if (typeof document === 'undefined') return text.length * 10.5;
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const tempText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  tempText.setAttribute('font-size', fontSize.toString());
  tempText.setAttribute('font-weight', fontWeight);
  tempText.setAttribute('font-style', fontStyle);
  tempText.textContent = text;
  svg.appendChild(tempText);
  document.body.appendChild(svg);
  const width = tempText.getBBox().width;
  document.body.removeChild(svg);
  
  return width;
}

// Arc endpoint calculations
export function getArcEndpoints(
  from: NodeType, to: NodeType, refCircle: { cx: number; cy: number; r: number }, arc: ArcType
) {
  const fontSizeFrom = 16; // Simplified for now
  const fontSizeTo = 16;
  const { width: wFrom, height: hFrom } = estimateLabelSize(from.label, fontSizeFrom);
  const { width: wTo, height: hTo } = estimateLabelSize(to.label, fontSizeTo);
  const padding = 16;
  
  const rxFrom = Math.abs(wFrom / 2 + padding);
  const ryFrom = Math.abs(hFrom / 2 + padding);
  const rxTo = Math.abs(wTo / 2 + padding);
  const ryTo = Math.abs(hTo / 2 + padding);
  
  const startAngle = Math.atan2(from.y - refCircle.cy, from.x - refCircle.cx);
  const endAngle = Math.atan2(to.y - refCircle.cy, to.x - refCircle.cx);
  
  const start = findArcEllipseIntersection(
    refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
    from.x, from.y, rxFrom, ryFrom, arc.curvatureSign > 0
  );
  
  const end = findArcEllipseIntersection(
    refCircle.cx, refCircle.cy, refCircle.r, startAngle, endAngle,
    to.x, to.y, rxTo, ryTo, arc.curvatureSign > 0
  );
  
  return { start, end };
} 