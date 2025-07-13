import React from 'react';

const Toolbar: React.FC = () => {
  return (
    <div style={{ height: 48, background: '#f5f5f5', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #ddd' }}>
      <span style={{ fontWeight: 600 }}>CLD Editor</span>
      {/* Undo/Redo and other controls will go here */}
    </div>
  );
};

export default Toolbar; 