# PROMPT 5 (Quest 2 edition) — QURE Lab XR: Virtual Lab for Meta Quest 2 / 2 Pro

> Restructured from the Quest 3 mixed-reality version. The ONLY changes are the ones Quest 2
> forces: the experience runs as **virtual reality** (`immersive-vr`) in a dark virtual lab room
> instead of passthrough mixed reality on your real table, and the performance budget is tighter.
> The data contract, the five scenes, and every honesty rule are unchanged.

## For the human (read this, do not paste it)
- **Why VR, not MR.** Quest 2's passthrough is low-resolution grayscale and it lacks the reliable
  plane detection / anchors / depth that the Quest 3 "put the lab on your real table" idea needs.
  So on Quest 2 the lab lives in a **virtual room** you stand in. Everything else is the same.
- **How to use it.** Paste everything below the line as the first message in a fresh Claude Code
  session at the repo root. In ChatGPT, also attach `web/qure_bundle.json` and `web/template.html`.
- **What to check.** The AI stops after each milestone; test on the headset before saying "continue".
- **Before you start.** Copy `web/qure_bundle.json` (v0.2.1, from the latest Role 1 delivery) into the
  repo. Delete or archive the old `vr/` folder; the new app starts clean.

---

## 1. Your role and the goal
You are a senior WebXR engineer and spatial-interaction designer. Build **QURE Lab XR**: a virtual-reality
lab for the **Meta Quest 2 / 2 Pro** browser. The quantum classifier's real results appear as holograms
on a virtual plinth and on a decision wall in a dark virtual lab room around the user.

The aim is a moment a judge remembers. The user raises a noise lever, and the room fills with 90 real
test nodules whose quantum decisions shake and cross a glowing decision wall. Then one switch flips
mitigation on and most of them settle back. Everything shown comes from recorded simulation data;
nothing is invented.

The website (`web/`, a static console) is the main product. This is a separate static app in `vr/` that
reads the same bundle file, so it attaches to the website with one link and changes nothing else.

## 2. What the project is (so you explain it correctly)
- **Data (Role 2).** CIRDataset: LIDC-IDRI CT patches with expert nodule masks, 597 patients, one
  nodule each. Labels are radiologist suspicion (rating 1–2 = low, 4–5 = high), not confirmed cancer.
  Split by patient: 417 train / 90 validation / 90 test. Test labels are held by Role 2. Never show or
  guess them.
- **Inputs.** Four image/mask features per nodule, mapped to four angles θ ∈ (0, π).
- **Circuit (Role 1).** RY(θᵢ) encoding on 4 qubits, then 2 layers of [trainable RY on each qubit + CX
  chain 0–1, 1–2, 2–3], then a final trainable RY layer: 12 weights, frozen.
- **Score:** the probability that the 4 measured bits have odd parity. Decision is "high suspicion" if
  score ≥ threshold (0.39). **The score is not a probability of disease.**
- **Noise.** Five hypothetical simulator settings, N0 (noiseless) to N4 (gate + high readout noise).
  Each case was run 5 times × 2000 shots per setting. Three results per case and setting: noiseless
  reference (exact); noisy execution (5 repeats); mitigated estimate (5 repeats; readout-error mitigation
  only).
- **Instability rule U** flags a case for review when the raw and mitigated decisions disagree, or the
  mitigated mean is within 2 standard errors of the threshold. A review prompt, not a trust score.
- **Honest result.** On validation, the quantum model (balanced accuracy 0.857) and logistic regression
  (0.810 at 0.5, 0.845 tuned) are not distinguishable. There is no quantum advantage. Mitigation cuts
  score error but makes results vary more between runs; that cost has to be shown.

## 3. The data contract (the only input)
- **Source.** Load one JSON file: the website's `qure_bundle.json`. Resolve its URL in this order:
  1. `?bundle=<url>` query parameter;
  2. `import.meta.env.VITE_BUNDLE_URL`;
  3. `../qure_bundle.json` (when hosted at `web/vr/`);
  4. `./qure_bundle.json` (dev copy in `vr/public/`).
