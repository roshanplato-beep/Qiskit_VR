# DECISIONS (vr/)

- Installed: react 19.3, three 0.186, @react-three/fiber 9.8, drei 10.7, @react-three/xr 6.6.31, zustand 5.0, vite 8, vitest 5, typescript 7.
- `foveation`: spec says 2, but @react-three/xr 6.6 documents foveation as 0..1. Using `foveation: 1` (maximum).
- `emulate: 'metaQuest2'` is accepted by createXRStore (emulates only when WebXR is unsupported on localhost).
- Text: drei `<Text>` (troika) downloads its default font from a CDN at runtime, which breaks "no external assets". All labels use `xr/Label.tsx` (canvas texture on a plane) instead.
- CT card: the bundle carries no nodule mask, so the card gets a plain cyan frame. No outline is invented.
- Sample data: `tools/make_sample_bundle.mjs` writes `vr/public/qure_bundle.json` (`_sample: true`, version `0.2.1-sample`). A red SAMPLE DATA banner shows in the page and in-world while it is active. `npm run sync` copies the real `../web/qure_bundle.json` over it.
- Sample numbers are synthetic; only `nl`, `abl`, Bloch vectors b0 and circuit_gates come from a real RY/CX simulation.
- Loader: a wrong bundle_version / bad shape is a hard error (in-world panel + HTML box), not a fallthrough to the next URL.
- Grab-to-move: edge frame of the plinth, pointer ray intersected with the plinth-top plane; rotation by two 15-degree snap buttons.
