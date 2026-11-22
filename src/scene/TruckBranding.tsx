"use client";
import { Suspense } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

function prepareLogo(texture: THREE.Texture) {
  if (texture.colorSpace === THREE.SRGBColorSpace && texture.anisotropy === 8) return;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
}

// The supplied brand asset is 900 × 145. Both sides read correctly from outside the trailer.
function Decals({ clippingPlanes }: { clippingPlanes?: THREE.Plane[] }) {
  const logo = useTexture("/brand/logo-navy.png", prepareLogo);
  return <group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * 1.294, 2.3, -1.8]} rotation={[0, side * Math.PI / 2, 0]}>
      <planeGeometry args={[8.4, 8.4 * 145 / 900]} />
      <meshStandardMaterial map={logo} transparent alphaTest={0.04} depthWrite={false} roughness={0.8} clippingPlanes={clippingPlanes} />
    </mesh>)}
    <mesh position={[0, 2.65, -8.646]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1.95, 1.95 * 145 / 900]} />
      <meshStandardMaterial map={logo} transparent alphaTest={0.04} depthWrite={false} roughness={0.8} clippingPlanes={clippingPlanes} />
    </mesh>
  </group>;
}

/** Only the decal suspends during image loading; vehicles and their motion remain mounted. */
export function TruckBranding(props: { clippingPlanes?: THREE.Plane[] }) {
  return <Suspense fallback={null}><Decals {...props} /></Suspense>;
}
