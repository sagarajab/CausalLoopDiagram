import { CLDFileData, NodeType, ArcType } from '../types';

// Export diagram as .cld file
export function exportDiagram(
  nodes: NodeType[], 
  arcs: ArcType[], 
  defaultNodeColor: string, 
  defaultArcColor: string,
  filename: string
): void {
  const data: CLDFileData = {
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
}

// Validate .cld file data
export function validateCLDFile(data: any): { isValid: boolean; error?: string } {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Invalid file format' };
  }
  
  if (data.version !== 1) {
    return { isValid: false, error: 'Unsupported file version' };
  }
  
  if (!Array.isArray(data.nodes)) {
    return { isValid: false, error: 'Invalid nodes data' };
  }
  
  if (!Array.isArray(data.arcs)) {
    return { isValid: false, error: 'Invalid arcs data' };
  }
  
  // Validate node structure
  for (const node of data.nodes) {
    if (!node.id || typeof node.x !== 'number' || typeof node.y !== 'number' || !node.label) {
      return { isValid: false, error: 'Invalid node structure' };
    }
  }
  
  // Validate arc structure
  for (const arc of data.arcs) {
    if (!arc.id || !arc.from || !arc.to || !['+', '-'].includes(arc.sign)) {
      return { isValid: false, error: 'Invalid arc structure' };
    }
  }
  
  return { isValid: true };
}

// Import diagram from file
export function importDiagram(file: File): Promise<{
  success: boolean;
  data?: CLDFileData;
  error?: string;
  filename?: string;
}> {
  return new Promise((resolve) => {
    if (!file.name.endsWith('.cld')) {
      resolve({ success: false, error: 'File must have .cld extension' });
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);
        
        const validation = validateCLDFile(data);
        if (!validation.isValid) {
          resolve({ success: false, error: validation.error });
          return;
        }
        
        const baseName = file.name.replace(/\.[^/.]+$/, '');
        resolve({ 
          success: true, 
          data: data as CLDFileData, 
          filename: baseName || 'Untitled' 
        });
      } catch (err) {
        resolve({ success: false, error: 'Failed to parse .cld file' });
      }
    };
    
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' });
    };
    
    reader.readAsText(file);
  });
}

// Get filename without extension
export function getFilenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '') || 'Untitled';
}

// Validate filename
export function validateFilename(filename: string): { isValid: boolean; error?: string } {
  if (!filename.trim()) {
    return { isValid: false, error: 'Filename cannot be empty' };
  }
  
  if (filename.length > 255) {
    return { isValid: false, error: 'Filename too long' };
  }
  
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(filename)) {
    return { isValid: false, error: 'Filename contains invalid characters' };
  }
  
  return { isValid: true };
} 