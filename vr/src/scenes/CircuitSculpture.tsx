import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useLab } from '../state/store';
import type { Gate } from '../data/bundle';
import { PLINTH_TOP } from '../xr/Placement';
import { Text } from '../xr/Text';
import { BlochSphere } from '../three/BlochSphere';
import { RepeatColumns } from '../three/RepeatColumns';

/**
 * Scene B: circuit sculpture rebuilt from bundle.circuit_gates (or ablation_circuit_gates).
 * Static geometry is merged into 4 meshes (rails / encoding / trainable / CX bridges); gates are
 * picked through invisible hit boxes (not drawn). One pulse bar runs left -> right on every case /
 * setting change. Nothing here is invented: every value shown is read from the bundle.
 */
const X0 = -0.45;            // sculpture left end (plinth local)
const STEP = 0.052;          // column pitch
const railY = (q: number) => PLINTH_TOP + 0.08 + q * 0.075;
const gateX = (col: number) => X0 + 0.04 + col * STEP;

interface Placed { g: Gate; col: number; idx: number }

/** Assign each gate a column: a gate goes after everything already on the qubits it spans. */
export function layoutGates(gates: Gate[]): { placed: Placed[]; cols: number } {
  const next = [0, 0, 0, 0];
  const placed: Placed[] = [];
  gates.forEach((g, idx) => {
    if (g.name === 'measure') return;
    const lo = Math.min(...g.qubits), hi = Math.max(...g.qubits);
    let col = 0;
    for (let q = lo; q <= hi; q++) col = Math.max(col, next[q]);
    for (let q = lo; q <= hi; q++) next[q] = col + 1;
    placed.push({ g, col, idx });
  });
  return { placed, cols: Math.max(1, ...next) };
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function tf(geo: THREE.BufferGeometry, pos: THREE.Vector3, scale: THREE.Vector3, rot?: THREE.Euler): THREE.BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot ?? new THREE.Euler()), scale));
  return g.index ? g.toNonIndexed() : g;
}
const merge = (list: THREE.BufferGeometry[]) => {
  const out = list.length ? mergeGeometries(list.map((g) => { const c = g.clone(); c.deleteAttribute('uv'); return c; })) : null;
  return out ?? new THREE.BufferGeometry();
};

const matRail = new THREE.MeshBasicMaterial({ color: '#4a6a80' });
const matEnc = new THREE.MeshBasicMaterial({ color: '#7ff3ff' });
const matTrain = new THREE.MeshBasicMaterial({ color: '#ffb300' });
const matCx = new THREE.MeshBasicMaterial({ color: '#c58bff' });
const matPulse = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
const matHi = new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true });
const matGlass = new THREE.MeshBasicMaterial({ color: '#bfe6ff', transparent: true, opacity: 0.16, depthWrite: false });

