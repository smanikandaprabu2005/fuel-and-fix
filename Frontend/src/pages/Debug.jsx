import React from 'react';
import './Debug.css';

const Debug = () => {
  return (
    <div style={{ padding: 20 }}>
      <h2>Debug Info</h2>
      <pre>{JSON.stringify({
        VITE_API_URL: import.meta.env.VITE_API_URL,
        //VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      }, null, 2)}</pre>
    </div>
  );
};

export default Debug;
