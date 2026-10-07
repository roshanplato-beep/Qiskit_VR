// Generates a SCHEMA-VALID but SYNTHETIC sample bundle for QURE Lab XR development.
// Output: vr/public/qure_bundle.json  (bundle_version '0.2.1-sample', "_sample": true)
// None of these numbers are real results. Replace with `npm run sync` once web/qure_bundle.json exists.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../vr/public/qure_bundle.json');

// ---- seeded PRNG ----
let s = 0x9e3779b9;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const r4 = (x) => Math.round(x * 1e6) / 1e6;

// ---- 4-qubit RY/CX simulator (qubit i = bit i of the basis index) ----
const popcount = (x) => { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
const applyRY = (st, q, th) => {
  const c = Math.cos(th / 2), sn = Math.sin(th / 2), o = st.slice();
  for (let i = 0; i < 16; i++) if (!((i >> q) & 1)) {
    const j = i | (1 << q);
    o[i] = c * st[i] - sn * st[j];
    o[j] = sn * st[i] + c * st[j];
  }
  return o;
};
const applyCX = (st, c, t) => {
  const o = st.slice();
  for (let i = 0; i < 16; i++) if (((i >> c) & 1) && !((i >> t) & 1)) {
    const j = i | (1 << t); o[i] = st[j]; o[j] = st[i];
  }
  return o;
};
const run = (gates, angles) => {
  let st = new Array(16).fill(0); st[0] = 1;
  for (const g of gates) {
    if (g.name === 'ry') st = applyRY(st, g.qubits[0], g.role === 'encoding' ? angles[g.qubits[0]] : g.value);
    else if (g.name === 'cx') st = applyCX(st, g.qubits[0], g.qubits[1]);
  }
  return st;
};
const score = (st) => st.reduce((a, v, i) => a + ((popcount(i) & 1) ? v * v : 0), 0);
const bloch = (st, q) => {
  let x = 0, z = 0;
  for (let i = 0; i < 16; i++) {
    const bit = (i >> q) & 1; z += (bit ? -1 : 1) * st[i] * st[i];
    if (!bit) x += 2 * st[i] * st[i | (1 << q)];
  }
  return [x, 0, z];
};

// ---- circuits ----
const W = Array.from({ length: 12 }, () => r4(0.3 + rnd() * 2.5));
const gates = [], ablGates = [];
const push = (g) => { gates.push(g); ablGates.push(g); };
for (let q = 0; q < 4; q++) push({ name: 'ry', qubits: [q], role: 'encoding', param: 'x' + q });
let wi = 0;
for (let layer = 1; layer <= 2; layer++) {
  for (let q = 0; q < 4; q++) { push({ name: 'ry', qubits: [q], role: 'trainable', param: 'w' + wi, value: W[wi], layer }); wi++; }
  for (let q = 0; q < 3; q++) gates.push({ name: 'cx', qubits: [q, q + 1], role: 'entangling', layer });
}
for (let q = 0; q < 4; q++) { push({ name: 'ry', qubits: [q], role: 'trainable', param: 'w' + wi, value: W[wi], layer: 3 }); wi++; }
for (let q = 0; q < 4; q++) push({ name: 'measure', qubits: [q], role: 'readout' });

const THR = 0.39, ABL_THR = 0.5;
const SETTINGS = ['N0', 'N1', 'N2', 'N3', 'N4'];
const noise_settings = [
  { id: 'N0', label: 'noiseless', p1q: 0, p2q: 0, readout_p10: 0, readout_p01: 0 },
  { id: 'N1', label: 'readout only (low)', p1q: 0, p2q: 0, readout_p10: 0.02, readout_p01: 0.01 },
  { id: 'N2', label: 'gate + readout (low)', p1q: 0.0005, p2q: 0.005, readout_p10: 0.03, readout_p01: 0.015 },
  { id: 'N3', label: 'gate + readout (moderate)', p1q: 0.001, p2q: 0.01, readout_p10: 0.05, readout_p01: 0.025 },
  { id: 'N4', label: 'gate + high readout noise', p1q: 0.002, p2q: 0.02, readout_p10: 0.09, readout_p01: 0.05 },
];
const SHRINK = [0, 0.04, 0.1, 0.18, 0.3];   // synthetic pull toward 0.5
const SD = [0, 0.012, 0.02, 0.03, 0.045];   // synthetic run-to-run spread
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };

