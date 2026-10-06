// CTVolume.jsx — the nodule as a proper grayscale CT volume with a movable
// slice plane. Real 28^3 densities (Uint8) are windowed to grayscale. Drawn as
// ONE opaque instanced mesh of surface-shell voxels, sorted by slice so the
// plane is just `mesh.count = prefix`. The cut face is a 28x28 DataTexture of
// the real slice (also shown on the 2D monitor), so no density is invented.

import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NODULE, VOXEL_SIZE, CT } from './vrConfig.js'

const D = NODULE.dim
const _m = new THREE.Matrix4()
const _c = new THREE.Color()

export const windowed = (v) => Math.min(1, Math.max(0, (v - CT.windowLo) / (CT.windowHi - CT.windowLo)))

// Build shell voxels (>= threshold with at least one empty neighbour), z-ascending.
function buildShell(volume) {
  if (!volume || volume.length < D * D * D) return { pos: [], gray: [], prefix: new Array(D).fill(0), count: 0 }
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= D || y >= D || z >= D ? 0 : volume[(z * D + y) * D + x])
  let thr = CT.threshold
  let out
  for (;;) {
    const pos = []
    const gray = []
    const prefix = new Array(D).fill(0)
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < D; y++)
        for (let x = 0; x < D; x++) {
          const v = at(x, y, z)
          if (v < thr) continue
          const inner =
            at(x - 1, y, z) >= thr && at(x + 1, y, z) >= thr && at(x, y - 1, z) >= thr &&
            at(x, y + 1, z) >= thr && at(x, y, z - 1) >= thr && at(x, y, z + 1) >= thr
          if (inner) continue
          pos.push((x - D / 2 + 0.5) * VOXEL_SIZE, (y - D / 2 + 0.5) * VOXEL_SIZE, (z - D / 2 + 0.5) * VOXEL_SIZE)
          gray.push(windowed(v))
        }
      prefix[z] = gray.length
    }
    out = { pos, gray, prefix, count: gray.length }
    if (out.count <= CT.maxShell || thr >= 250) return out
    thr += 10
  }
}

// Fill a 28x28 RGBA buffer with slice z (flip y so "up" reads upright).
export function fillSlice(buf, volume, z) {
  for (let y = 0; y < D; y++)
    for (let x = 0; x < D; x++) {
      const g = Math.round(255 * windowed(volume ? volume[(z * D + y) * D + x] : 0))
      const o = ((D - 1 - y) * D + x) * 4
      buf[o] = buf[o + 1] = buf[o + 2] = g
      buf[o + 3] = 255
    }
}

export function useSliceTexture(volume, slice) {
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(D * D * 4), D, D, THREE.RGBAFormat)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.generateMipmaps = false
    return t
  }, [])
  useLayoutEffect(() => {
    fillSlice(tex.image.data, volume, slice)
    tex.needsUpdate = true
  }, [tex, volume, slice])
  return tex
}

export default function CTVolume({ volume, slice, texture }) {
  const ref = useRef()
  const shell = useMemo(() => buildShell(volume), [volume])
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(NODULE.worldSize, NODULE.worldSize, NODULE.worldSize)),
    []
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < shell.count; i++) {
      _m.makeTranslation(shell.pos[3 * i], shell.pos[3 * i + 1], shell.pos[3 * i + 2])
      mesh.setMatrixAt(i, _m)
      mesh.setColorAt(i, _c.setScalar(0.15 + 0.85 * shell.gray[i]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [shell])

  // voxels up to and including the slice stay; nearer ones are cut away
  const s = Math.max(0, Math.min(D - 1, slice))
  useLayoutEffect(() => {
    if (ref.current) ref.current.count = shell.prefix[s]
  }, [shell, s])

  const faceZ = (s - D / 2 + 1) * VOXEL_SIZE
  return (
    <group>
      <instancedMesh key={shell.count} ref={ref} args={[undefined, undefined, Math.max(1, shell.count)]} frustumCulled={false}>
        <boxGeometry args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} />
        <meshLambertMaterial />
      </instancedMesh>
      {/* the cut face: the real slice as a grayscale image */}
      <mesh position={[0, 0, faceZ + 0.0005]}>
        <planeGeometry args={[NODULE.worldSize, NODULE.worldSize]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* slice-plane frame */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#5bd1c3" />
      </lineSegments>
      <lineSegments position={[0, 0, faceZ + 0.001]} scale={[1, 1, 0.0001]} geometry={edges}>
        <lineBasicMaterial color="#5bd1c3" />
      </lineSegments>
    </group>
  )
}
