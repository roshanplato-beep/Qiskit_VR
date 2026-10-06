// NoduleVoxels.jsx — SHARED component (website + VR).
// Renders a NoduleMNIST3D volume (Uint8 28x28x28) as a single opaque
// InstancedMesh, drawing ONLY voxels at/above a density threshold.
// SPEC performance budget: never draw all 21,952 voxels; one instanced mesh,
// opaque materials, low poly, few draw calls (Quest 2, 72 fps).
//
// Voxel indexing: the .bin is row-major with x fastest, then y, then z:
//   value(x,y,z) = data[(z * dim + y) * dim + x]
// (If the nodule looks axis-swapped on a headset, flip here — it is the one
// place that encodes orientation.)

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NODULE, VOXEL_SIZE } from '../vr/vrConfig.js'

const _m = new THREE.Matrix4()
const _c = new THREE.Color()

export default function NoduleVoxels({
  volume, // Uint8Array length dim^3, or null
  threshold = NODULE.densityThreshold,
  color = '#cbb7a6', // muted tissue tone
  dim = NODULE.dim,
}) {
  const ref = useRef()

  // Collect the positions (and densities) of voxels above threshold once.
  const { positions, densities, count } = useMemo(() => {
    const pos = []
    const den = []
    if (volume && volume.length >= dim * dim * dim) {
      const half = dim / 2
      for (let z = 0; z < dim; z++) {
        for (let y = 0; y < dim; y++) {
          const base = (z * dim + y) * dim
          for (let x = 0; x < dim; x++) {
            const v = volume[base + x]
            if (v >= threshold) {
              pos.push(
                (x - half + 0.5) * VOXEL_SIZE,
                (y - half + 0.5) * VOXEL_SIZE,
                (z - half + 0.5) * VOXEL_SIZE
              )
              den.push(v)
            }
          }
        }
      }
    }
    return { positions: pos, densities: den, count: den.length }
  }, [volume, threshold, dim])

  // Write per-instance matrices + colours.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || count === 0) return
    for (let i = 0; i < count; i++) {
      _m.makeTranslation(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2])
      mesh.setMatrixAt(i, _m)
      // Denser voxels read a touch brighter — gives the mass visible depth.
      const t = Math.min(1, Math.max(0, (densities[i] - threshold) / (255 - threshold)))
      _c.set(color).multiplyScalar(0.7 + 0.3 * t)
      mesh.setColorAt(i, _c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = count
  }, [positions, densities, count, color, threshold])

  if (count === 0) return null

  return (
    <instancedMesh
      ref={ref}
      // key forces a fresh buffer when the voxel count changes (new patient).
      key={count}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
      <meshStandardMaterial roughness={0.85} metalness={0.0} vertexColors={false} />
    </instancedMesh>
  )
}
