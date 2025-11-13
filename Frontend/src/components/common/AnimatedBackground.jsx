import React from 'react';
import './AnimatedBackground.css';

const AnimatedBackground = () => {
  return (
    <div className="animated-background">
      <div className="gradient-overlay"></div>
      <div className="particle-overlay"></div>
    </div>
  );
};

export default AnimatedBackground;
