import type { Bundle, Case, Gate, SettingId } from './bundle';
import { SETTING_IDS } from './bundle';

/** 4-qubit RY/CX statevector simulator (qubit i = bit i of the basis index). Rebuilds nl from circuit_gates. */
const popcount = (x: number) => { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; };

export function simulate(gates: Gate[], angles: number[]): number[] {
  let st = new Array<number>(16).fill(0); st[0] = 1;
  for (const g of gates) {
    if (g.name === 'ry') {
      const q = g.qubits[0];
      const th = g.role === 'encoding' ? angles[q] : (g.value ?? 0);
      const c = Math.cos(th / 2), s = Math.sin(th / 2), o = st.slice();
      for (let i = 0; i < 16; i++) if (!((i >> q) & 1)) {
        const j = i | (1 << q);
        o[i] = c * st[i] - s * st[j];
        o[j] = s * st[i] + c * st[j];
      }
      st = o;
    } else if (g.name === 'cx') {
      const [c, t] = g.qubits, o = st.slice();
      for (let i = 0; i < 16; i++) if (((i >> c) & 1) && !((i >> t) & 1)) {
        const j = i | (1 << t); o[i] = st[j]; o[j] = st[i];
      }
      st = o;
    }
  }
  return st;
}

/** Probability that the 4 measured bits have odd parity. */
export function oddParityScore(st: number[]): number {
  let p = 0;
  for (let i = 0; i < 16; i++) if (popcount(i) & 1) p += st[i] * st[i];
  return p;
}

export const scoreOf = (gates: Gate[], angles: number[]) => oddParityScore(simulate(gates, angles));

export type Mit = 0 | 1;
export type Split = 'val' | 'test';

export interface Placement {
  caseId: string;
  nl: number;
  dec: 0 | 1;
  flag: boolean;
  /** recorded (never interpolated) scores of the 5 repeats for this (setting, mitigation) */
  repeats: number[];
  /** repeat decisions differing from the noiseless decision */
  flips: boolean[];
  nx: number;
  /** orb layout slot: angle on the 140 degree arc (rad, centred on 0) and height (m) */
  arcAngle: number;
  height: number;
  /** orb depth from the wall, proportional to (score - threshold); not clipped */
  depth: number;
  label: 0 | 1 | null;
}

export interface Derived {
  /** key `${split}|${setting}|${mit}` -> placements in stable per-split order */
  table: Map<string, Placement[]>;
  casesBySplit: Record<Split, Case[]>;
  stats: Map<string, { flipShare: number; flagged: number; total: number }>;
}

export const DEPTH_SCALE = 0.8; // metres of depth per unit (score - threshold); stated on the legend

export const keyOf = (split: Split, s: SettingId, mit: Mit) => `${split}|${s}|${mit}`;

/** Precompute every position per (split, setting, mitigation) once at load. */
export function derive(b: Bundle): Derived {
  const thr = b.model.threshold;
  const casesBySplit = { val: [] as Case[], test: [] as Case[] };
  for (const c of b.cases) casesBySplit[c.split].push(c);
  const table = new Map<string, Placement[]>();
  const stats = new Map<string, { flipShare: number; flagged: number; total: number }>();
  const ARC = (140 * Math.PI) / 180;
  for (const split of ['val', 'test'] as Split[]) {
    const cs = casesBySplit[split];
    const cols = 15, rows = Math.max(2, Math.ceil(cs.length / cols)); // grid on the arc: no overlaps
    for (const s of SETTING_IDS) for (const mit of [0, 1] as Mit[]) {
      const arr: Placement[] = [];
      let flips = 0, reps = 0, flagged = 0;
      cs.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cset = c.S[s];
        const repeats = mit ? cset.m : cset.n;
        const fl = repeats.map((v) => (v >= thr ? 1 : 0) !== c.dec);
        flips += fl.filter(Boolean).length; reps += repeats.length;
        if (cset.f) flagged++;
        const score = mit ? repeats.reduce((x, y) => x + y, 0) / repeats.length : cset.nx;
        arr.push({
          caseId: c.id, nl: c.nl, dec: c.dec, flag: cset.f, repeats, flips: fl, nx: cset.nx,
          arcAngle: -ARC / 2 + (col / (cols - 1)) * ARC,
          height: 0.9 + (row / (rows - 1)) * 1.0,
          depth: (score - thr) * DEPTH_SCALE,
          label: c.label,
        });
      });
      table.set(keyOf(split, s, mit), arr);
      stats.set(keyOf(split, s, mit), { flipShare: flips / reps, flagged, total: cs.length });
    }
  }
  return { table, casesBySplit, stats };
}
