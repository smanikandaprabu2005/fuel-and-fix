import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';

// 3D City Grid with service request nodes
export default function DispatchGrid({ requests = [], onRequestSelect = null, providerType = 'mechanic' }) {
  const gridRef = useRef();
  const nodesRef = useRef([]);
  const routesRef = useRef([]);

  // Create city grid (wireframe buildings)
  const buildings = useMemo(() => {
    const buildingCount = 50;
    const buildings = [];
    for (let i = 0; i < buildingCount; i++) {
      const x = (Math.random() - 0.5) * 20;
      const z = (Math.random() - 0.5) * 20;
      const height = 0.5 + Math.random() * 2;
      const width = 0.3 + Math.random() * 0.5;
      buildings.push({ x, z, height, width });
    }
    return buildings;
  }, []);

  // Animate grid
  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.05;
    }
  });

  // Create request nodes
  const requestNodes = useMemo(() => {
    return requests.map((request, index) => {
      const angle = (index / requests.length) * Math.PI * 2;
      const radius = 3 + Math.random() * 5;
      return {
        id: request._id || index,
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          0.5,
          Math.sin(angle) * radius
        ),
        type: request.serviceType || 'mechanical',
        status: request.status || 'pending',
        request: request
      };
    });
  }, [requests]);

  return (
    <group ref={gridRef}>
      {/* Grid Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30, 30, 30]} />
        <meshBasicMaterial
          color="#001133"
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* City Buildings - Wireframe */}
      {buildings.map((building, i) => (
        <group key={i} position={[building.x, building.height / 2, building.z]}>
          <mesh>
            <boxGeometry args={[building.width, building.height, building.width]} />
            <meshBasicMaterial
              color="#003366"
              wireframe
              transparent
              opacity={0.2}
            />
          </mesh>
        </group>
      ))}

      {/* Service Request Nodes */}
      {requestNodes.map((node, i) => {
        const isFuel = node.type === 'fuel';
        const color = isFuel ? '#ffd700' : '#00bfff';
        const iconRotation = node.type === 'fuel' ? 0 : Math.PI / 4;

        return (
          <group key={node.id} position={node.position}>
            {/* Node Base */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={node.status === 'pending' ? 2 : 1}
                transparent
                opacity={0.8}
              />
            </mesh>

            {/* Node Icon */}
            <mesh position={[0, 0.3, 0]} rotation={[0, iconRotation, 0]}>
              {isFuel ? (
                <boxGeometry args={[0.2, 0.3, 0.15]} />
              ) : (
                <boxGeometry args={[0.2, 0.2, 0.2]} />
              )}
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={3}
              />
            </mesh>

            {/* Pulsing Ring */}
            <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.4, 0.5, 32]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* Connection Line to Center */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    node.position.x, node.position.y, node.position.z,
                    0, 0, 0
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={color} transparent opacity={0.2} />
            </line>
          </group>
        );
      })}

      {/* Optimal Route Visualization */}
      {requestNodes.length > 0 && requestNodes[0] && (
        <group>
          {requestNodes.slice(0, -1).map((node, i) => {
            const nextNode = requestNodes[i + 1];
            if (!nextNode) return null;
            return (
              <line key={`route-${i}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={new Float32Array([
                      node.position.x, node.position.y + 0.5, node.position.z,
                      nextNode.position.x, nextNode.position.y + 0.5, nextNode.position.z
                    ])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#00ff88" transparent opacity={0.5} linewidth={2} />
              </line>
            );
          })}
        </group>
      )}

      {/* Center Point - Provider Location */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={2}
        />
      </mesh>
    </group>
  );
}

