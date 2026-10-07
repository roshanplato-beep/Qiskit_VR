import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface OrbFieldHandle {
  /** Position and uniform scale of orb i. Call commit() once per frame after updates. */
  setOrb: (i: number, x: number, y: number, z: number, s?: number) => void;
  setSpark: (i: number, x: number, y: number, z: number, s?: number) => void;
  setOrbColor: (i: number, color: THREE.ColorRepresentation) => void;
  setSparkColor: (i: number, color: THREE.ColorRepresentation) => void;
  /** Show only the first n orbs / sparks. */
  setCounts: (orbs: number, sparks: number) => void;
  /** Flag matrices and colors dirty. */
  commit: () => void;
}
export interface OrbFieldProps {
  maxOrbs?: number;     // default 90
  maxSparks?: number;   // default 450
  orbRadius?: number;   // metres
  sparkRadius?: number;
  /** Optional initial xyz triples and per-instance rgb triples (0..1). */
  orbPositions?: ArrayLike<number>;
  sparkPositions?: ArrayLike<number>;
  orbColors?: ArrayLike<number>;
  sparkColors?: ArrayLike<number>;
}

const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function put(mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, s: number) {
  if (!mesh || i < 0 || i >= mesh.instanceMatrix.count) return;
  _m.compose(_p.set(x, y, z), _q.identity(), _s.set(s, s, s));
  mesh.setMatrixAt(i, _m);
}

export const OrbField = forwardRef<OrbFieldHandle, OrbFieldProps>(function OrbField(
  { maxOrbs = 90, maxSparks = 450, orbRadius = 0.012, sparkRadius = 0.004, orbPositions, sparkPositions, orbColors, sparkColors }, ref,
) {
  const orbs = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const orbGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const sparkGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const orbMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), []);
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);

  useLayoutEffect(() => {
    const init = (mesh: THREE.InstancedMesh | null, r: number, pos?: ArrayLike<number>, cols?: ArrayLike<number>) => {
      if (!mesh) return;
      const n = mesh.instanceMatrix.count;
      for (let i = 0; i < n; i++) {
        put(mesh, i, pos?.[i * 3] ?? 0, pos?.[i * 3 + 1] ?? 0, pos?.[i * 3 + 2] ?? 0, r);
        if (cols) mesh.setColorAt(i, _c.setRGB(cols[i * 3] ?? 1, cols[i * 3 + 1] ?? 1, cols[i * 3 + 2] ?? 1));
        else mesh.setColorAt(i, _c.set('#ffffff'));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    init(orbs.current, orbRadius, orbPositions, orbColors);
    init(sparks.current, sparkRadius, sparkPositions, sparkColors);
  }, [orbRadius, sparkRadius, orbPositions, sparkPositions, orbColors, sparkColors]);

  useImperativeHandle(ref, () => ({
    setOrb: (i, x, y, z, s = orbRadius) => put(orbs.current, i, x, y, z, s),
    setSpark: (i, x, y, z, s = sparkRadius) => put(sparks.current, i, x, y, z, s),
    setOrbColor: (i, c) => { const m = orbs.current; if (m && i >= 0 && i < maxOrbs) m.setColorAt(i, _c.set(c)); },
    setSparkColor: (i, c) => { const m = sparks.current; if (m && i >= 0 && i < maxSparks) m.setColorAt(i, _c.set(c)); },
    setCounts: (o, s) => {
      if (orbs.current) orbs.current.count = Math.max(0, Math.min(maxOrbs, o));
      if (sparks.current) sparks.current.count = Math.max(0, Math.min(maxSparks, s));
    },
    commit: () => {
      for (const m of [orbs.current, sparks.current]) {
        if (!m) continue;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    },
  }), [orbRadius, sparkRadius, maxOrbs, maxSparks]);

  return (
    <>
      <instancedMesh ref={orbs} args={[orbGeo, orbMat, maxOrbs]} frustumCulled={false} />
      <instancedMesh ref={sparks} args={[sparkGeo, sparkMat, maxSparks]} frustumCulled={false} />
    </>
  );
});
