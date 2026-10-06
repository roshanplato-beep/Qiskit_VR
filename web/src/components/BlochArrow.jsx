// BlochArrow.jsx — SHARED component (website + VR).
// Draws one qubit's Bloch vector as an opaque shaft + cone head. The length
// is the vector's magnitude (0..1, straight from the saved `bloch` arrays)
// times ARROW.maxLen. A faint ghost variant shows the ideal arrow so the
// shrink under noise is visible (SPEC station 2). Low-poly for Quest 2.

import { useMemo } from 'react'
import * as THREE from 'three'
import { ARROW, COLORS } from '../vr/vrConfig.js'

const UP = new THREE.Vector3(0, 1, 0)

export default function BlochArrow({
  vector, // [x, y, z] from saved JSON (Bloch frame)
  color = COLORS.ideal,
  ghost = false,
  opacity = 1,
}) {
  const { quaternion, len } = useMemo(() => {
    const v = new THREE.Vector3(vector?.[0] ?? 0, vector?.[1] ?? 0, vector?.[2] ?? 0)
    const mag = v.length()
    const q = new THREE.Quaternion()
    if (mag > 1e-6) q.setFromUnitVectors(UP, v.clone().normalize())
    return { quaternion: q, len: mag * ARROW.maxLen }
  }, [vector])

  if (len < 1e-4) return null

  const shaftLen = Math.max(0.001, len - ARROW.headLen)
  const o = ghost ? ARROW.ghostOpacity : opacity
  const transparent = o < 1

  return (
    <group quaternion={quaternion}>
      {/* shaft: cylinder centred, so lift by half its length */}
      <mesh position={[0, shaftLen / 2, 0]}>
        <cylinderGeometry args={[ARROW.shaftRadius, ARROW.shaftRadius, shaftLen, 8]} />
        <meshStandardMaterial
          color={color}
          transparent={transparent}
          opacity={o}
          roughness={0.5}
          emissive={color}
          emissiveIntensity={ghost ? 0.05 : 0.25}
        />
      </mesh>
      {/* head cone at the tip */}
      <mesh position={[0, shaftLen + ARROW.headLen / 2, 0]}>
        <coneGeometry args={[ARROW.headRadius, ARROW.headLen, 10]} />
        <meshStandardMaterial
          color={color}
          transparent={transparent}
          opacity={o}
          roughness={0.5}
          emissive={color}
          emissiveIntensity={ghost ? 0.05 : 0.25}
        />
      </mesh>
    </group>
  )
}
