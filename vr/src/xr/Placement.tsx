import { useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useLab } from '../state/store';
import { Label } from './Label';

/**
 * The lab is VIRTUAL: a fixed plinth 0.6 m in front of the user, top at 0.9 m height.
 * No plane detection / hit-test / anchors. Grab the glowing edge frame to move the lab;
 * the two arrow buttons rotate it in 15 degree snaps. Children are in plinth-local space
 * (origin = plinth centre on the floor line; plinth top at y = PLINTH_TOP).
 */
export const PLINTH_TOP = 0.9;
export const PLINTH_W = 0.9;
export const PLINTH_D = 0.5;
const SEATED_DROP = 0.4;
const SNAP = (15 * Math.PI) / 180;
const EDGE = 0.04; // 4 cm edge frame: comfortable to grab

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLINTH_TOP);

function Hit({ position, size, onGrab, label, active }: {
  position: [number, number, number]; size: [number, number, number];
  onGrab: (e: ThreeEvent<PointerEvent>) => void; label?: string; active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <mesh position={position} onPointerDown={onGrab}
      onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={hover || active ? '#7ff3ff' : '#1d8fa8'} />
      {label ? null : null}
    </mesh>
  );
}

function SmallButton({ position, text, onPress, active }: {
  position: [number, number, number]; text: string; onPress: () => void; active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group position={position}>
      <mesh onClick={onPress} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <boxGeometry args={[0.1, 0.04, 0.04]} />
        <meshBasicMaterial color={hover ? '#7ff3ff' : active ? '#2fbf8f' : '#16526b'} />
      </mesh>
      <Label text={text} width={0.09} px={44} position={[0, 0.0205, 0]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}

export function Placement({ children }: { children?: ReactNode }) {
  const rig = useLab((s) => s.rig);
  const seated = useLab((s) => s.seated);
  const setRig = useLab((s) => s.setRig);
  const setSeated = useLab((s) => s.setSeated);
  const drag = useRef<{ start: THREE.Vector3; x: number; z: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const hitPt = useRef(new THREE.Vector3());

  const rayHit = (e: ThreeEvent<PointerEvent>) => e.ray.intersectPlane(floorPlane, hitPt.current) ? hitPt.current : null;

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as any)?.setPointerCapture?.(e.pointerId);
    const p = rayHit(e);
    if (!p) return;
    drag.current = { start: p.clone(), x: rig.x, z: rig.z };
    setDragging(true);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    const p = rayHit(e);
    if (!p) return;
    const lim = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    setRig({
      x: lim(drag.current.x + (p.x - drag.current.start.x), -1.5, 1.5),
      z: lim(drag.current.z + (p.z - drag.current.start.z), -2.0, -0.4),
    });
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    (e.target as any)?.releasePointerCapture?.(e.pointerId);
    drag.current = null; setDragging(false);
  };

  const rot = (dir: 1 | -1) => setRig({ yaw: Math.round((rig.yaw + dir * SNAP) / SNAP) * SNAP });
  const hw = PLINTH_W / 2, hd = PLINTH_D / 2;

  return (
    <group position={[rig.x, seated ? -SEATED_DROP : 0, rig.z]} rotation={[0, rig.yaw, 0]}
      onPointerMove={onMove} onPointerUp={onUp}>
      {/* glass plinth body */}
      <mesh position={[0, PLINTH_TOP / 2 - 0.01, 0]}>
        <boxGeometry args={[PLINTH_W, PLINTH_TOP - 0.02, PLINTH_D]} />
        <meshLambertMaterial color="#0b2230" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, PLINTH_TOP - 0.005, 0]}>
        <boxGeometry args={[PLINTH_W, 0.01, PLINTH_D]} />
        <meshBasicMaterial color="#123c52" />
      </mesh>
      {/* soft light ring on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.62, 0.7, 48]} />
        <meshBasicMaterial color="#35d0ff" transparent opacity={0.5} />
      </mesh>
      {/* grabbable edge frame (move the lab) */}
      <Hit position={[0, PLINTH_TOP + 0.005, hd - EDGE / 2]} size={[PLINTH_W, 0.012, EDGE]} onGrab={onDown} active={dragging} />
      <Hit position={[0, PLINTH_TOP + 0.005, -hd + EDGE / 2]} size={[PLINTH_W, 0.012, EDGE]} onGrab={onDown} active={dragging} />
      <Hit position={[hw - EDGE / 2, PLINTH_TOP + 0.005, 0]} size={[EDGE, 0.012, PLINTH_D - 2 * EDGE]} onGrab={onDown} active={dragging} />
      <Hit position={[-hw + EDGE / 2, PLINTH_TOP + 0.005, 0]} size={[EDGE, 0.012, PLINTH_D - 2 * EDGE]} onGrab={onDown} active={dragging} />
      {/* controls on the front lip */}
      <SmallButton position={[-0.3, PLINTH_TOP + 0.02, hd - 0.1]} text={'↺ 15°'} onPress={() => rot(1)} />
      <SmallButton position={[-0.18, PLINTH_TOP + 0.02, hd - 0.1]} text={'↻ 15°'} onPress={() => rot(-1)} />
      <SmallButton position={[0.3, PLINTH_TOP + 0.02, hd - 0.1]} text={seated ? 'Seated' : 'Standing'} onPress={() => setSeated(!seated)} active={seated} />
      <Label text="Grab the cyan edge to move the lab" width={0.3} px={40} color="#8fd8ee"
        position={[0.04, PLINTH_TOP + 0.013, hd - 0.1]} rotation={[-Math.PI / 2, 0, 0]} />
      <Label text="Research prototype. Simulated quantum execution. Not a medical device." width={0.6} px={36} color="#9fb4c4"
        position={[0, PLINTH_TOP + 0.013, hd - 0.17]} rotation={[-Math.PI / 2, 0, 0]} />
      {children}
    </group>
  );
}
