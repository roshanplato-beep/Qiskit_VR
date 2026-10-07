import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateBundle, SETTING_IDS, isSample, type Bundle } from '../data/bundle';
import { scoreOf, derive, keyOf } from '../data/derive';

const raw = JSON.parse(readFileSync(fileURLToPath(new URL('../../public/qure_bundle.json', import.meta.url)), 'utf8'));
validateBundle(raw);
const b: Bundle = raw;

describe('bundle', () => {
  it('has 90 val + 90 test and a 0.2.x version', () => {
    expect(b.bundle_version.startsWith('0.2.')).toBe(true);
    expect(b.cases.filter((c) => c.split === 'val')).toHaveLength(90);
    expect(b.cases.filter((c) => c.split === 'test')).toHaveLength(90);
  });
  it('never carries test labels', () => {
    for (const c of b.cases) if (c.split === 'test') expect(c.label).toBeNull();
  });
  it('rejects a wrong version', () => {
    expect(() => validateBundle({ ...b, bundle_version: '0.1.9' })).toThrow(/Expected/);
  });
  it('sample flag detected', () => {
    if (b.bundle_version.includes('sample')) expect(isSample(b)).toBe(true);
  });
});

describe('circuit', () => {
  it('circuit_gates reproduce each case nl to 1e-4', () => {
    for (const c of b.cases) expect(Math.abs(scoreOf(b.circuit_gates, c.angles) - c.nl)).toBeLessThan(1e-4);
  });
  it('ablation circuit reproduces abl to 1e-4 and has no CX', () => {
    expect(b.ablation_circuit_gates.some((g) => g.name === 'cx')).toBe(false);
    for (const c of b.cases) expect(Math.abs(scoreOf(b.ablation_circuit_gates, c.angles) - c.abl)).toBeLessThan(1e-4);
  });
});

describe('derive', () => {
  const d = derive(b);
  it('places every case for every split/setting/mitigation', () => {
    for (const split of ['val', 'test'] as const) for (const s of SETTING_IDS) for (const m of [0, 1] as const)
      expect(d.table.get(keyOf(split, s, m))).toHaveLength(90);
  });
  it('flip share matches per-case fn/fm averages', () => {
    for (const split of ['val', 'test'] as const) for (const s of SETTING_IDS) {
      const cs = d.casesBySplit[split];
      const mean = (k: 'fn' | 'fm') => cs.reduce((a, c) => a + c.S[s][k], 0) / cs.length;
      expect(d.stats.get(keyOf(split, s, 0))!.flipShare).toBeCloseTo(mean('fn'), 9);
      expect(d.stats.get(keyOf(split, s, 1))!.flipShare).toBeCloseTo(mean('fm'), 9);
    }
  });
  it('never clips mitigated values', () => {
    let outside = 0;
    for (const split of ['val', 'test'] as const) for (const s of SETTING_IDS)
      d.table.get(keyOf(split, s, 1))!.forEach((p) => {
        const c = b.cases.find((x) => x.id === p.caseId)!;
        expect(p.repeats).toEqual(c.S[s].m);
        outside += p.repeats.filter((v) => v < 0 || v > 1).length;
      });
    if (b._sample) expect(outside).toBeGreaterThan(0);
  });
  it('orbs do not overlap (unique arc/height slots)', () => {
    const seen = new Set<string>();
    for (const p of d.table.get(keyOf('test', 'N0', 0))!) {
      const k = `${p.arcAngle.toFixed(4)}|${p.height.toFixed(3)}`;
      expect(seen.has(k)).toBe(false); seen.add(k);
    }
  });
});
