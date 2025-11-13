import React from 'react';
import WebGLBackground from './WebGLBackground';

const ThemeWrapper = ({ children }) => {
  return (
    <>
      <WebGLBackground />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </main>
    </>
  );
};

export default ThemeWrapper;