- **Version check.** Require `bundle_version` to start with `"0.2."`. Otherwise show an in-world error
  panel naming the expected version.
- **Rules:** Never write to the bundle. Never call a server. Never call an LLM. Never hard-code a result number.

Put these types in `vr/src/data/bundle.ts` and validate the fields you use at load time:

```ts
export type SettingId = 'N0' | 'N1' | 'N2' | 'N3' | 'N4';
export type Vec3 = [number, number, number];
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
  angles: number[];      // 4 encoding angles θ (rad)
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
  linked: { case_id: string; slice_index: number; png: string }; // one real CT slice (data: URL), case LIDC-IDRI-0009
  cases: Case[];         // 90 val + 90 test
}
```

Data facts you can rely on (check them in code, assert them in a unit test):
- `circuit_gates` rebuilds the circuit exactly. Applying the gates to |0000⟩ with a case's angles
  reproduces that case's `nl` to about 1e-4. Use this for the circuit sculpture; do not invent gate values.
- Readout mitigation does not change the quantum state, so there is **no "mitigated Bloch arrow"**. Show
  noiseless (`b0`) and gate-noisy (`b`) arrows only, and say why.
- Bloch vectors are shorter than 1 even without noise, because the qubits are entangled. Always compare
  an arrow to its noiseless ghost, never to the sphere's surface.
- At N4 on the test split, 18 of 90 cases have at least one noisy repeat whose decision differs from the
  noiseless reference, and rule U flags 15. Read these counts from the data; listed here only for a loader
  sanity-check.

## 4. The experience (scenes ranked by priority)
Build in this order. Each scene must work alone, so a demo is possible after any milestone.

### Scene A — "The Lab appears" (opening, 20 s)
- **Placement (Quest 2 = virtual).** On entering VR, a dark virtual lab room fades in. A glass plinth
  (0.9 × 0.5 m) rises in front of the user at a **fixed virtual position: 0.6 m in front, top at 0.9 m
  height**, with a soft light-ring. There is **no real-table detection** (Quest 2 has no reliable plane
  detection). The user can grab the plinth's edge to move/rotate the whole lab (snap rotation 15°).
  - Seated option: a toggle lowers the whole rig by ~0.4 m for seated users.
- **The CT patch.** The real CT patch (`linked.png`) rises from the plinth as a floating 30 cm image card
  with its cyan mask outline.
- **Encoding.** Four light-strands peel off the card, one per feature, each labelled with its feature name
  and value. They twist into the four qubit rails while their angle θ counts up to the case's real value.
- Caption: "One nodule → four numbers → four rotations."

### Scene B — "Circuit sculpture" (core)
- **Layout.** A glass sculpture on the plinth, ~60 cm long: four horizontal qubit rails. Gate blocks placed
  from `circuit_gates` in three visual roles: encoding RY, trainable RY, and CX as vertical light-bridges
  (dot on control, ring on target). Gaze or point at a gate to see its role, parameter and frozen value.
- **Pulse.** A pulse of light runs left → right whenever the case or setting changes.
- **Bloch spheres.** Four 9 cm spheres at the rail ends. Arrows: noiseless (`b0`, solid white ghost) and
  gate-noisy (`b`, dashed amber). Each sphere shows |r| for both. A small "i" panel: "Shorter than 1 even
  without noise because the qubits are entangled. Readout mitigation does not change the state."
- **Measurement columns.** Five thin glass columns (one per repeat) fill to each repeat's noisy score;
  five more fill to the mitigated scores. A ring marks the threshold; a white line marks the noiseless
  score. If a mitigated value is <0 or >1, the column overflows past the glass in red and keeps its true
  value (values are never clipped).
- **Ablation toggle.** Removes the CX bridges, rebuilds from `ablation_circuit_gates`, shows `abl` with
  its threshold.

