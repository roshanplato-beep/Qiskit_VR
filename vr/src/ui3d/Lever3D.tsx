import { useRef, useState } from 'react';
import { Text } from '../xr/Text';
import * as THREE from 'three';
import { detentClick } from '../audio/sfx';

export interface Lever3DProps {
  value: number;                       // detent index 0..detents-1
  onChange: (index: number) => void;   // fires only when the detent changes
  onDetent?: () => void;               // haptic callback, fires on every detent crossing
  labels?: string[];                   // one per detent (default N0..N4)
  detents?: number;                    // default 5
  position?: [number, number, number];
  length?: number;                     // metres of travel (default 0.3)
  title?: string;
}

const geo = new THREE.BoxGeometry(1, 1, 1);
const rail = new THREE.MeshBasicMaterial({ color: '#3a3f4b' });
const knobIdle = new THREE.MeshBasicMaterial({ color: '#e6eef8' });
const knobHover = new THREE.MeshBasicMaterial({ color: '#7fd4ff' });
const knobDrag = new THREE.MeshBasicMaterial({ color: '#ffb300' });
const notch = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const hit = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Vertical lever with discrete detents; the knob always sits ON a detent (never between).
 * Bottom = index 0. Drag with ray + trigger or pinch; pointer capture keeps the drag alive.
 */
export function Lever3D({ value, onChange, onDetent, labels, detents = 5, position, length = 0.3, title }: Lever3DProps) {
  const group = useRef<THREE.Group>(null);
  const last = useRef(value);
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);
  const step = length / (detents - 1);
  const yOf = (i: number) => -length / 2 + i * step;
  const names = labels ?? Array.from({ length: detents }, (_, i) => `N${i}`);
  const kh = 0.045; // knob size >= 4 cm

  const move = (e: any) => {
    if (!drag || !group.current) return;
    const local = group.current.worldToLocal(e.point.clone());
    const idx = Math.max(0, Math.min(detents - 1, Math.round((local.y + length / 2) / step)));
    if (idx !== last.current) {
      last.current = idx;
      detentClick();
      onDetent?.();
      onChange(idx);
    }
  };

  return (
    <group ref={group} position={position}>
      <mesh scale={[0.012, length + kh, 0.012]} geometry={geo} material={rail} />
      {names.map((n, i) => (
        <group key={i} position={[0, yOf(i), 0]}>
          <mesh position={[0.03, 0, 0]} scale={[0.02, 0.004, 0.004]} geometry={geo} material={notch} />
          <Text position={[0.05, 0, 0]} fontSize={0.02} color={i === value ? '#ffb300' : '#ffffff'} anchorX="left" anchorY="middle">
            {i === value ? `> ${n}` : n}
          </Text>
        </group>
      ))}
      <mesh position={[0, yOf(value), 0.012]} scale={[kh, kh, 0.02]} geometry={geo} material={drag ? knobDrag : hover ? knobHover : knobIdle} />
      {/* wide invisible hit area so the whole travel is grabbable */}
      <mesh scale={[0.1, length + kh * 2, 0.04]} geometry={geo} material={hit}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
        onPointerDown={(e) => { e.stopPropagation(); (e.target as any)?.setPointerCapture?.(e.pointerId); last.current = value; setDrag(true); move({ ...e, point: e.point }); }}
        onPointerMove={(e) => { e.stopPropagation(); move(e); }}
        onPointerUp={(e) => { e.stopPropagation(); (e.target as any)?.releasePointerCapture?.(e.pointerId); setDrag(false); }} />
      {title && <Text position={[0, length / 2 + kh, 0]} fontSize={0.02} color="#ffffff" anchorX="center" anchorY="bottom">{title}</Text>}
    </group>
  );
}
