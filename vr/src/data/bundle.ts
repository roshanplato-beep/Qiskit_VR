export type SettingId = 'N0' | 'N1' | 'N2' | 'N3' | 'N4';
export type Vec3 = [number, number, number];
export const SETTING_IDS: SettingId[] = ['N0', 'N1', 'N2', 'N3', 'N4'];

export interface CaseSetting {
  nx: number;            // noisy exact (infinite-shot) score
  n: number[];           // 5 noisy repeat scores
  m: number[];           // 5 mitigated repeat scores (may lie outside [0,1]; never clip)
  eq: number;            // mean of a raw run with the same total shots (6000)
  fn: number; fm: number;// share of repeats whose decision differs from noiseless (noisy / mitigated)
  q: number;             // repeats with negative quasi-probabilities (0..5)
  f: boolean;            // flagged by rule U
  b: Vec3[];             // per-qubit Bloch vectors, gate-noisy state (4)
  b0: Vec3[];            // per-qubit Bloch vectors, noiseless state (4)
}
export interface Case {
  id: string; patient: string; split: 'val' | 'test';
  label: 0 | 1 | null;   // null on test: held by Role 2
  angles: number[];      // 4 encoding angles theta (rad)
  features: number[];    // 4 raw feature values (display only)
  lr: number | null;     // logistic-regression probability (validation only)
  platt: number;         // Platt-calibrated value of the noiseless score (fit on validation)
  abl: number;           // no-CX ablation noiseless score
  nl: number; dec: 0 | 1;// noiseless score and decision
  S: Record<SettingId, CaseSetting>;
}
export interface Gate { name: 'ry' | 'cx' | 'measure'; qubits: number[]; role: 'encoding' | 'trainable' | 'entangling' | 'readout'; param?: string; value?: number; layer?: number }
export interface Bundle {
  bundle_version: string; vr_url: string | null;
  circuit_gates: Gate[]; ablation_circuit_gates: Gate[];
  noise_settings: { id: SettingId; label: string; p1q: number; p2q: number; readout_p10: number; readout_p01: number }[];
  noise_source: string; mitigation: Record<string, string>;
  budget: { shots_per_execution: number; calibration_shots_total: number; mitigated_total_shots: number; equal_budget_raw_shots: number };
  repeats: number; instability_rule: string;
  model: { model_id: string; param_version: string; threshold: number; encoding: string };
  abl_threshold: number;
  summary: any;          // quantum_val[], quantum_reliability_val/test[], classical_val, comparison_val, instability_val[], instability_test_label_free[]
  dataset: { features: string[]; label: string; patients: number; split_counts: Record<string, number>; limitations: string[] };
  linked: { case_id: string; slice_index: number; png: string };
  cases: Case[];
  _sample?: boolean;     // present only on the development sample bundle
}

export const EXPECTED_VERSION_PREFIX = '0.2.';

export function isSample(b: Bundle): boolean {
  return b._sample === true || /sample/i.test(b.bundle_version);
}

/** Resolve the bundle URL: ?bundle=, VITE_BUNDLE_URL, ../qure_bundle.json, ./qure_bundle.json */
export function bundleUrlCandidates(): string[] {
  const out: string[] = [];
  const q = new URLSearchParams(location.search).get('bundle');
  if (q) out.push(q);
  if (import.meta.env.VITE_BUNDLE_URL) out.push(import.meta.env.VITE_BUNDLE_URL);
  out.push('../qure_bundle.json', './qure_bundle.json');
  return out;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isNumArr = (x: unknown, len?: number): x is number[] =>
  Array.isArray(x) && x.every(isNum) && (len === undefined || x.length === len);
const isVec3Arr = (x: unknown): boolean =>
  Array.isArray(x) && x.length === 4 && x.every((v) => isNumArr(v, 3));

export class BundleError extends Error {}

/** Validates only the fields the app uses. Throws BundleError with a readable message. */
export function validateBundle(b: any): asserts b is Bundle {
  const fail = (m: string): never => { throw new BundleError(m); };
  if (!b || typeof b !== 'object') fail('Bundle is not an object');
  if (typeof b.bundle_version !== 'string' || !b.bundle_version.startsWith(EXPECTED_VERSION_PREFIX))
    fail(`Unsupported bundle_version "${b.bundle_version}". Expected a version starting with "${EXPECTED_VERSION_PREFIX}" (e.g. 0.2.1).`);
  if (!Array.isArray(b.circuit_gates) || !Array.isArray(b.ablation_circuit_gates)) fail('circuit_gates / ablation_circuit_gates missing');
  if (!b.model || !isNum(b.model.threshold)) fail('model.threshold missing');
  if (!isNum(b.abl_threshold)) fail('abl_threshold missing');
  if (!Array.isArray(b.noise_settings) || b.noise_settings.length !== 5) fail('noise_settings must have 5 entries');
  if (!b.linked || typeof b.linked.png !== 'string') fail('linked.png missing');
  if (!b.budget || !isNum(b.budget.shots_per_execution) || !isNum(b.budget.mitigated_total_shots)) fail('budget missing');
  if (!b.summary || typeof b.summary !== 'object') fail('summary missing');
  if (!Array.isArray(b.cases) || b.cases.length === 0) fail('cases missing');
  for (const c of b.cases) {
    const w = `case ${c?.id}`;
    if (typeof c.id !== 'string') fail('case without id');
    if (c.split !== 'val' && c.split !== 'test') fail(`${w}: bad split`);
    if (c.split === 'test' && c.label !== null) fail(`${w}: test label must be null`);
    if (!isNumArr(c.angles, 4)) fail(`${w}: angles`);
    if (!isNumArr(c.features, 4)) fail(`${w}: features`);
    if (!isNum(c.nl) || !isNum(c.abl)) fail(`${w}: nl/abl`);
    for (const id of SETTING_IDS) {
      const s = c.S?.[id];
      if (!s) fail(`${w}: missing setting ${id}`);
      if (!isNum(s.nx) || !isNumArr(s.n, 5) || !isNumArr(s.m, 5)) fail(`${w}/${id}: nx/n/m`);
      if (!isNum(s.fn) || !isNum(s.fm) || !isNum(s.q) || typeof s.f !== 'boolean') fail(`${w}/${id}: fn/fm/q/f`);
      if (!isVec3Arr(s.b) || !isVec3Arr(s.b0)) fail(`${w}/${id}: bloch vectors`);
    }
  }
}

export async function loadBundle(): Promise<Bundle> {
  let lastErr = 'no candidate URL';
  for (const url of bundleUrlCandidates()) {
    let text: string;
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) { lastErr = `${url}: HTTP ${r.status}`; continue; }
      text = await r.text();
      if (text.trimStart().startsWith('<')) { lastErr = `${url}: not JSON`; continue; }
    } catch (e: any) { lastErr = `${url}: ${e?.message ?? e}`; continue; }
    let json: any;
    try { json = JSON.parse(text); } catch (e: any) { lastErr = `${url}: invalid JSON`; continue; }
    validateBundle(json);   // a wrong version/shape is a hard error, not a fallthrough
    return json;
  }
  throw new BundleError(`Could not load qure_bundle.json (${lastErr})`);
}
