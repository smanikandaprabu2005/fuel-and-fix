import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { gsap } from 'gsap';

// Enhanced Ignition Key with interactive light flow based on input
export default function EnhancedIgnitionKey({ inputValue = '', isActive = false, onSuccess = false }) {
  const keyGroupRef = useRef();
  const pointsRef = useRef();
  const coreRef = useRef();
  const channelRefs = useRef([]);
  const particleCount = 1500;
  const keyColor = new THREE.Color('#00bfff');
  const activeColor = new THREE.Color('#00ffff');
  const successColor = new THREE.Color('#00ff88');

  // Create key structure with light channels
  const keyGeometry = useMemo(() => {
    const positions = [];
    const tempVector = new THREE.Vector3();

    // Key Head (Ring) - More defined
    for (let i = 0; i < particleCount * 0.3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.2;
      tempVector.set(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * 0.1);
      positions.push(tempVector.x, tempVector.y, tempVector.z);
    }

    // Key Shaft (Box) - Main body
    for (let i = 0; i < particleCount * 0.5; i++) {
      tempVector.set(
        (Math.random() - 0.5) * 0.3,
        -2 + Math.random() * 2.5,
        (Math.random() - 0.5) * 0.1
      );
      positions.push(tempVector.x, tempVector.y, tempVector.z);
    }

    // Key Teeth (Patterned)
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

  // Create light channels (glowing lines along the key)
  const channels = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      position: new THREE.Vector3(
        0,
        -2 + i * 0.5,
        0
      ),
      progress: 0,
      active: false
    }));
  }, []);

  // Animate based on input
  useEffect(() => {
    if (!keyGroupRef.current || !coreRef.current) return;

    const inputLength = inputValue.length;
    const maxInput = 10; // Estimated max input length
    const completion = Math.min(inputLength / maxInput, 1);

    // Animate core based on input
    if (coreRef.current.material) {
      const targetIntensity = completion * 3 + (isActive ? 1 : 0);
      gsap.to(coreRef.current.material, {
        emissiveIntensity: targetIntensity,
        duration: 0.3
      });

      // Change color based on state
      if (onSuccess) {
        gsap.to(coreRef.current.material.emissive, {
          r: successColor.r,
          g: successColor.g,
          b: successColor.b,
          duration: 0.5
        });
      } else if (isActive) {
        gsap.to(coreRef.current.material.emissive, {
          r: activeColor.r,
          g: activeColor.g,
          b: activeColor.b,
          duration: 0.3
        });
      } else {
        gsap.to(coreRef.current.material.emissive, {
          r: keyColor.r,
          g: keyColor.g,
          b: keyColor.b,
          duration: 0.3
        });
      }
    }

    // Animate channels based on input progress
    channels.forEach((channel, i) => {
      const shouldBeActive = completion > (i / channels.length);
      channel.active = shouldBeActive;
    });

  }, [inputValue, isActive, onSuccess, keyColor, activeColor, successColor, channels]);

  useFrame((state) => {
    if (pointsRef.current) {
      // Particle flow animation
      const positions = pointsRef.current.geometry.attributes.position.array;
      const flowSpeed = isActive ? 0.01 : 0.005;
      
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= flowSpeed; // Move particles down
        if (positions[i + 1] < -3) positions[i + 1] = 1; // Reset if too low
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      
      // Gentle rotation
      pointsRef.current.rotation.y += isActive ? 0.002 : 0.001;
    }

    // Animate key group
    if (keyGroupRef.current) {
      keyGroupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
      keyGroupRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 0.8) * 0.1;
    }

    // Animate light channels
    channels.forEach((channel, i) => {
      if (channel.active) {
        channel.progress += 0.02;
        if (channel.progress > 1) channel.progress = 0;
      }
    });
  });

  const currentColor = onSuccess ? successColor : (isActive ? activeColor : keyColor);

  const positions = keyGeometry;

  return (
    <group ref={keyGroupRef}>
      {/* Main Key Particle Structure */}
      <points ref={pointsRef} name="keyParticles">
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          color={currentColor}
          sizeAttenuation
          transparent
          opacity={isActive ? 0.9 : 0.7}
          blending={THREE.AdditiveBlending}
          emissive={currentColor}
          emissiveIntensity={isActive ? 1 : 0.5}
        />
      </points>

      {/* Central Core */}
      <mesh ref={coreRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={currentColor}
          emissive={currentColor}
          emissiveIntensity={1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Light Channels */}
      {channels.map((channel, i) => (
        <mesh key={i} position={channel.position}>
          <boxGeometry args={[0.05, 0.3, 0.05]} />
          <meshStandardMaterial
            color={channel.active ? activeColor : keyColor}
            emissive={channel.active ? activeColor : keyColor}
            emissiveIntensity={channel.active ? 2 : 0.3}
            transparent
            opacity={channel.active ? 0.8 : 0.3}
          />
        </mesh>
      ))}

      {/* Energy Flow Lines */}
      {isActive && channels.filter(c => c.active).map((channel, i) => {
        const flowY = channel.position.y + Math.sin(channel.progress * Math.PI * 2) * 0.2;
        return (
          <mesh key={`flow-${i}`} position={[0, flowY, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color={activeColor}
              emissive={activeColor}
              emissiveIntensity={3}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}

      {/* Success Pulse Effect */}
      {onSuccess && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[0.5, 0.7, 32]} />
          <meshStandardMaterial
            color={successColor}
            emissive={successColor}
            emissiveIntensity={2}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

