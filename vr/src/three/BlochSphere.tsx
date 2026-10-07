import { useMemo } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';
import type { Vec3 } from '../data/bundle';

export interface BlochSphereProps {
  b0: Vec3;                 // noiseless Bloch vector (solid white "ghost")
  b: Vec3;                  // gate-noisy Bloch vector (dashed amber)
  radius?: number;          // metres; default 0.045 (9 cm sphere)
  position?: [number, number, number];
  note?: string;            // small 'i' note, e.g. why the arrow is shorter than 1
  label?: string;           // optional qubit label, e.g. 'q0'
  showLengths?: boolean;    // |r| text for both arrows (default true)
}

// Bloch (x, y, z) -> scene (x, z, -y) so that Bloch z points up.
const toScene = (v: Vec3, R: number) => new THREE.Vector3(v[0] * R, v[2] * R, -v[1] * R);
const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

const sphereMat = new THREE.MeshBasicMaterial({ color: '#9fb4c8', wireframe: true, transparent: true, opacity: 0.35 });
const coneGeo = new THREE.ConeGeometry(0.1, 0.3, 8);
const ghostMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const ghostLine = new THREE.LineBasicMaterial({ color: '#ffffff' });
const amberMat = new THREE.MeshBasicMaterial({ color: '#ffb300' });

function Arrow({ v, R, dashed }: { v: Vec3; R: number; dashed: boolean }) {
  const tip = useMemo(() => toScene(v, R), [v, R]);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), tip]);
    const m = dashed
      ? new THREE.LineDashedMaterial({ color: '#ffb300', dashSize: R * 0.09, gapSize: R * 0.07 })
      : ghostLine;
    const l = new THREE.Line(g, m);
    if (dashed) l.computeLineDistances();
    return l;
  }, [tip, dashed, R]);
  const quat = useMemo(() => {
    const d = tip.clone();
    if (d.lengthSq() < 1e-12) return new THREE.Quaternion();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }, [tip]);
  const s = R * 0.12;
  return (
    <group>
      <primitive object={line} />
      <mesh position={tip} quaternion={quat} scale={[s, s, s]} geometry={coneGeo} material={dashed ? amberMat : ghostMat} />
    </group>
  );
}

export function BlochSphere({ b0, b, radius = 0.045, position, note, label, showLengths = true }: BlochSphereProps) {
  const R = radius;
  const fs = R * 0.55; // text >= 1.2 cm per metre of viewing distance at ~1 m
  return (
    <group position={position}>
      <mesh material={sphereMat}>
        <sphereGeometry args={[R, 12, 8]} />
      </mesh>
      <Arrow v={b0} R={R} dashed={false} />
      <Arrow v={b} R={R} dashed />
      {label && <Text position={[0, R * 1.35, 0]} fontSize={fs} color="#ffffff" anchorX="center" anchorY="bottom">{label}</Text>}
      {showLengths && (
        <Text position={[0, -R * 1.2, 0]} fontSize={fs * 0.8} color="#ffffff" anchorX="center" anchorY="top" lineHeight={1.15}>
          {`ideal |r|=${len(b0).toFixed(2)} (solid)\nnoisy |r|=${len(b).toFixed(2)} (dashed)`}
        </Text>
      )}
      {note && <Text position={[R * 1.2, R * 1.1, 0]} fontSize={fs * 0.7} color="#cfe8ff" anchorX="left" anchorY="middle" maxWidth={R * 5}>{`i  ${note}`}</Text>}
    </group>
  );
}
