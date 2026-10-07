import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useLab } from '../state/store';
import { SETTING_IDS } from '../data/bundle';
import { DEPTH_SCALE, keyOf } from '../data/derive';
import { PLINTH_TOP } from '../xr/Placement';
import { Text } from '../xr/Text';
import { Membrane, type MembraneHandle } from '../three/Membrane';
import { OrbField, type OrbFieldHandle } from '../three/OrbField';
import { Lever3D } from '../ui3d/Lever3D';
import { Switch3D } from '../ui3d/Switch3D';
import { Panel3D } from '../ui3d/Panel3D';
import { flipClick } from '../audio/sfx';
import { haptic } from '../xr/haptics';

/**
 * Scene C: the Decision Wall. A 140 degree membrane around the user at a fixed radius; every case
 * of the chosen split is an orb whose depth from the wall is proportional to (score - threshold);
 * the 5 recorded repeats are sparks. The lever PLAYS BACK recorded settings: positions are looked
 * up per (split, setting, mitigation), never interpolated between settings (the <=0.28 s glide is
 * a visual move to the recorded position; no number changes while it moves).
 */
export const R_WALL = 1.6;
export const WALL_H = 2.0;
export const WALL_Y = 1.4;
const ARC = (140 * Math.PI) / 180;
const GLIDE = 0.28;
const ORB_R = 0.034, SPARK_R = 0.011, ORBIT_R = 0.075;
const MAX_HITS = 12;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const _e = new THREE.Euler();
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function put(mesh: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, s: number, yaw = 0) {
  if (!mesh) return;
  _q.setFromEuler(_e.set(0, yaw, 0));
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s)));
}

function uTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffb300'; x.font = '700 56px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('U', 32, 36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function dashedRing(r: number, tube: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const n = 10;
  for (let k = 0; k < n; k++) {
    const g = new THREE.TorusGeometry(r, tube, 4, 3, (Math.PI * 2 / n) * 0.55);
    g.rotateZ(k * (Math.PI * 2 / n));
    parts.push(g.toNonIndexed());
  }
  let total = 0; parts.forEach((g) => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

interface Fly { from: THREE.Vector3; t: number; id: string }

export function WallField() {
  const bundle = useLab((s) => s.bundle)!;
  const derived = useLab((s) => s.derived)!;
  const split = useLab((s) => s.split);
  const setting = useLab((s) => s.setting);
  const mit = useLab((s) => s.mitigation);
  const thr = bundle.model.threshold;
  const pl = derived.table.get(keyOf(split, setting, mit))!;
  const n = pl.length;

  const field = useRef<OrbFieldHandle>(null);
  const membrane = useRef<MembraneHandle>(null);
  const ringsVal = useRef<THREE.InstancedMesh>(null);
  const ringsTest = useRef<THREE.InstancedMesh>(null);
  const halos = useRef<THREE.InstancedMesh>(null);
  const us = useRef<THREE.InstancedMesh>(null);
  const flyMesh = useRef<THREE.Mesh>(null);
  const fly = useRef<Fly | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const geoRing = useMemo(() => new THREE.TorusGeometry(ORB_R * 1.5, 0.0035, 5, 22), []);
  const geoDash = useMemo(() => dashedRing(ORB_R * 1.5, 0.0035), []);
  const geoHalo = useMemo(() => new THREE.TorusGeometry(ORB_R * 2.1, 0.006, 5, 26), []);
  const geoU = useMemo(() => new THREE.PlaneGeometry(0.045, 0.045), []);
  const matVal = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
  const matTest = useMemo(() => new THREE.MeshBasicMaterial({ color: '#9aa3ad' }), []);
  const matHalo = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffb300' }), []);
  const uTex = useMemo(uTexture, []);
  const matU = useMemo(() => new THREE.MeshBasicMaterial({ map: uTex, transparent: true, alphaTest: 0.4, depthWrite: false }), [uTex]);

  // current radial distance (from the user axis) of every orb / spark; glide state
  const rOrbCur = useRef(new Float32Array(90).fill(R_WALL));
  const rSparkCur = useRef(new Float32Array(450).fill(R_WALL));
  const rOrbFrom = useRef(new Float32Array(90)), rOrbTo = useRef(new Float32Array(90));
  const rSparkFrom = useRef(new Float32Array(450)), rSparkTo = useRef(new Float32Array(450));
  const tGlide = useRef(1);
  const first = useRef(true);
  const keyRef = useRef('');

  const orbDepth = (i: number) => pl[i].depth;
  // setup on every (split, setting, mitigation) change: recorded targets, colours, flips
  useEffect(() => {
    const f = field.current;
    if (!f) return;
    rOrbFrom.current.set(rOrbCur.current); rSparkFrom.current.set(rSparkCur.current);
    for (let i = 0; i < n; i++) {
      rOrbTo.current[i] = R_WALL - orbDepth(i);
      f.setOrbColor(i, pl[i].dec ? '#ff8a5c' : '#5cc8ff');
      for (let k = 0; k < 5; k++) {
        const si = i * 5 + k;
        rSparkTo.current[si] = R_WALL - (pl[i].repeats[k] - thr) * DEPTH_SCALE;
        const flipped = pl[i].flips[k];
        f.setSparkColor(si, flipped ? '#ff3b30' : mit ? '#2ee6c8' : '#ffd27f');
      }
    }
    f.setCounts(n, n * 5);
    // static per-split overlays: ring colour = reference label (validation only)
    const rv = ringsVal.current;
    if (rv) for (let i = 0; i < n; i++) rv.setColorAt(i, _c.set(pl[i].label === 1 ? '#ff4fd8' : pl[i].label === 0 ? '#3fe0b0' : '#9aa3ad'));
    if (rv?.instanceColor) rv.instanceColor.needsUpdate = true;
    if (first.current) { rOrbCur.current.set(rOrbTo.current); rSparkCur.current.set(rSparkTo.current); tGlide.current = 1; }
    else tGlide.current = 0;
    // decision flips: a recorded repeat on the other side of the wall punches through, with a click
    const key = keyOf(split, setting, mit);
    const changed = keyRef.current !== key; keyRef.current = key;
    let timer: number | undefined;
    if (!first.current && changed) {
      const hits: [number, number][] = [];
      for (let i = 0; i < n && hits.length < MAX_HITS; i++) {
        if (pl[i].flips.some(Boolean)) hits.push([pl[i].arcAngle * R_WALL, pl[i].height - WALL_Y]);
      }
      if (hits.length) {
        timer = window.setTimeout(() => {
          hits.forEach(([x, y]) => membrane.current?.addHit(x, y));
          flipClick(); haptic(0.35, 40);
        }, GLIDE * 1000);
      }
    }
    first.current = false;
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pl]);

  useFrame((state, dt) => {
    const f = field.current;
    if (!f) return;
    if (tGlide.current < 1) tGlide.current = Math.min(1, tGlide.current + dt / GLIDE);
    const e = ease(tGlide.current);
    const time = state.clock.elapsedTime;
    const ro = rOrbCur.current, rs = rSparkCur.current;
    const rv = ringsVal.current, rt = ringsTest.current, hl = halos.current, uu = us.current;
    let nh = 0;
    for (let i = 0; i < n; i++) {
      ro[i] = rOrbFrom.current[i] + (rOrbTo.current[i] - rOrbFrom.current[i]) * e;
      const a = pl[i].arcAngle, h = pl[i].height;
      const sa = Math.sin(a), ca = Math.cos(a);
      const ox = ro[i] * sa, oz = -ro[i] * ca;
      f.setOrb(i, ox, h, oz, i === hover ? ORB_R * 1.4 : ORB_R);
      const yaw = -a;
      const rr = ro[i] - 0.01;
      if (split === 'val') put(rv, i, rr * sa, h, -rr * ca, 1, yaw); else put(rt, i, rr * sa, h, -rr * ca, 1, yaw);
      if (pl[i].flag) {
        put(hl, i, rr * sa, h, -rr * ca, 1, yaw);
        // 'U' sits up and to the right of the orb, facing the user
        put(uu, i, ro[i] * sa + ca * 0.07, h + 0.06, -ro[i] * ca + sa * 0.07, 1, yaw);
        nh++;
      } else { put(hl, i, 0, -10, 0, 0.0001, 0); put(uu, i, 0, -10, 0, 0.0001, 0); }
      for (let k = 0; k < 5; k++) {
        const si = i * 5 + k;
        rs[si] = rSparkFrom.current[si] + (rSparkTo.current[si] - rSparkFrom.current[si]) * e;
        const phi = time * 0.9 + (k * Math.PI * 2) / 5 + i * 0.7;
        const tx = Math.cos(phi) * ORBIT_R, ty = Math.sin(phi) * ORBIT_R;
        // radial position is the recorded score of this repeat; the orbit only moves in the tangent plane
        f.setSpark(si, rs[si] * sa + ca * tx, h + ty, -rs[si] * ca + sa * tx, pl[i].flips[k] ? SPARK_R * 1.7 : SPARK_R);
      }
    }
    f.commit();
    for (const mesh of [rv, rt, hl, uu]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    if (hl) hl.count = n; if (uu) uu.count = n;
    void nh;
    // inspected orb flying to the plinth
    const fl = fly.current;
    if (fl && flyMesh.current) {
      fl.t = Math.min(1, fl.t + dt / 0.6);
      const { rig, seated } = useLab.getState();
      const target = _p.set(rig.x, PLINTH_TOP + 0.3 - (seated ? 0.4 : 0), rig.z);
      flyMesh.current.visible = true;
      flyMesh.current.position.copy(fl.from).lerp(target, ease(fl.t));
      if (fl.t >= 1) {
        fly.current = null; flyMesh.current.visible = false;
        const st = useLab.getState(); st.setFromWall(true); st.setView('encode'); st.setScene('lab');
      }
    }
  });

  const hp = hover !== null ? pl[hover] : null;
  const hpos = hp ? (() => {
    const r = rOrbCur.current[hover!];
    return [r * Math.sin(hp.arcAngle), hp.height + 0.1, -r * Math.cos(hp.arcAngle)] as [number, number, number];
  })() : null;

  const onClick = (i: number) => {
    const p = pl[i]; const r = rOrbCur.current[i];
    const st = useLab.getState();
    st.setCase(p.caseId);
    flipClick(); haptic(0.5, 40);
    fly.current = { from: new THREE.Vector3(r * Math.sin(p.arcAngle), p.height, -r * Math.cos(p.arcAngle)), t: 0, id: p.caseId };
  };

  return (
    <group>
      <Membrane ref={membrane} width={R_WALL * ARC} height={WALL_H} radius={R_WALL} arc={ARC} position={[0, WALL_Y, 0]} />
      <OrbField ref={field} orbRadius={ORB_R} sparkRadius={SPARK_R} onOrbClick={onClick} onOrbHover={setHover} />
      <instancedMesh ref={ringsVal} args={[geoRing, matVal, 90]} frustumCulled={false} visible={split === 'val'} raycast={() => null} />
      <instancedMesh ref={ringsTest} args={[geoDash, matTest, 90]} frustumCulled={false} visible={split === 'test'} raycast={() => null} />
      <instancedMesh ref={halos} args={[geoHalo, matHalo, 90]} frustumCulled={false} raycast={() => null} />
      <instancedMesh ref={us} args={[geoU, matU, 90]} frustumCulled={false} raycast={() => null} />
      <mesh ref={flyMesh} visible={false} raycast={() => null}>
        <sphereGeometry args={[ORB_R * 1.6, 10, 8]} /><meshBasicMaterial color="#ffffff" />
      </mesh>
      {hp && hpos && (
        <Text position={hpos} fontSize={0.04} anchorY="bottom" bold>
          {`${hp.caseId}  score ${(hp.depth / DEPTH_SCALE + thr).toFixed(2)}${hp.flag ? '  U' : ''}  (trigger: inspect)`}
        </Text>
      )}
      {/* legend on the wall: one fixed scale */}
      <Text position={[0, WALL_Y + 0.98, -R_WALL]} fontSize={0.05} bold>{`Decision wall  -  threshold ${thr}`}</Text>
      <Text position={[0, WALL_Y + 0.92, -R_WALL]} fontSize={0.034} color="#cfe8ff" anchorY="top" maxWidth={2.6}>
        {`Toward you = score above threshold (high suspicion). Behind the wall = below. Fixed scale: 0.1 of score = ${(0.1 * DEPTH_SCALE * 100).toFixed(0)} cm.\nOrb = case at its recorded score. Sparks = 5 recorded repeats (${mit ? 'mitigated, solid cyan' : 'noisy, amber'}; red = decision differs from noiseless).\nAmber halo + U = rule-U review flag. ${split === 'val' ? 'Ring colour = reference label: magenta high, green low.' : 'Dashed grey ring: label held by Role 2.'}`}
      </Text>
    </group>
  );
}

export function WallPlinthControls() {
  const bundle = useLab((s) => s.bundle)!;
  const derived = useLab((s) => s.derived)!;
  const setting = useLab((s) => s.setting);
  const mit = useLab((s) => s.mitigation);
  const split = useLab((s) => s.split);
  const setSetting = useLab((s) => s.setSetting);
  const setMitigation = useLab((s) => s.setMitigation);
  const setSplit = useLab((s) => s.setSplit);
  const idx = SETTING_IDS.indexOf(setting);
  const label = bundle.noise_settings.find((x) => x.id === setting)?.label ?? '';
  const sum = bundle.summary ?? {};
  const rel = (split === 'val' ? sum.quantum_reliability_val : sum.quantum_reliability_test)?.find((r: any) => r.setting === setting);
  const inst = (split === 'val' ? sum.instability_val : sum.instability_test_label_free)?.find((r: any) => r.setting === setting);
  const st = derived.stats.get(keyOf(split, setting, 0))!;
  const st1 = derived.stats.get(keyOf(split, setting, 1))!;
  const fn = rel?.flip_noisy ?? st.flipShare, fm = rel?.flip_mitigated ?? st1.flipShare;
  const flagged = inst?.flagged ?? st.flagged, of = inst?.of ?? st.total;
  const shotsN = rel?.shots_noisy ?? bundle.budget.shots_per_execution, shotsM = rel?.shots_mitigated ?? bundle.budget.mitigated_total_shots;
  const spN = rel?.spread_noisy, spM = rel?.spread_mitigated;
  const rels: any[] = (split === 'val' ? sum.quantum_reliability_val : sum.quantum_reliability_test) ?? [];
  const spMax = Math.max(1e-9, ...rels.map((r) => r.spread_mitigated ?? 0), ...rels.map((r) => r.spread_noisy ?? 0));
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const BARW = 0.26;
  const bar = (y: number, frac: number, color: string) => (
    <mesh position={[-0.17 + (BARW * Math.max(0.01, frac)) / 2, y, 0.004]} scale={[BARW * Math.max(0.01, frac), 0.016, 0.004]}>
      <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={color} />
    </mesh>
  );
  const top = PLINTH_TOP;
  return (
    <group>
      <Lever3D value={idx} onChange={(i) => setSetting(SETTING_IDS[i])} onDetent={() => haptic(0.7, 35)} position={[-0.33, top + 0.2, -0.04]} title="Noise" />
      <Text position={[0, top + 0.66, 0.02]} fontSize={0.04} bold>{`${setting} · ${label}`}</Text>
      <Text position={[0, top + 0.61, 0.02]} fontSize={0.016} color="#9fc4dc" anchorY="top">
        Playback of recorded simulator runs: the lever never interpolates between settings.
      </Text>
      <Switch3D label="Mitigation" on={mit === 1} onChange={(v) => setMitigation(v ? 1 : 0)} position={[-0.1, top + 0.07, 0.0]} width={0.16} height={0.06} onHaptic={() => haptic(0.6, 40)} />
      <Switch3D label="Show test split" on={split === 'test'} onChange={(v) => setSplit(v ? 'test' : 'val')} position={[0.12, top + 0.07, 0.0]} width={0.16} height={0.06} onHaptic={() => haptic(0.6, 40)} />
      <Panel3D width={0.4} height={0.15} position={[0.26, top + 0.46, -0.02]} rotation={[-0.25, 0, 0]} title={`Counters (${split === 'val' ? 'validation' : 'test'}, ${setting})`}
        body={`decision flips: ${pct(fn)} → ${pct(fm)} of repeats\n  now showing ${mit ? 'mitigated' : 'noisy'} repeats\nU flags: ${flagged} / ${of}`} />
      <Panel3D width={0.4} height={0.19} position={[0.26, top + 0.28, 0.0]} rotation={[-0.25, 0, 0]} tone="warn" title={`Cost of mitigation (${setting})`}
        body={`shots: ${shotsN} → ${shotsM}\nrun-to-run spread (sd): ${spN !== undefined ? spN.toFixed(3) : '-'} → ${spM !== undefined ? spM.toFixed(3) : '-'}`}>
        {bar(-0.04, shotsN / Math.max(shotsN, shotsM), '#ffd27f')}
        {bar(-0.062, shotsM / Math.max(shotsN, shotsM), '#2ee6c8')}
        {bar(-0.082, (spN ?? 0) / spMax, '#ffd27f')}
        {bar(-0.104, (spM ?? 0) / spMax, '#2ee6c8')}
      </Panel3D>
    </group>
  );
}
