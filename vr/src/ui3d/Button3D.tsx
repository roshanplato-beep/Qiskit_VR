import { useState } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';
import { flipClick } from '../audio/sfx';

export interface Button3DProps {
  label: string;
  onPress: () => void;
  position?: [number, number, number];
  width?: number;            // metres, min 0.04
  height?: number;           // metres, min 0.04
  active?: boolean;          // latched look: shows a leading '>' and bright border
  glyph?: string;            // letter/symbol shown with the label so colour is never the only cue
  onHaptic?: () => void;     // call a controller haptic pulse
  disabled?: boolean;
}

const geo = new THREE.BoxGeometry(1, 1, 1);
const mats = {
  idle: new THREE.MeshBasicMaterial({ color: '#23324a' }),
  hover: new THREE.MeshBasicMaterial({ color: '#4a78c2' }),
  active: new THREE.MeshBasicMaterial({ color: '#2b6f5e' }),
  down: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  off: new THREE.MeshBasicMaterial({ color: '#1a1f29' }),
  border: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
};

export function Button3D({ label, onPress, position, width = 0.12, height = 0.045, active, glyph, onHaptic, disabled }: Button3DProps) {
  const w = Math.max(0.04, width), h = Math.max(0.04, height);
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const mat = disabled ? mats.off : down ? mats.down : hover ? mats.hover : active ? mats.active : mats.idle;
  const text = `${active ? '> ' : ''}${glyph ? glyph + ' ' : ''}${label}`;
  return (
    <group position={position}>
      {(active || hover) && <mesh position={[0, 0, -0.002]} scale={[w + 0.008, h + 0.008, 0.01]} geometry={geo} material={mats.border} />}
      <mesh
        scale={[w, h, down ? 0.008 : 0.014]}
        geometry={geo}
        material={mat}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => { setHover(false); setDown(false); }}
        onPointerDown={(e) => { e.stopPropagation(); if (disabled) return; setDown(true); }}
        onPointerUp={(e) => { e.stopPropagation(); setDown(false); }}
        onClick={(e) => { e.stopPropagation(); if (disabled) return; flipClick(); onHaptic?.(); onPress(); }}
      />
      <Text position={[0, 0, 0.009]} fontSize={Math.min(h * 0.4, 0.02)} color={down ? '#000000' : disabled ? '#7a8494' : '#ffffff'}
        anchorX="center" anchorY="middle" maxWidth={w * 0.92}>{text}</Text>
    </group>
  );
}
