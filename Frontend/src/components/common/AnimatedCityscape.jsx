import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const AnimatedCityscape = () => {
  const groupRef = useRef();
  const lineRefs = useRef([]);
  const vehicleRefs = useRef([]);
  const particleRef = useRef();

  // Colors from the theme (assuming CSS variables are compiled or known)
  const neonGlowPrimary = new THREE.Color(0x00ffff); // Cyan
  const neonGlowSecondary = new THREE.Color(0xff00ff); // Magenta
  const darkBackground = new THREE.Color(0x0a0a0a); // Very dark grey

  // Road Plane
  const roadGeometry = useMemo(() => new THREE.PlaneGeometry(100, 200, 10, 20), []);
  const roadMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: darkBackground,
    side: THREE.DoubleSide,
    wireframe: false,
  }), [darkBackground]);

  // Grid Lines on the road
  const gridMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: neonGlowPrimary,
    transparent: true,
    opacity: 0.4,
    linewidth: 1,
  }), [neonGlowPrimary]);

  const gridGeometry = useMemo(() => {
    const points = [];
    const size = 100;
    const divisions = 20;
    const step = size / divisions;

    for (let i = -size / 2; i <= size / 2; i += step) {
      points.push(new THREE.Vector3(i, 0, -100));
      points.push(new THREE.Vector3(i, 0, 100));
      points.push(new THREE.Vector3(-size / 2, 0, i));
      points.push(new THREE.Vector3(size / 2, 0, i));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  // Moving Lines (Road Markings/Energy Flow)
  const numMovingLines = 30;
  const movingLineGeometries = useMemo(() => {
    const geometries = [];
    for (let i = 0; i < numMovingLines; i++) {
      const points = [];
      points.push(new THREE.Vector3(0, 0, 0));
      points.push(new THREE.Vector3(0, 0, -5));
      geometries.push(new THREE.BufferGeometry().setFromPoints(points));
    }
    return geometries;
  }, [numMovingLines]);

  const movingLineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    color: neonGlowSecondary,
    transparent: true,
    opacity: 0.8,
    linewidth: 2,
  }), [neonGlowSecondary]);

  // Simplified Vehicles
  const numVehicles = 10;
  const vehicleGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.2, 2), []);
  const vehicleMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: neonGlowPrimary,
    emissive: neonGlowPrimary,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.1,
  }), [neonGlowPrimary]);

  // Particle System
  const numParticles = 500;
  const particles = useMemo(() => {
    const p = new Float32Array(numParticles * 3);
    for (let i = 0; i < numParticles; i++) {
      p[i * 3] = (Math.random() - 0.5) * 100; // x
      p[i * 3 + 1] = (Math.random() - 0.5) * 10; // y
      p[i * 3 + 2] = Math.random() * 200 - 100; // z
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return geometry;
  }, [numParticles]);

  const particleMaterial = useMemo(() => new THREE.PointsMaterial({
    color: neonGlowPrimary,
    size: 0.2,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  }), [neonGlowPrimary]);


  useFrame((state, delta) => {
    // Animate road grid
    if (groupRef.current) {
      groupRef.current.position.z += 0.5 * delta * 60; // Speed of motion
      if (groupRef.current.position.z > 100) {
        groupRef.current.position.z = 0;
      }
    }

    // Animate moving lines
    lineRefs.current.forEach((line, i) => {
      if (line) {
        line.position.z += 1.5 * delta * 60; // Faster speed
        if (line.position.z > 50) {
          line.position.z = -150 - Math.random() * 50; // Reset further back
          line.position.x = (Math.random() - 0.5) * 40; // Random x position
        }
      }
    });

    // Animate vehicles
    vehicleRefs.current.forEach((vehicle, i) => {
      if (vehicle) {
        vehicle.position.z += 0.8 * delta * 60; // Vehicle speed
        if (vehicle.position.z > 50) {
          vehicle.position.z = -150 - Math.random() * 50; // Reset further back
          vehicle.position.x = (Math.random() - 0.5) * 30; // Random x position
        }
      }
    });

    // Animate particles
    if (particleRef.current) {
      particleRef.current.geometry.attributes.position.array.forEach((p, i) => {
        if (i % 3 === 2) { // Z-coordinate
          particleRef.current.geometry.attributes.position.array[i] += 1 * delta * 60;
          if (particleRef.current.geometry.attributes.position.array[i] > 100) {
            particleRef.current.geometry.attributes.position.array[i] = -100;
          }
        }
      });
      particleRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
      {/* Road Plane */}
      <mesh geometry={roadGeometry} material={roadMaterial} />

      {/* Grid Lines */}
      <lines geometry={gridGeometry} material={gridMaterial} />

      {/* Moving Lines */}
      {Array.from({ length: numMovingLines }).map((_, i) => (
        <line key={i} geometry={movingLineGeometries[i]} material={movingLineMaterial}
              position={[(Math.random() - 0.5) * 40, 0.01, Math.random() * -200]}
              ref={el => lineRefs.current[i] = el} />
      ))}

      {/* Simplified Vehicles */}
      {Array.from({ length: numVehicles }).map((_, i) => (
        <mesh key={i} geometry={vehicleGeometry} material={vehicleMaterial}
              position={[(Math.random() - 0.5) * 30, 0.1, Math.random() * -200]}
              ref={el => vehicleRefs.current[i] = el} />
      ))}

      {/* Particle System */}
      <points geometry={particles} material={particleMaterial} />
    </group>
  );
};

export default AnimatedCityscape;