// ---- cases ----
const FEATS = ['nodule diameter (mm)', 'mean intensity', 'texture entropy', 'margin sharpness'];
const mkCase = (idx, split) => {
  const angles = Array.from({ length: 4 }, () => r4(0.15 + rnd() * (Math.PI - 0.3)));
  const st0 = run(gates, angles), nl = score(st0);
  const abl = score(run(ablGates, angles));
  const dec = nl >= THR ? 1 : 0;
  const S = {};
  SETTINGS.forEach((id, k) => {
    // gate-noisy Bloch: shrink noiseless vectors toward 0 (synthetic), |r|<1 always
    const b0 = [0, 1, 2, 3].map((q) => bloch(st0, q).map(r4));
    const b = b0.map((v) => v.map((c) => r4(c * (1 - SHRINK[k] * 0.8) + (k ? gauss() * 0.01 : 0))));
    const nx = r4(nl + (0.5 - nl) * SHRINK[k]);
    const n = Array.from({ length: 5 }, () => r4(Math.min(1, Math.max(0, nx + gauss() * SD[k]))));
    // mitigated: centred near nl but with more spread; deliberately NOT clipped
    const m = Array.from({ length: 5 }, () => r4(nl + gauss() * SD[k] * (k ? 2.4 : 0.001) + (k >= 3 ? gauss() * 0.02 : 0)));
    const eq = r4(mean(Array.from({ length: 3 }, () => nx + gauss() * SD[k] * 0.6)));
    const diff = (a) => a.filter((v) => (v >= THR ? 1 : 0) !== dec).length / a.length;
    const mm = mean(m), se = sd(m) / Math.sqrt(5);
    const f = (mm >= THR ? 1 : 0) !== (mean(n) >= THR ? 1 : 0) || Math.abs(mm - THR) < 0.7 * se;
    S[id] = { nx, n, m, eq, fn: diff(n), fm: diff(m), q: k ? m.filter((v) => v < 0 || v > 1).length : 0, f, b, b0 };
  });
  const lbl = split === 'val' ? (rnd() < 0.15 + 0.7 * nl ? 1 : 0) : null;
  return {
    id: (split === 'val' ? 'V' : 'T') + String(idx).padStart(3, '0'),
    patient: 'LIDC-IDRI-' + String(1000 + idx + (split === 'val' ? 0 : 100)).padStart(4, '0'),
    split, label: lbl, angles,
    features: angles.map((a, i) => r4([4 + a * 6, 0.2 + a / 4, a * 1.1, 1 - a / 3.5][i])),
    lr: split === 'val' ? r4(Math.min(0.99, Math.max(0.01, 0.2 + 0.6 * nl + gauss() * 0.12))) : null,
    platt: r4(Math.min(0.99, Math.max(0.01, 0.1 + 0.8 * nl))), abl: r4(abl), nl: r4(nl), dec, S,
  };
};
const cases = [];
for (let i = 0; i < 90; i++) cases.push(mkCase(i, 'val'));
for (let i = 0; i < 90; i++) cases.push(mkCase(i, 'test'));

