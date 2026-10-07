import { useMemo } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';

export interface RepeatColumnsProps {
  noisy: number[];          // 5 noisy repeat scores
  mitigated: number[];      // 5 mitigated repeat scores (may be <0 or >1; never clipped)
  threshold: number;        // decision threshold (ring)
  noiseless: number;        // noiseless score (white line)
  height?: number;          // glass height in metres for score range 0..1 (default 0.3)
  spacing?: number;
  position?: [number, number, number];
  glassMaterial?: THREE.Material; // pass the shared glass material to save materials
}

const defaultGlass = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.18, depthWrite: false });
const red = new THREE.MeshBasicMaterial({ color: '#ff3b30' });
const amber = new THREE.MeshBasicMaterial({ color: '#ffb300' });
const cyan = new THREE.MeshBasicMaterial({ color: '#2ee6c8' });
const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const box = new THREE.BoxGeometry(1, 1, 1);

const W = 0.026; // column width, >= 2.6 cm

/**
 * One column. Value maps linearly: 0 at base, 1 at top of glass.
 * Values inside 0..1 fill the glass. v>1 overflows above the glass in red; v<0 hangs below the base in red.
 * Noisy = dashed (segments with gaps); mitigated = solid.
 */
function Column({ v, H, dashed, x, glass }: { v: number; H: number; dashed: boolean; x: number; glass: THREE.Material }) {
  const inside = Math.max(0, Math.min(1, v));
  const over = v > 1 ? v - 1 : 0;
  const under = v < 0 ? -v : 0;
  const base = dashed ? amber : cyan;
  const segs = useMemo(() => {
    if (!dashed) return null;
    const out: [number, number][] = [];
    const step = H / 4; // few segments: keeps draw calls low (<=4 per noisy column)
    for (let y = 0; y < inside * H - 1e-6; y += step) out.push([y, Math.min(step * 0.62, inside * H - y)]);
    return out;
  }, [dashed, inside, H]);
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, H / 2, 0]} material={glass} geometry={box} scale={[W * 1.25, H, W * 1.25]} />
      {dashed
        ? segs!.map(([y, h], i) => <mesh key={i} position={[0, y + h / 2, 0]} scale={[W, h, W]} geometry={box} material={base} />)
        : inside > 0 && <mesh position={[0, (inside * H) / 2, 0]} scale={[W, inside * H, W]} geometry={box} material={base} />}
      {over > 0 && (
        <>
          <mesh position={[0, H + (over * H) / 2, 0]} scale={[W, over * H, W]} geometry={box} material={red} />
          <Text position={[0, H + over * H + 0.012, 0]} fontSize={0.014} color="#ff6b60" anchorY="bottom">{`!${v.toFixed(2)}`}</Text>
        </>
      )}
      {under > 0 && (
        <>
          <mesh position={[0, -(under * H) / 2, 0]} scale={[W, under * H, W]} geometry={box} material={red} />
          <Text position={[0, -under * H - 0.012, 0]} fontSize={0.014} color="#ff6b60" anchorY="top">{`!${v.toFixed(2)}`}</Text>
        </>
      )}
    </group>
  );
}

export function RepeatColumns({ noisy, mitigated, threshold, noiseless, height = 0.3, spacing = 0.045, position, glassMaterial }: RepeatColumnsProps) {
  const glass = glassMaterial ?? defaultGlass;
  const H = height;
  const gap = 0.04;
  const n = Math.max(noisy.length, 1);
  const groupW = (n - 1) * spacing;
  const xN = (i: number) => -groupW - gap / 2 + i * spacing;
  const xM = (i: number) => gap / 2 + i * spacing;
  const left = xN(0) - W, right = xM(mitigated.length - 1) + W;
  return (
    <group position={position}>
      {noisy.map((v, i) => <Column key={`n${i}`} v={v} H={H} dashed x={xN(i)} glass={glass} />)}
      {mitigated.map((v, i) => <Column key={`m${i}`} v={v} H={H} dashed={false} x={xM(i)} glass={glass} />)}
      {/* noiseless reference: thin white line across both groups */}
      <mesh position={[(left + right) / 2, noiseless * H, W]} scale={[right - left, 0.003, 0.003]} geometry={box} material={white} />
      {/* threshold ring around each column group */}
      <mesh position={[(left + right) / 2, threshold * H, 0]} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[(right - left) / 2 + 0.012, 0.0022, 4, 24]} />
      </mesh>
      <Text position={[xN((n - 1) / 2), -0.03, 0]} fontSize={0.016} color="#ffffff" anchorY="top">N  noisy (dashed)</Text>
      <Text position={[xM((mitigated.length - 1) / 2), -0.03, 0]} fontSize={0.016} color="#ffffff" anchorY="top">M  mitigated (solid)</Text>
    </group>
  );
}
