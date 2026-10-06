// Lung.jsx — decorative, procedural lung for orientation (no asset, no
// license). Right lung = 3 lobes, left lung = 2 lobes + cardiac notch, plus
// trachea and main bronchi. Translucent, unlit-ish, low poly. The nodule glows
// at a plausible spot (right lower lobe). This is anatomy for context only;
// no numbers are drawn from it.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// [x, y, z, sx, sy, sz] ellipsoid lobes in a ~1 m tall frame (patient facing +z)
const LOBES = [
  [-0.27, 0.12, 0, 0.22, 0.4, 0.2], // right (viewer's left) upper
  [-0.3, -0.12, 0.0, 0.2, 0.2, 0.19], // right middle
  [-0.3, -0.25, -0.05, 0.22, 0.3, 0.22], // right lower
  [0.27, 0.1, 0, 0.2, 0.42, 0.2], // left upper
  [0.27, -0.25, -0.04, 0.2, 0.3, 0.22], // left lower
]
export const NODULE_AT = [-0.3, -0.2, 0.02] // inside the right lower lobe

function Tube({ from, to, r }) {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const len = Math.hypot(dx, dy)
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0]} rotation={[0, 0, Math.atan2(dx, dy) * -1]}>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshBasicMaterial color="#d9c7bd" />
    </mesh>
  )
}

export default function Lung(props) {
  const glow = useRef()
  useFrame(({ clock }) => {
    if (glow.current) glow.current.scale.setScalar(1 + 0.15 * Math.sin(clock.elapsedTime * 5.5)) // ~0.9 Hz, below 3 Hz
  })
  return (
    <group {...props}>
      {LOBES.map((l, i) => (
        <mesh key={i} position={[l[0], l[1], l[2]]} scale={[l[3], l[4], l[5]]}>
          <sphereGeometry args={[1, 18, 14]} />
          <meshStandardMaterial color="#e58f9a" roughness={0.9} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
      <Tube from={[0, 0.58, 0]} to={[0, 0.34, 0]} r={0.025} />
      <Tube from={[0, 0.34, 0]} to={[-0.17, 0.2, 0]} r={0.017} />
      <Tube from={[0, 0.34, 0]} to={[0.17, 0.2, 0]} r={0.017} />
      {/* the nodule: small bright core + soft halo */}
      <group position={NODULE_AT} renderOrder={2}>
        <mesh>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshBasicMaterial color="#fff2c4" />
        </mesh>
        <mesh ref={glow} renderOrder={3}>
          <sphereGeometry args={[0.105, 16, 12]} />
          <meshBasicMaterial color="#ff9a1f" transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  )
}
