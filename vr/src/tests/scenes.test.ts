import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateBundle, SETTING_IDS, type Bundle } from '../data/bundle';
import { derive, keyOf, DEPTH_SCALE } from '../data/derive';
import { layoutGates } from '../scenes/CircuitSculpture';
import { TOUR_STEPS } from '../tour/Tour';

const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../public/qure_bundle.json', import.meta.url)), 'utf8'));
validateBundle(raw);
const b: Bundle = raw;
const d = derive(b);
const thr = b.model.threshold;

describe('counters come from data', () => {
  it('summary flip shares equal the shares recomputed from repeats', () => {
    for (const split of ['val', 'test'] as const) {
      const rel = (split === 'val' ? b.summary.quantum_reliability_val : b.summary.quantum_reliability_test) as any[];
      for (const r of rel) {
        expect(d.stats.get(keyOf(split, r.setting, 0))!.flipShare).toBeCloseTo(r.flip_noisy, 4);
        expect(d.stats.get(keyOf(split, r.setting, 1))!.flipShare).toBeCloseTo(r.flip_mitigated, 4);
      }
    }
  });
  it('rule U flag counts match the instability summary', () => {
    for (const r of b.summary.instability_val as any[]) expect(d.stats.get(keyOf('val', r.setting, 0))!.flagged).toBe(r.flagged);
    for (const r of b.summary.instability_test_label_free as any[]) expect(d.stats.get(keyOf('test', r.setting, 0))!.flagged).toBe(r.flagged);
  });
});

describe('decision wall layout', () => {
  it('orb depth is proportional to score - threshold on one fixed scale (no clipping)', () => {
    for (const s of SETTING_IDS) for (const p of d.table.get(keyOf('test', s, 0))!) {
      expect(p.depth).toBeCloseTo((p.nx - thr) * DEPTH_SCALE, 9);
    }
  });
  it('flip flags agree with the noiseless decision', () => {
    for (const p of d.table.get(keyOf('test', 'N4', 0))!) {
      p.repeats.forEach((v, k) => expect(p.flips[k]).toBe((v >= thr ? 1 : 0) !== p.dec));
    }
  });
  it('test placements carry no label', () => {
    for (const s of SETTING_IDS) for (const p of d.table.get(keyOf('test', s, 1))!) expect(p.label).toBeNull();
  });
});

describe('circuit sculpture layout', () => {
  it('places every non-measure gate once; ablation has no CX', () => {
    const full = layoutGates(b.circuit_gates);
    expect(full.placed).toHaveLength(b.circuit_gates.filter((g) => g.name !== 'measure').length);
    expect(layoutGates(b.ablation_circuit_gates).placed.some((p) => p.g.name === 'cx')).toBe(false);
    expect(full.cols).toBeGreaterThan(layoutGates(b.ablation_circuit_gates).cols);
  });
  it('no two gates share a column on the same qubit', () => {
    const seen = new Set<string>();
    for (const { g, col } of layoutGates(b.circuit_gates).placed) {
      for (let q = Math.min(...g.qubits); q <= Math.max(...g.qubits); q++) {
        const k = `${col}|${q}`; expect(seen.has(k)).toBe(false); seen.add(k);
      }
    }
  });
});

describe('tour', () => {
  it('has 8 steps with captions', () => {
    expect(TOUR_STEPS).toHaveLength(8);
    for (const s of TOUR_STEPS) expect(s.caption.length).toBeGreaterThan(0);
  });
});
