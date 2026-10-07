import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLab } from '../state/store';
import { PLINTH_TOP } from '../xr/Placement';
import { Label } from '../xr/Label';

/**
 * Scene A: the real CT patch (bundle.linked.png) floats above the plinth, four strands peel off
 * (one per feature) and twist into four qubit rails while each rotation angle counts up to the
 * case's real theta. The bundle carries no nodule mask, so the card gets a plain cyan frame only
 * (no outline is invented).
 */
const CARD = 0.3;
const CARD_Y = PLINTH_TOP + 0.3;
const RAIL_X = 0.22;                // qubit rails start here (to the right of the card)
const railY = (i: number) => PLINTH_TOP + 0.08 + i * 0.07;
const DURATION = 2.4;               // seconds for the strands + angle count-up

function useCtTexture(png: string | undefined) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!png) return;
    let live = true;
    new THREE.TextureLoader().load(png, (t) => {
      if (!live) return;
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; setTex(t);
    });
    return () => { live = false; };
  }, [png]);
  return tex;
}

/** Strand i: from card bottom edge to rail i, with a helical twist that relaxes as it arrives. */
function strandPoints(i: number, t: number, N = 40) {
  const start = new THREE.Vector3(-0.2 + i * 0.08, CARD_Y - CARD / 2, 0);
  const end = new THREE.Vector3(RAIL_X, railY(i), 0);
  const pts: THREE.Vector3[] = [];
  const upto = Math.max(2, Math.round(N * t));
  for (let k = 0; k < upto; k++) {
    const u = k / (N - 1);
    const p = start.clone().lerp(end, u);
    p.y += Math.sin(u * Math.PI) * 0.06;
    const tw = (1 - u) * 0.025 * Math.sin(u * 14 + i);
    p.z += tw; p.x += tw * 0.4;
    pts.push(p);
  }
  return pts;
}

function Strand({ i, progress, color }: { i: number; progress: React.MutableRefObject<number>; color: string }) {
  const geom = useMemo(() => new THREE.BufferGeometry(), []);
  const line = useMemo(() => new THREE.Line(geom, new THREE.LineBasicMaterial({ color })), [geom, color]);
  useFrame(() => {
    const t = Math.min(1, progress.current);
    geom.setFromPoints(strandPoints(i, Math.max(0.05, t)));
  });
  return <primitive object={line} />;
}

const STRAND_COLORS = ['#7ff3ff', '#a6ff9c', '#ffd27f', '#ff9fd0'];

export function LabAppears() {
  const bundle = useLab((s) => s.bundle)!;
  const caseId = useLab((s) => s.caseId);
  const tick = useLab((s) => s.tick);
  const c = bundle.cases.find((x) => x.id === caseId)!;
  const tex = useCtTexture(bundle.linked.png);
  const progress = useRef(0);
  const [shown, setShown] = useState([0, 0, 0, 0]);
  const last = useRef('');

  // restart the reveal whenever the case changes (or the scene first appears)
  useEffect(() => { progress.current = 0; last.current = ''; }, [caseId, tick]);

  useFrame((_, dt) => {
    progress.current = Math.min(1.2, progress.current + dt / DURATION);
    const k = Math.min(1, Math.max(0, (progress.current - 0.3) / 0.7)); // angles count up after the strands leave the card
    const next = c.angles.map((a) => Math.round(a * k * 100) / 100);
    const key = next.join(',');
    if (key !== last.current) { last.current = key; setShown(next); }
  });

  const names = bundle.dataset.features;
  return (
    <group>
      {/* floating CT card */}
      <mesh position={[-0.08, CARD_Y, 0]}>
        <planeGeometry args={[CARD, CARD]} />
        <meshBasicMaterial map={tex} color={tex ? '#ffffff' : '#223344'} toneMapped={false} />
      </mesh>
      <lineSegments position={[-0.08, CARD_Y, 0.001]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(CARD, CARD)]} />
        <lineBasicMaterial color="#35e0ff" />
      </lineSegments>
      <Label text={`CT patch (case ${bundle.linked.case_id}, slice ${bundle.linked.slice_index})`} width={0.3} px={36}
        position={[-0.08, CARD_Y + CARD / 2 + 0.03, 0]} />
      <group>
        {[0, 1, 2, 3].map((i) => <Strand key={i} i={i} progress={progress} color={STRAND_COLORS[i]} />)}
      </group>
      {/* 4 qubit rails with feature name + value + counting angle */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i}>
          <mesh position={[RAIL_X + 0.17, railY(i), 0]}>
            <boxGeometry args={[0.34, 0.006, 0.006]} />
            <meshBasicMaterial color={STRAND_COLORS[i]} />
          </mesh>
          <Label text={`q${i}`} width={0.03} px={44} position={[RAIL_X + 0.365, railY(i), 0]} />
          <Label align="left" width={0.3} px={34} color={STRAND_COLORS[i]}
            text={`${names[i] ?? 'feature ' + i} = ${c.features[i].toFixed(2)}`}
            position={[RAIL_X + 0.17, railY(i) + 0.026, 0.005]} />
          <Label width={0.16} px={40} text={`θ${i} = ${shown[i].toFixed(2)} rad`}
            position={[RAIL_X + 0.17, railY(i) - 0.024, 0.005]} />
        </group>
      ))}
      <Label text="One nodule → four numbers → four rotations." width={0.6} px={48} color="#ffffff" bg="#0b1b28cc"
        position={[0, PLINTH_TOP + 0.62, 0]} />
    </group>
  );
}
