import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// A sleek, futuristic car aligned with the Cyber-Mechanic theme.
export default function ProceduralCar(props) {
  const carColor = '#222222'; // Dark metallic
  const primaryAccent = '#FFC107'; // Amber glow

  const headlightMaterial = useRef();
  const energyLineMaterial = useRef();

  // Pulsating glow effect
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = (Math.sin(time * 3) + 1) / 2; // oscillates between 0 and 1
    if (headlightMaterial.current) {
      headlightMaterial.current.emissiveIntensity = pulse * 1.5;
    }
    if (energyLineMaterial.current) {
      energyLineMaterial.current.emissiveIntensity = pulse * 2;
    }
  });

  return (
    <group {...props}>
      {/* Main Body */}
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[2.8, 0.4, 1.2]} />
        <meshStandardMaterial color={carColor} roughness={0.1} metalness={0.9} />
      </mesh>
      
      {/* Angled front */}
      <mesh castShadow position={[1.4, 0.15, 0]} rotation={[0, 0, Math.PI / 9]}>
        <boxGeometry args={[0.2, 0.3, 1.2]} />
        <meshStandardMaterial color={carColor} roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Cabin */}
      <mesh castShadow position={[-0.25, 0.55, 0]} rotation={[0, 0, -Math.PI / 16]}>
        <boxGeometry args={[1.3, 0.3, 1]} />
        <meshStandardMaterial color="#111111" roughness={0.05} metalness={0.2} transparent opacity={0.8} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[-1.1, 0.1, 0.6]} />
      <Wheel position={[1.15, 0.1, 0.6]} />
      <Wheel position={[-1.1, 0.1, -0.6]} />
      <Wheel position={[1.15, 0.1, -0.6]} />

      {/* Spoiler */}
      <mesh castShadow position={[-1.4, 0.65, 0]}>
        <boxGeometry args={[0.4, 0.04, 1.3]} />
        <meshStandardMaterial color={carColor} roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh castShadow position={[-1.3, 0.5, 0]}>
        <boxGeometry args={[0.05, 0.2, 0.2]} />
        <meshStandardMaterial color={carColor} roughness={0.1} metalness={0.9} />
      </mesh>
      
      {/* Headlights */}
      <mesh position={[1.45, 0.25, 0.45]}>
        <boxGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial ref={headlightMaterial} color="#ffffff" emissive="#ffffff" emissiveIntensity={0} />
      </mesh>
      <mesh position={[1.45, 0.25, -0.45]}>
        <boxGeometry args={[0.1, 0.1, 0.2]} />
        <meshStandardMaterial ref={headlightMaterial} color="#ffffff" emissive="#ffffff" emissiveIntensity={0} />
      </mesh>

      {/* Taillights */}
      <mesh position={[-1.5, 0.3, 0.4]}>
        <boxGeometry args={[0.05, 0.1, 0.7]} />
        <meshStandardMaterial color={primaryAccent} emissive={primaryAccent} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>

      {/* --- Cyber-Mechanic Energy Lines --- */}
      <mesh position={[0.5, 0.42, 0]}>
        <boxGeometry args={[1.5, 0.01, 0.01]} />
        <meshStandardMaterial ref={energyLineMaterial} color={primaryAccent} emissive={primaryAccent} emissiveIntensity={0} toneMapped={false} />
      </mesh>
       <mesh position={[0, 0.4, 0.61]}>
        <boxGeometry args={[2.5, 0.02, 0.02]} />
         <meshStandardMaterial color={primaryAccent} emissive={primaryAccent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.4, -0.61]}>
        <boxGeometry args={[2.5, 0.02, 0.02]} />
         <meshStandardMaterial color={primaryAccent} emissive={primaryAccent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Wheel(props) {
  return (
    <mesh {...props} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 0.15, 32]} />
      <meshStandardMaterial color="#1c1c1c" roughness={0.8} metalness={0.1} />
    </mesh>
  );
}
