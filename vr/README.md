# QURE Lab XR — Quest 2 (VR)

A virtual-reality lab for the Meta Quest 2 / 2 Pro browser that plays back the quantum
classifier's recorded results (decision wall, circuit sculpture, Bloch arrows, verdict podium,
guided tour). Separate static app in `vr/`; reads the website's `qure_bundle.json`. Built per
`../PROMPT5_QUEST2.md`.

## Status
- Scenes A–E complete: Lab appears, Circuit sculpture, Decision wall, Verdict podium, Guided tour.
- Desktop fallback (OrbitControls + bottom button bar) works without a headset.
- Tests: `npx vitest run` → 18 passing (gates reproduce `nl`; flip counts; no value clipped; scene smoke tests).

## ⚠️ Data: currently SAMPLE, not real
The real `web/qure_bundle.json` (v0.2.x) is **not in the repo yet**, so the app ships with a
clearly-labelled **sample** bundle (`vr/public/qure_bundle.json`, `bundle_version: 0.2.1-sample`,
`_sample: true`). A loud red **"SAMPLE DATA — not real results"** banner shows in-world and on
desktop. To use real data:
```
# place the real file at web/qure_bundle.json, then:
cd vr && npm run sync   # copies ../web/qure_bundle.json -> vr/public/qure_bundle.json
```
No code change needed; the banner disappears once the bundle is real (version without "sample",
no `_sample`).

## Run in VR on a Quest 2 (WebXR needs HTTPS)
```
cd vr
npm install
npm run dev            # Vite + basic-ssl, server.host=true
```
1. Note your laptop's LAN IP (e.g. `192.168.1.23`). Laptop and Quest 2 must be on the same Wi-Fi.
2. In the **Quest 2 Browser**, open `https://<LAN-IP>:5173` and **accept the self-signed cert**.
3. Press **Enter VR**. A dark virtual lab room appears with the plinth in front.
   - Left/right: no locomotion — turn your head / use the snap-rotate buttons on the plinth.
   - Controllers or hands: ray + trigger, or pinch. Grab the plinth edge to move/rotate the lab.

Alternative (no headset): just open `http://localhost:5173` on a laptop → desktop mode with
OrbitControls and the bottom button bar (setting N0–N4, mitigation, split, tour next).

## Deploy (for a shareable HTTPS URL)
```
cd vr && npm run build        # base: './', outputs vr/dist
```
Host `vr/dist` on any HTTPS static host (Vercel/Netlify/GitHub Pages). On Vercel, create a project
with **root directory = `vr`**. Per the spec's deploy layout, the console (`web/`) and
`qure_bundle.json` sit alongside `vr/` so the console's "Open 3D lab" links resolve.

## Casting (to show others)
- Quest → **Meta Quest** phone app → Cast.
- Or a laptop browser at `oculus.com/casting` (log in with the headset's account).

## Controls
| Action | Controller | Hands |
|---|---|---|
| Point / select | ray + trigger | pinch |
| Move/rotate lab | grab plinth edge (grip) | pinch-grab edge |
| Noise level | drag the lever to a detent (N0–N4) | pinch-drag |
| Mitigation on/off | press the switch | pinch |
| Inspect a case | point an orb + trigger | pinch |
| Tour next | A button | pinch "Next" |

## Performance (Quest 2 ceilings: ≤100 draw calls, ≤750k tris, 72 fps)
- Orbs (90) + sparks (450) are **2 `InstancedMesh`** total, matrix-updated (no React re-renders).
- `MeshBasic`/`Lambert` materials, one shared glass material, no shadows, no post-processing.
- Canvas-text labels (`xr/Text.tsx`) — no network fonts, no drei `<Html>`.
- A `PerfProbe` logs frame time in dev.
- **fps and draw calls still to be measured on-device** with the OVR Metrics Tool — not yet run on a
  physical Quest 2. Record the numbers here after the first headset session.

## Known limits
- Sample data until the real bundle is added (see above).
- Not yet verified on a physical Quest 2 (built + desktop-tested only).
- The old NoduleMNIST web VR under `web/src/vr/` has not been archived yet (kept to avoid breaking
  the existing `web/` build); it is unrelated to this app.