function Sculpture({ gates, angles, onHover }: { gates: Gate[]; angles: number[]; onHover: (g: Gate | null, x: number, y: number) => void }) {
  const { placed, cols } = useMemo(() => layoutGates(gates), [gates]);
  const len = cols * STEP + 0.04;
  const geos = useMemo(() => {
    const rails: THREE.BufferGeometry[] = [], enc: THREE.BufferGeometry[] = [], train: THREE.BufferGeometry[] = [], cx: THREE.BufferGeometry[] = [];
    const one = new THREE.Vector3(1, 1, 1);
    for (let q = 0; q < 4; q++) rails.push(tf(boxGeo, new THREE.Vector3(X0 + len / 2, railY(q), 0), new THREE.Vector3(len, 0.004, 0.004)));
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    const sph = new THREE.SphereGeometry(0.5, 8, 6);
    const tor = new THREE.TorusGeometry(0.5, 0.09, 6, 14);
    for (const { g, col } of placed) {
      const x = gateX(col);
      if (g.name === 'ry') {
        const y = railY(g.qubits[0]);
        if (g.role === 'encoding') enc.push(tf(boxGeo, new THREE.Vector3(x, y, 0), new THREE.Vector3(0.034, 0.034, 0.034)));
        else train.push(tf(cyl, new THREE.Vector3(x, y, 0), new THREE.Vector3(0.036, 0.034, 0.036), new THREE.Euler(Math.PI / 2, 0, 0)));
      } else if (g.name === 'cx') {
        const [c, t] = g.qubits;
        const y0 = railY(Math.min(c, t)), y1 = railY(Math.max(c, t));
        cx.push(tf(boxGeo, new THREE.Vector3(x, (y0 + y1) / 2, 0), new THREE.Vector3(0.006, y1 - y0, 0.006)));
        cx.push(tf(sph, new THREE.Vector3(x, railY(c), 0), new THREE.Vector3(0.02, 0.02, 0.02)));
        cx.push(tf(tor, new THREE.Vector3(x, railY(t), 0), new THREE.Vector3(0.04, 0.04, 0.04)));
      }
    }
    void one;
    return { rails: merge(rails), enc: merge(enc), train: merge(train), cx: merge(cx) };
  }, [placed, len]);
  useEffect(() => () => { Object.values(geos).forEach((g) => g.dispose()); }, [geos]);

  const pulse = useRef<THREE.Mesh>(null);
  const t = useRef(1);
  const tick = useLab((s) => s.tick);
  useEffect(() => { t.current = 0; }, [tick, gates]);
  useFrame((_, dt) => {
    if (!pulse.current) return;
    t.current = Math.min(1.05, t.current + dt / 1.3);
    pulse.current.visible = t.current < 1;
    pulse.current.position.x = X0 + t.current * len;
  });

  return (
    <group>
      <mesh geometry={geos.rails} material={matRail} />
      <mesh geometry={geos.enc} material={matEnc} />
      <mesh geometry={geos.train} material={matTrain} />
      <mesh geometry={geos.cx} material={matCx} />
      <mesh position={[X0 + len / 2, railY(1.5) , -0.012]} scale={[len + 0.03, 0.27, 0.004]} geometry={boxGeo} material={matGlass} />
      <mesh ref={pulse} position={[X0, railY(1.5), 0]} scale={[0.012, 0.27, 0.05]} geometry={boxGeo} material={matPulse} />
      {/* invisible hit boxes: gaze / point at a gate for its role, parameter and frozen value */}
      {placed.map(({ g, col, idx }) => {
        const x = gateX(col);
        const ys = g.qubits.map(railY);
        const y = (Math.min(...ys) + Math.max(...ys)) / 2;
        const h = g.name === 'cx' ? Math.max(...ys) - Math.min(...ys) + 0.04 : 0.05;
        return (
          <mesh key={idx} position={[x, y, 0]} geometry={boxGeo} scale={[0.046, h, 0.05]}
            onPointerOver={(e) => { e.stopPropagation(); onHover(g, x, y); }}
            onPointerOut={() => onHover(null, 0, 0)}>
            <meshBasicMaterial visible={false} />
          </mesh>
        );
      })}
      {/* qubit labels at the left of the rails (4 tiny texts) */}
      {[0, 1, 2, 3].map((q) => <Text key={q} position={[X0 - 0.02, railY(q), 0]} fontSize={0.02} anchorX="right">{`q${q}`}</Text>)}
      <LegendNote angles={angles} />
    </group>
  );
}

function LegendNote({ angles }: { angles: number[] }) {
  void angles;
  return <Text position={[X0, PLINTH_TOP + 0.33, 0]} fontSize={0.014} color="#cfe8ff" anchorX="left" anchorY="bottom">
    {'cube = encoding RY (case angle)   disc = trainable RY (frozen)   bridge = CX'}
  </Text>;
}

function describe(g: Gate, angles: number[]): string[] {
  if (g.name === 'cx') return [`CX  control q${g.qubits[0]} -> target q${g.qubits[1]}`, `role: ${g.role} (layer ${g.layer ?? '-'})`];
  if (g.role === 'encoding') {
    const q = g.qubits[0];
    return [`RY on q${q}   role: encoding`, `param ${g.param} = theta ${angles[q]?.toFixed(3)} rad (this case)`];
  }
  return [`RY on q${g.qubits[0]}   role: trainable, layer ${g.layer ?? '-'}`, `param ${g.param} = ${g.value?.toFixed(4)} rad (frozen)`];
}

