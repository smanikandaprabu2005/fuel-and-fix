import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import MechanicalHeart from './MechanicalHeart';

// System Core - Mechanical Heart driven by live data
export default function SystemCore({ 
  activeRequests = 0,
  fuelRequests = 0,
  fixRequests = 0,
  totalUsers = 0,
  systemHealth = 100
}) {
  const coreRef = useRef();
  const heartRef = useRef();
  const dataStreamRefs = useRef([]);

  // Calculate fuel to fix ratio for hover state
  const fuelFixRatio = React.useMemo(() => {
    if (fuelRequests === 0 && fixRequests === 0) return null;
    const total = fuelRequests + fixRequests;
    return fuelRequests / total;
  }, [fuelRequests, fixRequests]);

  // Determine hover state based on ratio
  const hoverState = React.useMemo(() => {
    if (!fuelFixRatio) return null;
    // If more fuel requests, show FUEL, else FIX
    return fuelFixRatio > 0.5 ? 'FUEL' : 'FIX';
  }, [fuelFixRatio]);

  // Animate core based on system metrics
  useFrame((state) => {
    if (coreRef.current && heartRef.current) {
      // Pulse speed based on active requests
      const pulseSpeed = Math.min(activeRequests / 10, 1) * 2 + 1;
      const pulse = Math.sin(state.clock.getElapsedTime() * pulseSpeed) * 0.1 + 1;
      coreRef.current.scale.setScalar(pulse);
    }
  });

  // Animate data streams based on metrics
  useEffect(() => {
    if (!dataStreamRefs.current.length) return;

    const intensity = Math.min(activeRequests / 20, 1) * 3;
    
    dataStreamRefs.current.forEach((streamRef, i) => {
      if (streamRef.current && streamRef.current.material) {
        gsap.to(streamRef.current.material, {
          emissiveIntensity: intensity,
          duration: 1,
          ease: 'power2.out'
        });
      }
    });
  }, [activeRequests]);

  // Data stream particles
  const dataStreams = React.useMemo(() => {
    const streams = Array.from({ length: 8 }).map((_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 4;
      return {
        angle,
        radius,
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius * 0.5,
          Math.sin(angle) * radius
        )
      };
    });
    // Initialize refs array
    dataStreamRefs.current = streams.map(() => React.createRef());
    return streams;
  }, []);

  return (
    <group ref={coreRef}>
      {/* Central Mechanical Heart */}
      <group ref={heartRef} position={[0, 0, 0]}>
        <MechanicalHeart hovered={hoverState} />
      </group>

      {/* Data Streams - Visualize system activity */}
      {dataStreams.map((stream, i) => {
        const streamRef = dataStreamRefs.current[i];

        return (
          <group key={i} position={stream.position}>
            {/* Data flow line */}
            <mesh ref={streamRef}>
              <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
              <meshStandardMaterial
                color="#00bfff"
                emissive="#00bfff"
                emissiveIntensity={1}
                transparent
                opacity={0.6}
              />
            </mesh>

            {/* Data particles flowing */}
            <mesh position={[0, 1, 0]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                color="#00ffff"
                emissive="#00ffff"
                emissiveIntensity={3}
              />
            </mesh>
          </group>
        );
      })}

      {/* System Health Indicator Rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 4, 64]} />
        <meshBasicMaterial
          color={systemHealth > 80 ? '#00ff88' : systemHealth > 50 ? '#ffaa00' : '#ff4444'}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Active Requests Counter - Holographic Display */}
      <mesh position={[0, -3, 0]}>
        <planeGeometry args={[2, 0.5]} />
        <meshStandardMaterial
          color="#00bfff"
          emissive="#00bfff"
          emissiveIntensity={1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Metrics Display - Fuel/Fix Ratio Visualization */}
      {fuelFixRatio !== null && (
        <group position={[0, 3, 0]}>
          {/* Fuel indicator */}
          <mesh position={[-1, 0, 0]}>
            <boxGeometry args={[0.2, fuelFixRatio * 2, 0.2]} />
            <meshStandardMaterial
              color="#ffd700"
              emissive="#ffd700"
              emissiveIntensity={2}
            />
          </mesh>
          {/* Fix indicator */}
          <mesh position={[1, 0, 0]}>
            <boxGeometry args={[0.2, (1 - fuelFixRatio) * 2, 0.2]} />
            <meshStandardMaterial
              color="#00bfff"
              emissive="#00bfff"
              emissiveIntensity={2}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

