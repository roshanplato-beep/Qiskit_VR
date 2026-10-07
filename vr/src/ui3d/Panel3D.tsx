import type { ReactNode } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';

export interface Panel3DProps {
  width?: number;            // metres
  height?: number;
  title?: string;
  body?: string;             // optional wrapped body text
  position?: [number, number, number];
  rotation?: [number, number, number];
  tone?: 'info' | 'warn' | 'error'; // also shown as a leading letter: i / ! / X
  children?: ReactNode;      // controls placed in panel-local coordinates (z>0 is in front)
}

const geo = new THREE.PlaneGeometry(1, 1);
const bg = new THREE.MeshBasicMaterial({ color: '#10161f' });
const edge = {
  info: new THREE.MeshBasicMaterial({ color: '#7fd4ff' }),
  warn: new THREE.MeshBasicMaterial({ color: '#ffb300' }),
  error: new THREE.MeshBasicMaterial({ color: '#ff3b30' }),
};
const glyph = { info: 'i', warn: '!', error: 'X' } as const;

export function Panel3D({ width = 0.5, height = 0.3, title, body, position, rotation, tone = 'info', children }: Panel3DProps) {
  const pad = 0.015;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.003]} scale={[width + 0.008, height + 0.008, 1]} geometry={geo} material={edge[tone]} />
      <mesh scale={[width, height, 1]} geometry={geo} material={bg} />
      {title && (
        <Text position={[-width / 2 + pad, height / 2 - pad, 0.002]} fontSize={0.022} color="#ffffff" anchorX="left" anchorY="top" maxWidth={width - 2 * pad}>
          {`${glyph[tone]}  ${title}`}
        </Text>
      )}
      {body && (
        <Text position={[-width / 2 + pad, height / 2 - pad - (title ? 0.035 : 0), 0.002]} fontSize={0.016} color="#e6eef8" anchorX="left" anchorY="top" maxWidth={width - 2 * pad} lineHeight={1.25}>
          {body}
        </Text>
      )}
      {children}
    </group>
  );
}
