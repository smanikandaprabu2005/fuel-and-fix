import React from 'react';
import * as THREE from 'three';

// A procedural, futuristic Access Node
export default function AccessNode(props) {
  const nodeColor = '#333333'; // Dark base color
  const accentColor = '#00bfff'; // Blue for data flow

  return (
    <group {...props}>
      {/* Main Casing */}
      <mesh position={[0, 0, 0]} name="mainCasing">
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color={nodeColor} roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Internal Glowing Core */}
      <mesh position={[0, 0, 0]} name="core">
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0} />
      </mesh>

      {/* Data Flow Lines (simplified for now) */}
      <mesh position={[0, 0.8, 0]} name="dataLine1">
        <boxGeometry args={[1.8, 0.1, 0.1]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0} />
      </mesh>
      <mesh position={[0, -0.8, 0]} name="dataLine2">
        <boxGeometry args={[1.8, 0.1, 0.1]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0} />
      </mesh>
      <mesh position={[0.8, 0, 0]} name="dataLine3" rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1.8, 0.1, 0.1]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0} />
      </mesh>
    </group>
  );
}
