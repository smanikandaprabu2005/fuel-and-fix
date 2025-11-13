import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// A procedural, data-stream key made of particles
export default function IgnitionKey(props) {
  const pointsRef = useRef();
  const particleCount = 2000;
  const keyColor = new THREE.Color('#00bfff'); // Cool blue for holographic effect

  const positions = useMemo(() => {
    const positions = [];
    const tempVector = new THREE.Vector3();

    // Key Head (Ring)
    for (let i = 0; i < particleCount * 0.3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.2;
      tempVector.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 0.1);
      positions.push(tempVector.x, tempVector.y, tempVector.z);
    }

    // Key Shaft (Box)
    for (let i = 0; i < particleCount * 0.5; i++) {
      tempVector.set(
        (Math.random() - 0.5) * 0.3,
        -2 + Math.random() * 2.5,
        (Math.random() - 0.5) * 0.1
      );
      positions.push(tempVector.x, tempVector.y, tempVector.z);
    }

    // Key Teeth (Small boxes)
    for (let i = 0; i < particleCount * 0.2; i++) {
      tempVector.set(
        0.2 + (Math.random() - 0.5) * 0.1,
        -2.8 + Math.random() * 0.4,
        (Math.random() - 0.5) * 0.1
      );
      positions.push(tempVector.x, tempVector.y, tempVector.z);
    }

    return new Float32Array(positions);
  }, [particleCount]);

  useFrame((state) => {
    if (pointsRef.current) {
      // Subtle particle movement/flow
      const positions = pointsRef.current.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.005; // Move particles down
        if (positions[i + 1] < -3) positions[i + 1] = 1; // Reset if too low
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.rotation.y += 0.001; // Subtle overall rotation
    }
  });

  return (
    <points ref={pointsRef} {...props} name="dataStreamKey">
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial 
        size={0.08} 
        color={keyColor} 
        sizeAttenuation 
        transparent 
        opacity={0.8} 
        blending={THREE.AdditiveBlending} 
        emissive={keyColor}
        emissiveIntensity={0.5}
      />
    </points>
  );
}