// ---- summaries (computed from the synthetic cases) ----
const rel = (split) => SETTINGS.map((id) => {
  const cs = cases.filter((c) => c.split === split);
  return {
    setting: id,
    flip_noisy: r4(mean(cs.map((c) => c.S[id].fn))), flip_mitigated: r4(mean(cs.map((c) => c.S[id].fm))),
    spread_noisy: r4(mean(cs.map((c) => sd(c.S[id].n)))), spread_mitigated: r4(mean(cs.map((c) => sd(c.S[id].m)))),
    shots_noisy: 2000, shots_mitigated: 6000, n_cases: cs.length,
  };
});
const flagged = (split) => SETTINGS.map((id) => ({ setting: id, flagged: cases.filter((c) => c.split === split && c.S[id].f).length, of: 90 }));
const valCases = cases.filter((c) => c.split === 'val');
const bal = (pred) => {
  let tp = 0, tn = 0, p = 0, n = 0;
  for (const c of valCases) { if (c.label) { p++; tp += pred(c); } else { n++; tn += 1 - pred(c); } }
  return (tp / p + tn / n) / 2;
};
const qBA = bal((c) => c.dec), lr5 = bal((c) => (c.lr >= 0.5 ? 1 : 0)), lrT = bal((c) => (c.lr >= 0.45 ? 1 : 0));
const ci = (x) => [r4(x - 0.07), r4(Math.min(1, x + 0.07))];
const summary = {
  _note: 'SYNTHETIC sample summary; not real results',
  quantum_val: SETTINGS.map((id, k) => ({ setting: id, balanced_accuracy: r4(qBA - SHRINK[k] * 0.1), ci: ci(qBA) })),
  quantum_reliability_val: rel('val'), quantum_reliability_test: rel('test'),
  classical_val: { lr_at_0_5: { balanced_accuracy: r4(lr5), ci: ci(lr5) }, lr_val_tuned: { balanced_accuracy: r4(lrT), ci: ci(lrT) } },
  comparison_val: { difference: r4(qBA - lrT), ci: [r4(qBA - lrT - 0.04), r4(qBA - lrT + 0.04)], verdict: 'not distinguishable' },
  instability_val: flagged('val'), instability_test_label_free: flagged('test'),
};

// ---- synthetic 28x28 "CT" PNG (data: URL) ----
const png = (() => {
  const w = 28, h = 28, raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - 13.5, dy = y - 13.5, r = Math.hypot(dx, dy);
    let v = 70 + 40 * Math.exp(-r * r / 150) + 8 * Math.sin(x * 0.9) * Math.cos(y * 0.7);
    v += 90 * Math.exp(-((dx - 1) ** 2 + (dy + 1) ** 2) / 14);
    raw[y * (w + 1) + 1 + x] = Math.max(0, Math.min(255, Math.round(v)));
  }
  const chunk = (t, d) => {
    const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8);
    b.writeUInt32BE(zlib.crc32(b.subarray(4, 8 + d.length)) >>> 0, 8 + d.length); return b;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();

const bundle = {
  _sample: true,
  bundle_version: '0.2.1-sample', vr_url: null,
  circuit_gates: gates, ablation_circuit_gates: ablGates, noise_settings,
  noise_source: 'SYNTHETIC sample generated by tools/make_sample_bundle.mjs; not a real noise model',
  mitigation: { method: 'readout-error mitigation (sample)', note: 'SAMPLE DATA' },
  budget: { shots_per_execution: 2000, calibration_shots_total: 4000, mitigated_total_shots: 6000, equal_budget_raw_shots: 6000 },
  repeats: 5, instability_rule: 'U: raw and mitigated decisions disagree, or mitigated mean within 2 standard errors of the threshold',
  model: { model_id: 'sample-vqc', param_version: 'sample', threshold: THR, encoding: 'RY(theta_i), 4 qubits' },
  abl_threshold: ABL_THR, summary,
  dataset: {
    features: FEATS, label: 'radiologist suspicion (1-2 low, 4-5 high); not confirmed cancer', patients: 597,
    split_counts: { train: 417, val: 90, test: 90 }, limitations: ['SAMPLE DATA: synthetic numbers for development only'],
  },
  linked: { case_id: 'LIDC-IDRI-0009', slice_index: 0, png: 'data:image/png;base64,' + png.toString('base64') },
  cases,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(bundle));
const nf = cases.filter((c) => c.S.N4.f).length;
const oob = cases.flatMap((c) => SETTINGS.flatMap((k) => c.S[k].m)).filter((v) => v < 0 || v > 1).length;
console.log('wrote ' + out + ' (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB), N4 flagged: ' + nf + ', dec=1 share: ' + mean(cases.map((c) => c.dec)).toFixed(2) + ', mitigated values outside [0,1]: ' + oob);
