/*
This component loads and displays the 3D car model from a remote URL.
*/
import React, { useRef } from 'react';
import { useGLTF } from '@react-three/drei';

// URL for a publicly hosted Ferrari 3D model from the official Three.js examples
const modelUrl = 'https://threejs.org/examples/models/gltf/ferrari.glb';

export function CarModel(props) {
  const { scene } = useGLTF(modelUrl);

  // The 'scene' object contains the entire loaded model.
  // We can apply transformations to it directly.
  return (
    <primitive
      object={scene}
      scale={1.5} // Adjust scale to fit the scene
      position={[0, 0, 0]} // Adjust position
      {...props}
    />
  );
}

// Preload the model for a smoother experience
useGLTF.preload(modelUrl);