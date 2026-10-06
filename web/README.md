# QURE Lab — web app

React + Vite + React Three Fiber + WebXR. All numbers are precomputed offline
(Qiskit) and loaded from `public/data/`; there is no backend at runtime.

    npm install
    npm run dev      # local dev server
    npm run build    # production build into dist/

## VR (WebXR)

**WebXR requires HTTPS** (`localhost` counts as secure on the same machine
only). For a headset, use the deployed HTTPS URL (the Vercel deployment).

### Test on a Quest 2

1. Enable developer mode: in the Meta Horizon phone app go to
   *Menu → Devices → your headset → Headset Settings → Developer Mode* and
   switch it on (a Meta developer account is needed once).
2. Put the headset on, open **Quest Browser**, and go to the deployed HTTPS URL.
3. Press **Enter VR**. You spawn in the room centre at standing height; turn to
   face each station (no locomotion).

To use a local dev server instead of the deployed URL (headset on USB, `adb`
installed, USB debugging allowed in the headset):

    adb devices                      # headset must be listed
    adb reverse tcp:5173 tcp:5173
    npm run dev

then open `http://localhost:5173` in Quest Browser. Through the reverse tunnel
the headset sees the page as `localhost`, which WebXR treats as a secure
origin, so no certificate is needed.

### Test without a headset

Install the **Immersive Web Emulator** (Meta) or **WebXR API Emulator**
browser extension, open the page, pick a headset device (e.g. Quest 2) in the
extension panel, then press **Enter VR**. Move the emulated headset and
controllers from the panel. Outside a session, drag with the mouse to orbit
the preview.

### Record a video from the headset

- On the Quest: press the Meta button, then *Sharing → Record video* (or
  *Cast* to a phone or PC). Recordings appear in the Meta Horizon phone app, or
  copy them over USB from `Oculus/VideoShots`.
- From a PC over USB: `scrcpy --record vr.mp4` mirrors and records the view.

### Notes

- Every scene shows "Research prototype. Not a diagnosis."
- The VR view shows saved precomputed results. It makes no claim that VR
  improves diagnosis or that quantum beats classical.
