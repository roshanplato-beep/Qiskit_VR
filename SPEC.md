# QURE Lab — VR Mode Spec (source of truth)

> QURE = "cure" = Quantum Uncertainty-aware Research Environment.
> This file is the authoritative build spec. The user pasted it; god staged it here so the owner reads it from the repo, not from chat.

## Goal
Add a VR mode to the existing web app **QURE Lab**. VR must run in the **Meta Quest 2 browser over HTTPS** using **WebXR**. It is a *second view* over the same precomputed results as the website. It must **not** add a quantum engine and **not** call any backend at runtime.

Pitch line for VR: "Don't read how noisy a quantum computer is. Stand in it."

This is a **research prototype, not a diagnostic tool**. A plate reading **"Research prototype. Not a diagnosis."** must be visible in every VR scene.

## What QURE Lab is
A web app showing how far you can trust a quantum medical answer. A 4-qubit Qiskit classifier estimates whether a lung nodule (NoduleMNIST3D, 28x28x28 CT cube) is malignant. A noise slider degrades the answer (confidence drops, each qubit's Bloch arrow shrinks). Error mitigation (readout correction + zero-noise extrapolation) and a 3-qubit error-correction demo recover it. Every result is shown three ways (ideal, noisy, fixed) beside a classical model, with a trust verdict (Trust, Caution, Refer). All numbers are precomputed offline in Qiskit and saved as JSON.

## Hard constraints
- **Target device:** Meta Quest 2 (mobile GPU, 72 fps target). Performance beats visual richness. Drop effects before dropping frame rate.
- **Stack:** Vite, React, React Three Fiber, drei, @react-three/xr. Check the installed @react-three/xr version and follow its current docs (v6-style API is `createXRStore`, `<XR store={store}>`, `store.enterVR()`; verify against the installed version — API has changed between versions).
- **HTTPS:** WebXR needs HTTPS. Design for the deployed Vercel URL. For local headset testing use `vite --host` with a local HTTPS plugin, or `adb reverse` so localhost counts as secure. Document exact steps in the README.
- Page HTML does not appear inside the headset. All VR labels, cards and charts must be 3D text (drei `Text`) and plain meshes.
- Reuse the website's 3D components (nodule, Bloch spheres, verdict) as **shared components**. VR mode is a wrapper, not a rewrite.
- No locomotion, no teleport, no camera shake. Fixed spawn at standing height, with a seated option. The user turns to face stations.
- Controller ray + trigger + grip must be enough for everything. Hand tracking optional, never required.
- No flashing faster than 3 Hz. Smooth fades for colour changes.
- Text at least 2 degrees tall at arm's length, on curved panels facing the user.
- **No number may appear in the headset that did not come from the saved JSON.** If a noise level has no saved run, snap to the nearest one and show its true value.

## Data contract (read-only, fetched once at load)
Real files already exist in `web/public/data/`:
- `index.json` — patients list, `noise_p2` levels `[0, 0.01, 0.02, 0.04, 0.08]`, readout_error, zne_scales `[1,3]`, `circuit_cost_x: 3`, a `trust_rule` string, and model params (4 qubits, observable Z on qubit 0, `p_malignant = (1 - expZ)/2`, theta[]).
- `patients/nodule_*.json` — per patient: `sample_id`, `true_label`, `volume` path, `pca[4]`, `angles`, `classical {logreg_p, svm_p}`, `runs[5]`. Each run: `noise_p2`, `expZ {ideal,noisy,readout,zne}`, `p_malignant {ideal,noisy,mitigated}`, `bloch {ideal,noisy,mitigated}` (arrays of [x,y,z] per qubit).
- `metrics.json` — accuracy, F1, AUC, Brier per method and noise level.
- `qec.json` — physical error p vs unprotected/bit-flip/phase-flip logical fidelity, plus ~20 sampled syndrome events.
- `volumes/*.bin` — Uint8, 28x28x28 = 21,952 bytes each.

**Trust verdict:** spec says if a per-run `trust` field is missing, show a clearly-labelled placeholder and flag it in console; do NOT invent a rule. NOTE: the patient JSON has no per-run `trust` field, BUT `index.json` provides an explicit `trust_rule` string. Apply that documented rule (it is not invented). If `index.json.trust_rule` is ever absent, fall back to the placeholder behaviour.

## The VR world: one circular room, five stations
User stands in the middle and turns to face each station; everything reachable from spawn.

1. **Nodule Chamber.** 3D nodule floats at chest height on a pedestal. Grip to rotate; two-hand grip move apart/together to scale (clamped); drag a slice-plane handle to light a cross-section. A card shows patient ID + classical probability. A patient picker (point + trigger on cards) reloads everything from saved JSON.
2. **Quantum Core.** Four qubit spheres orbit a glowing ring, one per PCA feature, each holding a Bloch arrow from `bloch`. An Analyze button streams particles from the nodule into the spheres and settles the arrows. Show the ideal arrow as a faint ghost so the shrink is visible; label shrink as "relative to ideal" (entanglement already shortens the ideal arrow).
3. **Noise Storm (hero interaction).** A large physical dial with 5 detents, one per saved noise level. Turning it tints the room red, shrinks arrows, detunes the hum, updates the trust light. Snap to detents so shown value always matches a saved run exactly.
4. **Repair Bay.** A Mitigation pad (readout + ZNE): arrows regrow with a blue pulse, a badge shows the 3x circuit cost. An Error Correction pad opens a tank with 3 data qubits, 2 syndrome lights, 1 logical qubit; an error-rate lever replays saved syndrome events, shows the decoder fixing a flip, and shows the code failing past break-even.
5. **Verdict Deck.** A curved board with the trust triplet (ideal grey, noisy red, fixed blue) beside the classical model in white, the trust verdict (green/amber/red), and a one-line template explanation built from the numbers (no LLM). The research-prototype plate sits at the top.

## Colour code (same as website)
Ideal = grey. Noisy = red. Fixed (mitigated/corrected) = blue. Classical = white. Trust verdict = green/amber/red.

## Interactions
| Action | Control | Result |
|---|---|---|
| Pick a patient | Ray + trigger on a card | Everything reloads from saved JSON |
| Rotate nodule | Grip, turn wrist | Volume rotates |
| Scale nodule | Grip both hands, move apart/together | Clamped scale |
| Slice nodule | Drag slice-plane handle | Cross-section lights up |
| Analyze | Press button | Particle stream, arrows settle, verdict appears |
| Change noise | Grab dial, turn | Snaps to 1 of 5 saved runs, world updates |
| Mitigation on/off | Press pad | Fixed values replace noisy values, cost badge shows |
| Error Correction | Press pad, drag error-rate lever | Replays saved syndrome events |
| Reset | Press reset sphere | Starting patient, zero noise |

Every action gives a sound and a haptic pulse (controller haptics where available). A small floating hint tells a first-time user what to do next. One interaction per station.

## Sound (Web Audio API; start after first user gesture — entering VR counts)
One ambient hum, clean at zero noise, detunes smoothly as noise rises. Soft click at each dial detent. Rising tone for the mitigation pulse. Short chime per corrected error. Position sounds in space (dial sounds like it is at the dial).

## Performance budget (Quest 2)
- Steady 72 fps, measured **on the headset**, not the laptop.
- Do not draw all 21,952 voxels. Draw only voxels above a density threshold, as one instanced mesh with opaque materials. Threshold is a tunable constant.
- No transparency-heavy volumes, no post-processing, no real-time shadows, few draw calls, low-poly spheres, no large textures.
- If frame rate dips, remove in this order: audio detune, particle stream, room tint, Error Correction tank. **Never** remove the dial, the arrow shrink, or the trust light.

## Files to produce
- `web/src/vr/` with `VRRoom.jsx`, one component per station, `NoiseDial.jsx`, `useSavedResults.js` (loads + snaps JSON), `audio.js`, `vrConfig.js` (all thresholds + detent values in one place).
- An "Enter VR" button on the main site that calls the XR store's enter function; hidden when WebXR is unsupported.
- A README section: test on Quest 2 (enable developer mode in the Meta phone app, open the HTTPS URL in Quest Browser, or `adb reverse` for local); test without a headset (browser WebXR emulator); record a video from the headset.

## Build order (stop at any step and still have a working demo)
1. Enter-VR button, empty room, controllers visible; confirm it opens in the Quest 2 browser.
2. Nodule Chamber with thresholded voxels, grab + rotate.
3. Quantum Core with Bloch arrows from the JSON.
4. Noise dial with 5 detents driving arrows, tint, trust light.
5. Mitigation pad + Verdict Deck.
6. Error Correction tank, sounds, haptics, hints.
7. Frame-rate pass on the headset, then freeze.

## Acceptance checklist
- [ ] Opens from the public HTTPS URL in the Quest 2 browser and enters VR
- [ ] 72 fps at the busiest station, measured on the headset
- [ ] Dial, mitigation pad and Error Correction pad work with the controllers
- [ ] Every displayed number matches the saved JSON
- [ ] Research-prototype plate visible in every station
- [ ] No locomotion, no flashing, text readable
- [ ] Website still works unchanged

## Do not
- Do not call any server or run Qiskit at runtime.
- Do not invent numbers, verdict rules or results.
- Do not add features outside this list.
- Do not claim error correction repairs the scan, that quantum beats classical, or that VR is proven to improve diagnosis.

---
## Current state (assessed by god, 2026-10-06)
- DONE: offline data layer — `precompute/build.py`, `precompute/data/nodulemnist3d.npz`, and all files in `web/public/data/` (index/metrics/qec + 6 patients + 6 volumes). Data verified to load and contains real per-run values.
- NOT STARTED: the web app. `web/` contains only `public/`. No package.json, src, index.html, Vite config, node_modules, or any VR. The website shell and the entire VR mode are still to build.
- No git repo yet (`git init` recommended as the first step so work is committable/reviewable).