### Scene C — "The Decision Wall" (THE wow moment; build it beautifully)
- **The wall.** A translucent vertical membrane, 3 m wide × 2 m tall, ~1.5 m in front, curving around the
  user in a 140° arc (shimmering fresnel + ripple shader).
- **The orbs.** All 90 cases of the chosen split as glowing orbs in the arc. Each orb's depth from the wall
  ∝ (score − threshold), "high" in front, "low" behind, one fixed scale (stated on a legend). Height
  spreads cases so none overlap. On validation, each orb has a thin ring coloured by its reference label;
  on test, the ring is dashed grey with "label held by Role 2".
- The 5 noisy repeats of each case are tiny sparks orbiting their orb at their recorded scores.
- **The noise lever.** A physical lever on the plinth, 5 detents (N0…N4), haptic click per detent, a big
  readout "N3 · gate + readout (moderate)". Never rests between detents. On each change, orbs and sparks
  move to the new recorded positions in ≤ 300 ms. No numbers shown during motion; values change only at
  detents. (Playback of precomputed settings, never interpolation.)
- **A decision flip.** When a repeat lands on the other side of the wall from the noiseless decision, that
  spark punches through the membrane with a ripple and a short click.
- **Rule U.** Flagged orbs get an amber halo and a small "U".
- **The mitigation switch.** Big, glowing. ON replaces noisy sparks with mitigated sparks. Most return to
  their side; a few stay, and those stay visible.
- **Counter panel** (straight from data): "decision flips: 16.9% → 3.3% of repeats" and "U flags: 15 / 90".
- **Cost bar:** "shots: 2000 → 6000" and run-to-run spread growing (`summary.quantum_reliability_*`).
  Mitigation must never look free.
- **Inspecting a case.** Point at any orb + trigger: the orb flies to the plinth, Scenes A and B reload for
  it. "Back to wall" returns it.
- **Split switch.** Validation / Test, from `cases[].split`.

### Scene D — "Verdict podium" (honesty, short)
- Three free-standing 3D bars rise beside the plinth: quantum (noiseless); logistic regression at 0.5;
  logistic regression val-tuned. Bar height = validation balanced accuracy, each with its 95% CI whisker.
- **Plaque** reads `summary.comparison_val`: "difference +0.011, CI −0.022 to 0.050: not distinguishable.
  No quantum-advantage claim."
- **Disclaimer:** "Research prototype. Simulated quantum execution. Not a medical device." On this plaque
  and in small text on the plinth in every scene.

### Scene E — "Guided tour" (judge mode, 90 seconds)
- Eight steps with captions, plus optional `speechSynthesis` voice behind a speaker toggle (captions always
  on): 1 lab appears; 2 one nodule → four rotations; 3 the circuit; 4 noiseless vs noisy Bloch arrows; 5
  decision wall at N0; 6 lever to N4 (flips); 7 mitigation ON (most return; cost grows); 8 verdict podium.
- Step forward with the A button or a pinch on "Next". The tour sets state; it never moves the user's head.

## 5. Interaction and comfort rules (mandatory)
- **Inputs.** Controllers and hand tracking both work (Quest 2 supports both): ray + trigger, or pinch.
  Every button ≥ 4 cm, lights on hover. Grab the plinth's edge with grip/pinch to move/rotate the lab;
  snap rotation 15°.
- **No locomotion and no camera motion.** Everything within reach or view from where the user stands. The
  wall arc sits at a fixed distance. (If you add an optional comfort vignette, keep it off by default.)
- **Placement and text.** Content 0.5–3 m away, between waist and eye height. Text never smaller than 1.2
  cm per metre of viewing distance. High contrast; never colour alone (noisy = dashed, mitigated = solid,
  flags carry a letter).
- **Desktop and projector mode (required).** Without WebXR, the same scene renders with `OrbitControls`
  and a bottom bar of HTML buttons: setting N0–N4, mitigation, split, tour next. Judges can watch on a
  laptop even if the headset fails.