export function CircuitSculpture() {
  const bundle = useLab((s) => s.bundle)!;
  const caseId = useLab((s) => s.caseId);
  const setting = useLab((s) => s.setting);
  const ablation = useLab((s) => s.ablation);
  const c = bundle.cases.find((x) => x.id === caseId)!;
  const S = c.S[setting];
  const thr = bundle.model.threshold;
  const gates = ablation ? bundle.ablation_circuit_gates : bundle.circuit_gates;
  const [tip, setTip] = useState<{ g: Gate; x: number; y: number } | null>(null);
  const hoverGate = (g: Gate | null, x: number, y: number) => setTip(g ? { g, x, y } : null);
  const top = PLINTH_TOP;
  const q = [0, 1, 2, 3];
  const dec = (v: number, t: number) => (v >= t ? 'high suspicion' : 'low suspicion');

  return (
    <group>
      <Text position={[X0, top + 0.75, 0]} fontSize={0.026} anchorX="left" bold>
        {`Circuit sculpture${ablation ? ' - ablation: no CX bridges' : ''}`}
      </Text>
      <Text position={[X0, top + 0.715, 0]} fontSize={0.016} color="#9fc4dc" anchorX="left" anchorY="top">
        {`case ${c.id} (${c.split})   setting ${setting}   noiseless score ${c.nl.toFixed(3)}   threshold ${thr}   ${dec(c.nl, thr)}`}
      </Text>
      <Sculpture gates={gates} angles={c.angles} onHover={hoverGate} />
      {tip && (
        <group position={[tip.x, tip.y + 0.0, 0.03]}>
          <mesh scale={[0.05, tip.g.name === 'cx' ? 0.2 : 0.05, 0.05]} geometry={boxGeo} material={matHi} />
          <Text position={[0, -0.16, 0.02]} fontSize={0.017} color="#ffffff" anchorY="top" bold>
            {describe(tip.g, c.angles).join('\n')}
          </Text>
        </group>
      )}
      {!tip && (
        <Text position={[X0, top + 0.03, 0.02]} fontSize={0.014} color="#8fb4c8" anchorX="left" anchorY="top">
          Point at a gate: role, parameter and frozen value.
        </Text>
      )}
      {ablation && (
        <Text position={[X0, top + 0.43, 0]} fontSize={0.017} color="#ffd27f" anchorX="left" anchorY="bottom">
          {`No-CX ablation (noiseless): score ${c.abl.toFixed(3)}, threshold ${bundle.abl_threshold}, ${dec(c.abl, bundle.abl_threshold)}`}
        </Text>
      )}
      {/* four Bloch spheres: noiseless ghost (solid white) and gate-noisy arrow (dashed amber) */}
      {q.map((i) => (
        <BlochSphere key={i} b0={S.b0[i]} b={S.b[i]} radius={0.042} label={`q${i}`}
          position={[-0.38 + i * 0.17, top + 0.56, 0]} />
      ))}
      <Text position={[-0.46, top + 0.655, 0]} fontSize={0.013} color="#cfe8ff" anchorX="left" anchorY="bottom" maxWidth={0.92}>
        {'i  Arrows are shorter than 1 even without noise because the qubits are entangled; compare each to its solid ghost. Readout mitigation does not change the state, so there is no mitigated arrow.'}
      </Text>
      {/* measurement columns: 5 noisy (dashed) + 5 mitigated (solid), threshold ring, noiseless line */}
      <RepeatColumns noisy={S.n} mitigated={S.m} threshold={thr} noiseless={c.nl} height={0.28} spacing={0.034}
        position={[0.28, top + 0.07, 0]} glassMaterial={matGlass} />
      <Text position={[0.28, top + 0.07 + 0.28 + 0.02, 0]} fontSize={0.013} color="#cfe8ff" anchorY="bottom">
        {'ring = threshold, white line = noiseless score; red = outside 0..1, never clipped'}
      </Text>
    </group>
  );
}
