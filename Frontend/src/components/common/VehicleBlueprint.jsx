import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';

// Vehicle Blueprint Component - Holographic 3D vehicle representation
export default function VehicleBlueprint({ serviceType = null, serviceStatus = null, ...props }) {
  const vehicleGroupRef = useRef();
  const engineRef = useRef();
  const fuelTankRef = useRef();
  const batteryRef = useRef();
  const tiresRef = useRef([]);
  const blueprintLinesRef = useRef();

  // Animate vehicle rotation
  useFrame((state) => {
    if (vehicleGroupRef.current) {
      vehicleGroupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  // Animate component highlights based on service type
  useEffect(() => {
    if (!vehicleGroupRef.current) return;

    const highlightColor = serviceType === 'fuel' ? '#ffd700' : '#00bfff';
    const highlightIntensity = serviceStatus === 'active' ? 3 : (serviceStatus === 'completed' ? 1.5 : 0.5);

    if (serviceType === 'fuel' && fuelTankRef.current) {
      const material = fuelTankRef.current.material;
      gsap.to(material, {
        emissiveIntensity: highlightIntensity,
        duration: 0.5
      });
      gsap.to(material.emissive, {
        r: serviceStatus === 'active' ? 1 : 0.8,
        g: serviceStatus === 'active' ? 0.85 : 0.7,
        b: 0,
        duration: 0.5
      });
    } else if (serviceType === 'mechanical' && engineRef.current) {
      const material = engineRef.current.material;
      gsap.to(material, {
        emissiveIntensity: highlightIntensity,
        duration: 0.5
      });
      gsap.to(material.emissive, {
        r: 0,
        g: serviceStatus === 'active' ? 0.7 : 0.5,
        b: serviceStatus === 'active' ? 1 : 0.8,
        duration: 0.5
      });
    }

    // Reset other components
    if (serviceType !== 'fuel' && fuelTankRef.current) {
      const material = fuelTankRef.current.material;
      gsap.to(material, { emissiveIntensity: 0.3, duration: 0.5 });
    }
    if (serviceType !== 'mechanical' && engineRef.current) {
      const material = engineRef.current.material;
      gsap.to(material, { emissiveIntensity: 0.3, duration: 0.5 });
    }

  }, [serviceType, serviceStatus]);

  // Create blueprint wireframe lines
  const blueprintLines = useMemo(() => {
    const points = [];
    const lineColor = new THREE.Color('#00bfff');
    
    // Vehicle outline
    const outline = [
      new THREE.Vector3(-1.5, -0.5, 0),
      new THREE.Vector3(-1.5, 0.5, 0),
      new THREE.Vector3(1.5, 0.5, 0),
      new THREE.Vector3(1.5, -0.5, 0),
      new THREE.Vector3(-1.5, -0.5, 0),
    ];
    
    outline.forEach((point, i) => {
      if (i > 0) {
        points.push(outline[i - 1]);
        points.push(point);
      }
    });

    return points;
  }, []);

  return (
    <group ref={vehicleGroupRef} {...props}>
      {/* Blueprint Grid Background */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <planeGeometry args={[6, 4, 20, 15]} />
        <meshBasicMaterial
          color="#001122"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Vehicle Body - Simplified car shape */}
      <group position={[0, 0, 0]}>
        {/* Main body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2.5, 0.8, 1.2]} />
          <meshStandardMaterial
            color="#333"
            emissive="#001133"
            emissiveIntensity={0.2}
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>

        {/* Engine Component */}
        <mesh ref={engineRef} position={[-0.8, 0.2, 0]}>
          <boxGeometry args={[0.6, 0.4, 0.6]} />
          <meshStandardMaterial
            color="#444"
            emissive="#00bfff"
            emissiveIntensity={0.3}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Fuel Tank Component */}
        <mesh ref={fuelTankRef} position={[0.8, -0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.5, 16]} />
          <meshStandardMaterial
            color="#555"
            emissive="#ffd700"
            emissiveIntensity={0.3}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Battery */}
        <mesh ref={batteryRef} position={[0.5, 0.2, 0]}>
          <boxGeometry args={[0.3, 0.2, 0.4]} />
          <meshStandardMaterial
            color="#666"
            emissive="#00ff88"
            emissiveIntensity={0.2}
            transparent
            opacity={0.5}
          />
        </mesh>

        {/* Tires */}
        {[
          { pos: [-1, -0.6, 0.7] },
          { pos: [1, -0.6, 0.7] },
          { pos: [-1, -0.6, -0.7] },
          { pos: [1, -0.6, -0.7] }
        ].map((tire, i) => (
          <mesh key={i} ref={el => tiresRef.current[i] = el} position={tire.pos}>
            <cylinderGeometry args={[0.25, 0.25, 0.3, 16]} rotation={[0, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color="#222"
              emissive="#333"
              emissiveIntensity={0.1}
              transparent
              opacity={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* Blueprint Wireframe Lines */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={blueprintLines.length}
            array={new Float32Array(blueprintLines.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00bfff" transparent opacity={0.4} />
      </lineSegments>

      {/* Component Labels - Holographic text indicators */}
      {serviceType === 'fuel' && (
        <mesh position={[0.8, -0.8, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshStandardMaterial
            color="#ffd700"
            emissive="#ffd700"
            emissiveIntensity={2}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {serviceType === 'mechanical' && (
        <mesh position={[-0.8, 0.6, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshStandardMaterial
            color="#00bfff"
            emissive="#00bfff"
            emissiveIntensity={2}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Service Drone Animation - Mini drone that approaches the vehicle */}
      {serviceStatus === 'active' && (
        <mesh position={[3, 1, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={3}
          />
        </mesh>
      )}
    </group>
  );
}

