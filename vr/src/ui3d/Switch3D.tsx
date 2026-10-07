import { useState } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';
import { flipClick } from '../audio/sfx';

export interface Switch3DProps {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  position?: [number, number, number];
  width?: number;            // metres, min 0.08
  height?: number;           // metres, min 0.04
  onHaptic?: () => void;
}

const geo = new THREE.BoxGeometry(1, 1, 1);
const trackOn = new THREE.MeshBasicMaterial({ color: '#2b6f5e' });
const trackOff = new THREE.MeshBasicMaterial({ color: '#3a3f4b' });
const trackHover = new THREE.MeshBasicMaterial({ color: '#4a78c2' });
const knob = new THREE.MeshBasicMaterial({ color: '#ffffff' });

export function Switch3D({ label, on, onChange, position, width = 0.1, height = 0.04, onHaptic }: Switch3DProps) {
  const w = Math.max(0.08, width), h = Math.max(0.04, height);
  const [hover, setHover] = useState(false);
  const kw = h * 0.85;
  const kx = on ? w / 2 - kw / 2 - h * 0.08 : -w / 2 + kw / 2 + h * 0.08;
  return (
    <group position={position}>
      <mesh scale={[w, h, 0.012]} geometry={geo} material={hover ? trackHover : on ? trackOn : trackOff}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onClick={(e) => { e.stopPropagation(); flipClick(); onHaptic?.(); onChange(!on); }} />
      <mesh position={[kx, 0, 0.01]} scale={[kw, kw, 0.012]} geometry={geo} material={knob} />
      {/* letters, not colour alone */}
      <Text position={[on ? -w * 0.2 : w * 0.2, 0, 0.008]} fontSize={h * 0.4} color="#ffffff" anchorX="center" anchorY="middle">{on ? 'ON' : 'OFF'}</Text>
      <Text position={[0, h * 0.85, 0]} fontSize={Math.max(h * 0.4, 0.016)} color="#ffffff" anchorX="center" anchorY="bottom">{label}</Text>
    </group>
  );
}