- **Casting.** Document it in the README: Quest → phone app, or oculus.com/casting in a laptop browser.

## 6. Performance budget (Quest 2; the frame rate is how the app will be judged)
Quest 2 is a weaker GPU than Quest 3 — treat these as hard ceilings, not targets.

| Item | Budget (Quest 2) |
|---|---|
| Frame rate request | `frameRate: 'high'`; **must hold 72 fps (13.9 ms/frame)** in every scene — 72 is the ceiling target on Quest 2, not 90 |
| Draw calls | ≤ **100** in the worst scene (measure; log it) |
| Triangles | ≤ **750 k** visible |
| Orbs and sparks | 2 `InstancedMesh` total (90 orbs; 90 × 5 sparks), updated with matrices, not React re-renders |
| Text | ≤ **30** drei `<Text>` instances visible; reuse one font; no `<Html>` in XR |
| Materials | `MeshBasicMaterial` / `MeshLambertMaterial`; one shared glass material; no real-time shadows; no post-processing |
| Membrane | one plane with a small custom shader (fresnel + ripple uniforms from a ring buffer of ≤ 12 hits) |
| Framebuffer | `frameBufferScaling` default; you may drop to 0.9 if measured below 72; `foveation: 2` (higher than Quest 3 to save fill-rate) |
| Per-frame JS | ≤ 2 ms; precompute every position per (split, setting, mitigation) once at load |
| Assets | procedural geometry only; no downloaded models, HDRIs or textures except `linked.png` from the bundle |

Measure on the device with the OVR Metrics Tool performance HUD (or r3f-perf in desktop dev only). Put the
measured fps and draw calls for each scene in `vr/README.md`. If a scene can't hold 72 fps on Quest 2,
reduce sparks to the orbs' current-setting repeats only (still 2 instanced meshes) before cutting anything
that carries data.

## 7. Stack and setup
- **Stack.** Vite + React 19 + TypeScript + three + @react-three/fiber 9 + @react-three/drei 10 +
  @react-three/xr 6 + zustand 5. Check the installed versions' types before coding; if an API below
  differs, adapt it and log the change in `vr/DECISIONS.md`.
- **The XR store (Quest 2 = VR, no MR features):**
  ```ts
  createXRStore({
    emulate: 'metaQuest2',
    frameRate: 'high',       // Quest 2 tops out at 72 fps for scenes like this
    foveation: 2,            // higher than Quest 3 to protect fill-rate
    handTracking: true,
    offerSession: false,
    // No planeDetection / hitTest / anchors: unreliable/absent on Quest 2. The lab is virtual.
  })
  ```
- **Entering.** Call `store.enterVR()` (a dark virtual lab-room backdrop; **no passthrough**). If
  `immersive-vr` is unsupported, fall back to desktop mode. (Do not depend on `immersive-ar`/passthrough
  on Quest 2; if you want, offer AR only when `navigator.xr.isSessionSupported('immersive-ar')` is true,
  but VR is the default and the only supported path for judging.)
- Use `<XR store>`, `XROrigin`, and pointer events (`onClick`, `onPointerDown/Move/Up` with
  `setPointerCapture`) on meshes. Do **not** use `useXRPlanes` / `XRHitTest` / `useXRAnchor` — the lab is
  placed at a fixed virtual position with grab-to-move instead.
- **Scripts.**
  - `npm run sync` copies `../web/qure_bundle.json` to `vr/public/qure_bundle.json`.
  - `npm run dev` runs Vite with `@vitejs/plugin-basic-ssl` and `server.host = true`. Open
    `https://<laptop-LAN-IP>:5173` in the Quest browser and accept the certificate. WebXR needs HTTPS.
  - `npm run build` builds with `base: './'`, so `vr/dist` works under any subfolder.
- **Headset emulation on laptops.** The store's `emulate: 'metaQuest2'`, or Meta's Immersive Web Emulator
  extension.

