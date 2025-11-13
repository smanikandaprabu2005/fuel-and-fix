import React from 'react';
import * as THREE from 'three';

// A procedural, holographic human bust
export default function HolographicBust(props) {
  const bustColor = '#00bfff'; // Cool blue for holographic effect
  const wireframeColor = '#00ffff';

  return (
    <group {...props}>
      {/* Main Head/Torso Shape */}
      <mesh position={[0, 0.5, 0]} name="mainBust">
        <boxGeometry args={[1.5, 2, 1]} />
        <meshStandardMaterial 
          color={bustColor} 
          transparent 
          opacity={0.1} 
          wireframe={true} 
          wireframeLinewidth={2}
          emissive={wireframeColor}
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Base */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.2, 32]} />
        <meshStandardMaterial color="#333" roughness={0.5} metalness={0.8} />
      </mesh>

      {/* Glowing lines/data flow (simplified) */}
      <mesh position={[0, 0.5, 0]} name="dataFlow">
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial 
          color={wireframeColor} 
          emissive={wireframeColor} 
          emissiveIntensity={0} 
          transparent 
          opacity={0} 
          wireframe={true} 
          wireframeLinewidth={1}
        />
      </mesh>
    </group>
  );
}
