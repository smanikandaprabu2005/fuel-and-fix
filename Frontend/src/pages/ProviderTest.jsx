import React from 'react';
import ProviderPanel from '../components/Provider/ProviderPanel';
import './ProviderTest.css';

const ProviderTest = () => {
  // For quick testing you can hardcode providerId and role here
  const providerId = 'provider-test-1';
  const role = 'delivery';

  return (
    <div style={{ padding: 20 }}>
      <h2>Provider Test</h2>
      <ProviderPanel providerId={providerId} role={role} coordinates={[0,0]} />
    </div>
  );
};

export default ProviderTest;