## 8. Integration with the website (zero-friction contract)
1. Write only inside `vr/`. Do not edit `web/`, `src/`, `results/` or the bundle.
2. One state model, mirrored in the URL:
   `?case=<id>&n=<N0..N4>&mit=<0|1>&split=<val|test>&scene=<lab|wall|verdict>`. Read on load; write back
   with `history.replaceState`. The website links here as `vr/?case=<id>&n=<setting>&split=<split>`.
3. **Back link.** A "Back to console" button → `../index.html#cases` (or `VITE_WEB_URL`).
4. **Deploy layout.** A static host with HTTPS (GitHub Pages, Vercel or Netlify):
   `site/index.html ← web/index.html`; `site/qure_bundle.json ← web/qure_bundle.json`; `site/vr/… ← vr/dist/*`.
   Then rebuild the console with links on: `python tools/build_web_bundle.py --vr-url vr/`.
5. Re-running the experiment only regenerates `qure_bundle.json`; VR picks it up with no code change.

## 9. Code layout (vr/src/)
```
main.tsx  App.tsx
data/bundle.ts (types + loader + validation)  data/derive.ts (precomputed positions per split/setting/mit)
state/store.ts (zustand: caseId, setting, mitigation, split, scene, tourStep)  state/url.ts
xr/xrStore.ts  xr/Placement.tsx (fixed virtual position + grab-to-move; NO planes/hit-test)  xr/haptics.ts  xr/DesktopBar.tsx
scenes/LabAppears.tsx  scenes/CircuitSculpture.tsx  scenes/DecisionWall.tsx  scenes/Verdict.tsx  tour/Tour.tsx
three/BlochSphere.tsx  three/RepeatColumns.tsx  three/Membrane.tsx (shader)  three/OrbField.tsx (instanced)
ui3d/Button3D.tsx  ui3d/Lever3D.tsx  ui3d/Switch3D.tsx  ui3d/Panel3D.tsx
audio/sfx.ts (WebAudio-generated clicks; no files)
tests/derive.test.ts (vitest: gates reproduce nl; flip counts match summary; no value clipped)
```

## 10. Milestones (stop after each; give exact headset and desktop test steps)
| # | Done when |
|---|---|
| M1 | Scaffold, HTTPS dev, bundle loads and validates; desktop mode shows the plinth; Enter VR on Quest 2 shows the dark virtual lab room with the plinth at the fixed virtual position (grab-to-move works) |
| M2 | Scene A + B: the CT card, encoding strands, a circuit sculpture built from `circuit_gates`, Bloch spheres and repeat columns for any case; vitest passes |
| M3 | Scene C: the wall, 90 orbs + 450 sparks instanced, lever with detents and haptics, mitigation switch, flips punching through, U halos, counters and cost bar from data; **≥ 72 fps measured on Quest 2** |
| M4 | Scene D + tour + URL state + back link + desktop bar; deep link from the console opens the right case |
| M5 | Performance pass (log fps and draw calls per scene), README (devices, HTTPS, emulator, casting, controls, measured performance, known limits), build deployed under `site/vr/` |

## 11. Do NOT
- Do not invent data: no fake voxels, ZNE, QEC, molecules, AI explanations or mitigated Bloch arrows.
- Do not show or infer test labels.
- Do not clip mitigated values.
- Do not interpolate between noise settings, and do not let the lever rest between detents.
- Do not call U, Bloch length or glow a "trust", "confidence" or "accuracy" meter.
- Do not use smooth locomotion, move the camera, or auto-rotate the world in XR.
- Do not depend on Quest 2 passthrough / plane detection / anchors / hit-test; the lab is virtual.
- Do not use drei `<Html>` in XR, download external assets, or call any server or LLM.
- Do not claim quantum advantage, diagnosis, clinical validity, or that VR is proven better.
- Do not edit anything outside `vr/`.
