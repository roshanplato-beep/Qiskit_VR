// App.jsx — the QURE Lab website shell. Hosts the R3F canvas and the
// WebXR "Enter VR" button. The button is hidden when WebXR immersive-vr is
// unsupported (SPEC). Page HTML never appears inside the headset; everything
// in VR is drawn by VRRoom.
//
// This increment keeps the site minimal (title, disclaimer, Enter VR). The
// full website view is a later dispatch.

import { Canvas } from '@react-three/fiber'
import { XR, createXRStore, useXRSessionModeSupported } from '@react-three/xr'
import VRRoom from './vr/VRRoom.jsx'
import { ROOM } from './vr/vrConfig.js'
import * as sfx from './vr/audio.js'

// One XR store for the app. The Enter-VR button calls store.enterVR().
const store = createXRStore()

export default function App() {
  const supported = useXRSessionModeSupported('immersive-vr')

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <h1>QURE Lab</h1>
          <p className="tagline">
            Quantum Uncertainty-aware Research Environment — how far can you trust a quantum
            medical answer?
          </p>
          <p className="disclaimer">Research prototype. Not a diagnosis.</p>
        </div>
        <div className="actions">
          {supported === true && (
            <button className="enter-vr" onClick={() => {
                sfx.init() // user gesture: unlock Web Audio
                store.enterVR()
              }}>
              Enter VR
            </button>
          )}
          {supported === false && (
            <span className="xr-note">WebXR VR not available in this browser.</span>
          )}
          {supported === undefined && <span className="xr-note">Checking for VR…</span>}
        </div>
      </header>

      <main className="stage">
        <Canvas
          camera={{ position: [0, ROOM.spawnHeight, 0.001], fov: 65, near: 0.1, far: 35 }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={['#0a0b0e']} />
          <XR store={store}>
            <VRRoom />
          </XR>
        </Canvas>
        <p className="stage-hint">
          Drag to look around (preview). Put on a Quest 2 and press <b>Enter VR</b> to stand inside.
        </p>
      </main>
    </div>
  )
}
