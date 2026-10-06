// Environment.jsx — the reading-room shell and furniture. Realism comes from
// materials + layout (matte walls, carpet floor, ceiling light panels, desk,
// chair, monitors with stands), not effects: no shadows, no post-processing,
// all boxes/planes, a handful of lights.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS, READING, DESK } from './vrConfig.js'

const R = READING.room
const WALL = '#2a2f39'
const TRIM = '#161a20'

function Box({ p, s, color, rough = 0.9, emissive, ei = 0 }) {
  return (
    <mesh position={p}>
      <boxGeometry args={s} />
      <meshStandardMaterial color={color} roughness={rough} emissive={emissive ?? '#000000'} emissiveIntensity={ei} />
    </mesh>
  )
}

export function Shell({ tint }) {
  const red = useRef()
  useFrame((_, dt) => {
    if (red.current) red.current.intensity += (tint * 1.2 - red.current.intensity) * Math.min(1, dt * 3)
  })
  const back = R.centerZ - R.depth / 2
  return (
    <group>
      {/* floor (carpet) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, R.centerZ]}>
        <planeGeometry args={[R.width, R.depth]} />
        <meshStandardMaterial color="#1b1e24" roughness={1} />
      </mesh>
      {/* walls + ceiling */}
      <mesh position={[0, R.height / 2, R.centerZ]}>
        <boxGeometry args={[R.width, R.height, R.depth]} />
        <meshStandardMaterial color={WALL} roughness={1} side={THREE.BackSide} />
      </mesh>
      {/* baseboard glow strip along the back wall */}
      <Box p={[0, 0.06, back + 0.02]} s={[R.width, 0.1, 0.04]} color={TRIM} />
      {/* ceiling light panels (emissive, not real lights) */}
      {[-2.2, 0, 2.2].map((x) => (
        <Box key={x} p={[x, R.height - 0.02, -1.4]} s={[1.4, 0.04, 0.5]} color="#cfd6e4" emissive="#aab6d0" ei={0.9} />
      ))}
      {/* door on the right wall + a shelf on the left wall */}
      <Box p={[R.width / 2 - 0.03, 1.05, 0.9]} s={[0.05, 2.1, 0.95]} color="#20252d" />
      <Box p={[-R.width / 2 + 0.2, 0.9, -1.2]} s={[0.4, 1.8, 1.6]} color="#232831" />
      <Box p={[-R.width / 2 + 0.2, 1.25, -1.2]} s={[0.42, 0.04, 1.62]} color="#2f3541" />
      <pointLight ref={red} position={[0, 2.8, -2.8]} intensity={0} color="#e2504a" distance={9} />
    </group>
  )
}

// Workstation desk with drawer pedestal, keyboard, and an office chair beside it.
export function Desk() {
  const { z, width, depth, top } = DESK
  return (
    <group position={[0, 0, z]}>
      <Box p={[0, top - 0.02, 0]} s={[width, 0.04, depth]} color="#4a4f59" rough={0.55} />
      <Box p={[-width / 2 + 0.03, top / 2 - 0.02, 0]} s={[0.05, top - 0.04, depth - 0.1]} color="#2e323a" />
      <Box p={[width / 2 - 0.35, top / 2 - 0.02, 0]} s={[0.6, top - 0.04, depth - 0.1]} color="#2e323a" />
      <Box p={[width / 2 - 0.35, top / 2 + 0.1, depth / 2 - 0.04]} s={[0.5, 0.18, 0.02]} color="#3a3f49" />
      {/* keyboard + mouse */}
      <Box p={[0.0, top + 0.012, 0.18]} s={[0.46, 0.02, 0.15]} color="#14171c" />
      <Box p={[0.4, top + 0.01, 0.2]} s={[0.07, 0.02, 0.1]} color="#14171c" />
      {/* chair (to one side, never in the spawn path) */}
      <group position={[1.7, 0, 0.75]} rotation={[0, -0.5, 0]}>
        <Box p={[0, 0.48, 0]} s={[0.5, 0.08, 0.5]} color="#1d2128" />
        <Box p={[0, 0.82, 0.22]} s={[0.46, 0.55, 0.07]} color="#1d2128" />
        <Box p={[0, 0.22, 0]} s={[0.06, 0.4, 0.06]} color="#0f1115" />
        <Box p={[0, 0.03, 0]} s={[0.5, 0.04, 0.5]} color="#0f1115" />
      </group>
    </group>
  )
}

// A desk monitor: bezel, screen backing, stand. Children draw on the screen
// at local z=0.03 (face toward +z).
export function Monitor({ position, yaw = 0, width = 1.0, height = 0.62, children }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <Box p={[0, 0, 0]} s={[width + 0.06, height + 0.06, 0.04]} color="#0d0f13" rough={0.4} />
      <mesh position={[0, 0, 0.021]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#0b121c" />
      </mesh>
      <Box p={[0, -height / 2 - 0.14, -0.03]} s={[0.06, 0.26, 0.04]} color="#15181d" />
      <Box p={[0, -height / 2 - 0.27, 0.0]} s={[0.4, 0.02, 0.22]} color="#15181d" />
      <group position={[0, 0, 0.03]}>{children}</group>
    </group>
  )
}

// Wall-mounted screen (no stand).
export function WallScreen({ position, width, height, children }) {
  return (
    <group position={position}>
      <Box p={[0, 0, -0.01]} s={[width + 0.06, height + 0.06, 0.04]} color="#0d0f13" rough={0.4} />
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#0b121c" />
      </mesh>
      <group position={[0, 0, 0.02]}>{children}</group>
    </group>
  )
}

export { COLORS }
