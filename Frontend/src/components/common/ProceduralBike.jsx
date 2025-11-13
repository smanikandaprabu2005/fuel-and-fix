import React from 'react';
import * as THREE from 'three';

// A simple, stylized sports bike made from basic shapes
export default function ProceduralBike(props) {
  const bikeColor = '#333333'; // Dark grey for the body
  const accentColor = '#ff4136'; // Red for accents

  return (
    <group {...props}>
      {/* Frame */}
      <mesh castShadow position={[0, 0.5, 0]} name="mainFrame">
        <boxGeometry args={[1.5, 0.2, 0.3]} />
        <meshStandardMaterial color={bikeColor} roughness={0.3} metalness={0.2} emissive="#000000" />
      </mesh>
      <mesh castShadow position={[0.3, 0.8, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.8, 0.15, 0.2]} />
        <meshStandardMaterial color={bikeColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Seat */}
      <mesh castShadow position={[-0.3, 0.7, 0]}>
        <boxGeometry args={[0.6, 0.15, 0.25]} />
        <meshStandardMaterial color={accentColor} roughness={0.5} metalness={0.1} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[0.9, 0.3, 0]} />
      <Wheel position={[-0.9, 0.3, 0]} />

      {/* Handlebars */}
      <mesh castShadow position={[0.55, 0.9, 0]}>
        <boxGeometry args={[0.1, 0.3, 0.1]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh castShadow position={[0.55, 1.05, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.6]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

function Wheel(props) {
  return (
    <mesh {...props} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.35, 0.35, 0.1, 32]} />
      <meshStandardMaterial color="#1c1c1c" roughness={0.8} metalness={0} />
    </mesh>
  );
}
