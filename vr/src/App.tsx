import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { XR, useXR } from '@react-three/xr';
import { useLab } from './state/store';
import { loadBundle, isSample } from './data/bundle';
import { derive } from './data/derive';
import { readUrlState, startUrlSync } from './state/url';
import { xrStore } from './xr/xrStore';
import { Placement } from './xr/Placement';
import { DesktopBar, SampleBanner } from './xr/DesktopBar';
import { Label } from './xr/Label';
import { LabAppears } from './scenes/LabAppears';
import { CircuitSculpture } from './scenes/CircuitSculpture';
import { ControlBoard } from './xr/ControlBoard';

function Room() {
  // dark virtual lab room: floor grid + faint walls. Procedural only, no assets.
  return (
    <group>
      <color attach="background" args={['#04060b']} />
      <fog attach="fog" args={['#04060b', 6, 14]} />
      <gridHelper args={[12, 24, '#1d4458', '#0e2230']} position={[0, 0, 0]} />
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[6, 6, 6, 32, 1, true]} />
        <meshBasicMaterial color="#070d17" side={2} />
      </mesh>
    </group>
  );
}

/** Loud, persistent banner inside the world (so it shows in the headset too). */
function SampleBannerInWorld() {
  const bundle = useLab((s) => s.bundle);
  if (!bundle || !isSample(bundle)) return null;
  return (
    <group>
      {/* in front, and behind-left/right so it is never out of view */}
      <Label text="SAMPLE DATA - not real results" width={1.6} px={72} bold color="#ffffff" bg="#b00020" position={[0, 2.35, -1.8]} />
      <Label text="SAMPLE DATA - not real results" width={0.9} px={72} bold color="#ffffff" bg="#b00020" position={[-1.4, 1.5, -0.6]} rotation={[0, Math.PI / 2.6, 0]} />
      <Label text="SAMPLE DATA - not real results" width={0.9} px={72} bold color="#ffffff" bg="#b00020" position={[1.4, 1.5, -0.6]} rotation={[0, -Math.PI / 2.6, 0]} />
    </group>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return <Label text={['QURE Lab XR cannot start', msg]} width={1.4} px={44} bg="#3a0a12" color="#ffd0d6" position={[0, 1.6, -1.5]} />;
}

function Controls() {
  const inXR = useXR((s) => !!s.session);
  return inXR ? null : <OrbitControls target={[0, 1.0, -0.6]} maxPolarAngle={Math.PI * 0.55} minDistance={0.4} maxDistance={4} />;
}

function World() {
  const loaded = useLab((s) => !!s.bundle);
  const err = useLab((s) => s.loadError);
  const scene = useLab((s) => s.scene);
  const view = useLab((s) => s.view);
  return (
    <>
      <Room />
      <ambientLight intensity={0.9} />
      <directionalLight position={[1, 3, 1]} intensity={0.8} />
      <SampleBannerInWorld />
      {err && <ErrorPanel msg={err} />}
      {loaded && (
        <Placement>
          {/* Scenes B (circuit), C (wall) and D (verdict) are built by other agents and mount here per `scene`. */}
          {scene === 'lab' && view === 'encode' && <LabAppears />}
          {scene === 'lab' && view === 'circuit' && <CircuitSculpture />}
          <ControlBoard />
        </Placement>
      )}
      <Controls />
    </>
  );
}

export default function App() {
  const err = useLab((s) => s.loadError);
  useEffect(() => {
    readUrlState();
    loadBundle()
      .then((b) => { const d = derive(b); useLab.getState().setLoaded(b, d); startUrlSync(); })
      .catch((e) => useLab.getState().setLoadError(String(e?.message ?? e)));
  }, []);
  return (
    <>
      <SampleBanner />
      {err && (
        <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 30, maxWidth: 560,
          background: '#3a0a12', color: '#ffd0d6', padding: '12px 16px', borderRadius: 8, font: '15px system-ui' }}>
          {err}
        </div>
      )}
      <Canvas camera={{ position: [0, 1.55, 0.9], fov: 60, near: 0.1, far: 35 }} gl={{ antialias: true }}
        onPointerMissed={() => {}}>
        <XR store={xrStore}>
          <World />
        </XR>
      </Canvas>
      <DesktopBar />
    </>
  );
}
