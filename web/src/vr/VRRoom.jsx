// VRRoom.jsx — QURE Lab as a RADIOLOGY READING ROOM (Quest 2 budget).
//
// PURPOSE: QURE Lab is an EXPLAINER, not a diagnostic tool. It shows how far
// you can trust a NOISY quantum computer's medical answer:
//   1. a quantum model reads a real CT lung nodule (CT viewer + lung),
//   2. hardware NOISE erodes its confidence (Bloch arrows shrink, verdict drops),
//   3. error mitigation (FIX) partially recovers it, beside a plain classical model.
//
// Layout from spawn (0,0,0), facing -Z:  desk + two monitors (quantum verdict
// left, classical comparison right), noise slider / FIX / Next patient on the
// desk strip, CT volume + slice slider centre, slice monitor + purpose poster
// on the back wall, lung on a stand left, 4-qubit analysis rack right.
// Left stick walks, right stick snap-turns. Every number comes from saved JSON.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { XROrigin, useXR, useXRControllerLocomotion } from '@react-three/xr'
import * as THREE from 'three'
import BlochArrow from '../components/BlochArrow.jsx'
import { Panel, Label, DisclaimerPlate } from '../components/Plate.jsx'
import * as sfx from './audio.js'
import { useSavedResults, resolveTrust } from './useSavedResults.js'
import CTVolume, { useSliceTexture } from './CTVolume.jsx'
import Lung from './Lung.jsx'
import { Shell, Desk, Monitor, WallScreen } from './Environment.jsx'
import {
  COLORS, ROOM, READING, DESK, CT, SLICE_MONITOR, LUNG, QUBITS, NOISE_TRACK, MOVE, NODULE, trustColor,
} from './vrConfig.js'

const WORD = { trust: 'TRUST', caution: 'CAUTION', refer: 'REFER' }
const MEANING = {
  trust: 'The answer is stable. Noise has barely moved it.',
  caution: 'The answer is shaky. Treat it with care.',
  refer: 'Too uncertain to lean on. A human expert should look.',
}
const pct = (p) => `${Math.round(p * 100)}%`
const GREY = new THREE.Color(COLORS.ideal)
const RED = new THREE.Color(COLORS.noisy)
const BACK_Z = READING.room.centerZ - READING.room.depth / 2

// Best-effort controller buzz (guarded: not every runtime exposes haptics).
function buzz(e) {
  try {
    const src = e?.inputSource ?? e?.nativeEvent?.inputSource ?? e?.pointerState?.inputSource
    const gp = src?.gamepad
    const act = gp?.hapticActuators?.[0] ?? gp?.vibrationActuator
    if (act?.pulse) act.pulse(0.5, 40)
    else if (act?.playEffect) act.playEffect('dual-rumble', { duration: 40, strongMagnitude: 0.5 })
  } catch {
    /* haptics are best-effort */
  }
}

function AudioBridge() {
  const inSession = useXR((s) => !!s.session)
  useEffect(() => {
    if (!inSession) return
    sfx.init()
    sfx.setListener({ x: 0, y: ROOM.spawnHeight, z: 0 }, { x: 0, y: 0, z: -1 })
    return () => sfx.stopHum()
  }, [inSession])
  return null
}

// Left stick = smooth walk, right stick = 30° snap turn. Drives the XROrigin,
// clamped to the room and kept out of the desk.
function Player() {
  const ref = useRef()
  useXRControllerLocomotion(
    ref,
    { speed: MOVE.speed },
    { type: 'snap', degrees: MOVE.snapDegrees, deadZone: MOVE.deadZone },
    'left'
  )
  useFrame(() => {
    const p = ref.current?.position
    if (!p) return
    const L = READING.limit
    p.x = Math.min(L.x, Math.max(-L.x, p.x))
    p.z = Math.min(L.zMax, Math.max(L.zMin, p.z))
    const d = READING.deskBox
    if (Math.abs(p.x - d.x) < d.hx && Math.abs(p.z - d.z) < d.hz) {
      p.z = p.z > d.z ? d.z + d.hz : d.z - d.hz
    }
  })
  return <XROrigin ref={ref} position={[0, 0, 0]} />
}

// A ray-draggable track: press/drag anywhere on it -> onValue(t in 0..1).
function DragTrack({ width, height = 0.3, onValue, children, ...props }) {
  const g = useRef()
  const down = useRef(false)
  const emit = (e) => {
    if (!g.current) return
    const x = g.current.worldToLocal(e.point.clone()).x
    onValue(Math.min(1, Math.max(0, (x + width / 2) / width)))
  }
  return (
    <group ref={g} {...props}>
      {children}
      <mesh
        position={[0, 0, 0.02]}
        onPointerDown={(e) => {
          e.stopPropagation()
          down.current = true
          buzz(e)
          emit(e)
        }}
        onPointerMove={(e) => down.current && emit(e)}
        onPointerUp={() => (down.current = false)}
        onPointerOut={() => (down.current = false)}
      >
        <planeGeometry args={[width + 0.1, height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Button({ position, width, height, color, onClick, children, size = 0.07 }) {
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          buzz(e)
          onClick()
        }}
      >
        <boxGeometry args={[width, height, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <Label size={size} color="#ffffff" maxWidth={width - 0.05} position={[0, 0, 0.03]}>{children}</Label>
    </group>
  )
}

// Knob that eases toward a target x.
function Knob({ x, color, radius }) {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current) ref.current.position.x += (x - ref.current.position.x) * Math.min(1, dt * NOISE_TRACK.damp)
  })
  return (
    <mesh ref={ref} position={[x, 0, 0.05]}>
      <sphereGeometry args={[radius, 16, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
    </mesh>
  )
}

// Desk control strip: Next patient | NOISE slider (5 saved levels) | FIX.
function ControlStrip({ noiseLevels, noiseIndex, setNoiseIndex, fixed, setFixed, onNextPatient }) {
  const n = noiseLevels.length
  const H = NOISE_TRACK.half
  const xOf = (i) => (n > 1 ? -H + (i * 2 * H) / (n - 1) : 0)
  const hot = n > 1 ? noiseIndex / (n - 1) : 0
  const knobColor = useMemo(() => '#' + GREY.clone().lerp(RED, hot).getHexString(), [hot])
  return (
    <group position={[0, DESK.top + 0.02, DESK.z + 0.22]} rotation={[-1.0, 0, 0]}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[3.0, 0.62, 0.03]} />
        <meshStandardMaterial color="#20242c" roughness={0.8} />
      </mesh>
      <Label size={0.065} color={COLORS.text} position={[0, 0.25, 0.0]} maxWidth={2.4}>
        NOISE: slide it right. More noise = the computer is less sure.
      </Label>
      <DragTrack
        width={H * 2}
        height={0.3}
        position={[0, -0.02, 0]}
        onValue={(t) => setNoiseIndex(Math.round(t * (n - 1)))}
      >
        <mesh>
          <boxGeometry args={[H * 2 + 0.1, 0.035, 0.02]} />
          <meshStandardMaterial color="#454c5b" />
        </mesh>
        {noiseLevels.map((lv, i) => (
          <group key={i} position={[xOf(i), 0, 0.015]}>
            <mesh>
              <sphereGeometry args={[NOISE_TRACK.markerRadius, 12, 10]} />
              <meshStandardMaterial color={i === 0 ? COLORS.ideal : COLORS.noisy} roughness={0.7} />
            </mesh>
            <Label size={0.06} color={COLORS.textDim} position={[0, -0.13, 0]} maxWidth={0.4}>
              {i === 0 ? 'none' : String(lv)}
            </Label>
          </group>
        ))}
        <Knob x={xOf(noiseIndex)} color={knobColor} radius={NOISE_TRACK.knobRadius} />
      </DragTrack>
      <Button position={[-1.2, -0.02, 0]} width={0.62} height={0.3} color="#3a4050" onClick={onNextPatient}>
        Next patient
      </Button>
      <Button
        position={[1.2, 0.04, 0]}
        width={0.62}
        height={0.3}
        color={fixed ? COLORS.fixed : '#2d3f63'}
        size={0.085}
        onClick={() => setFixed(!fixed)}
      >
        {fixed ? 'FIX: ON' : 'FIX: OFF'}
      </Button>
      <Label size={0.05} color={COLORS.textDim} position={[1.2, -0.17, 0]} maxWidth={0.64}>
        Fix = error mitigation
      </Label>
    </group>
  )
}

// Quantum monitor (desk, left): the verdict.
function QuantumMonitor({ run, model, fixed }) {
  if (!run) return <Label size={0.07} color={COLORS.textDim}>Loading saved results…</Label>
  const p = fixed ? run.p_malignant.mitigated : run.p_malignant.noisy
  const { verdict } = resolveTrust(run, fixed ? 'mitigated' : 'noisy')
  const vc = trustColor(verdict)
  const label = p >= 0.5 ? 'malignant' : 'benign'
  const sure = Math.max(p, 1 - p)
  return (
    <>
      <Label size={0.05} color={COLORS.textDim} position={[0, 0.26, 0]} maxWidth={0.95}>
        {`QUANTUM MODEL · ${model?.qubits ?? 4} qubits · ${fixed ? 'with FIX' : 'with noise'}`}
      </Label>
      <Label size={0.17} color={vc} position={[0, 0.1, 0]} maxWidth={0.95}>{WORD[verdict] ?? 'n/a'}</Label>
      <Label size={0.07} color={fixed ? COLORS.fixed : COLORS.text} position={[0, -0.06, 0]} maxWidth={0.95}>
        {`${pct(sure)} sure it is ${label}`}
      </Label>
      <Label size={0.052} color={COLORS.textDim} position={[0, -0.2, 0]} maxWidth={0.9}>
        {MEANING[verdict] ?? ''}
      </Label>
    </>
  )
}

// Classical comparison monitor (desk, right).
function ClassicalMonitor({ run, patient }) {
  const cls = patient?.classical
  if (!run) return null
  const rows = [
    ['Quantum, no noise', run.p_malignant.ideal, COLORS.ideal],
    ['Quantum, noisy', run.p_malignant.noisy, COLORS.noisy],
    ['Quantum, with FIX', run.p_malignant.mitigated, COLORS.fixed],
  ]
  return (
    <>
      <Label size={0.05} color={COLORS.textDim} position={[0, 0.26, 0]} maxWidth={0.95}>
        COMPARISON · chance it is malignant
      </Label>
      <Label size={0.065} color={COLORS.classical} position={[0, 0.14, 0]} maxWidth={0.95}>
        {cls ? `Normal computer: ${pct(cls.logreg_p)} (logistic) · ${pct(cls.svm_p)} (SVM)` : ''}
      </Label>
      {rows.map(([name, v, c], i) => (
        <Label key={name} size={0.058} color={c} position={[0, -i * 0.09, 0]} maxWidth={0.95}>
          {`${name}: ${pct(v)}`}
        </Label>
      ))}
      <Label size={0.045} color={COLORS.textDim} position={[0, -0.27, 0]} maxWidth={0.95}>
        Noise moves the quantum answer. It does not make it better than the normal model.
      </Label>
    </>
  )
}

function Qubit({ n, x, ideal, current, color }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh>
        <sphereGeometry args={[QUBITS.sphereRadius, 16, 12]} />
        <meshStandardMaterial color="#2b3350" roughness={0.4} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <group scale={QUBITS.arrowScale}>
        <BlochArrow vector={ideal} color={COLORS.ideal} ghost />
        <BlochArrow vector={current} color={color} />
      </group>
      <Label size={0.07} color={COLORS.text} position={[0, -QUBITS.sphereRadius - 0.1, 0]}>{`Qubit ${n}`}</Label>
    </group>
  )
}

// 4-qubit analysis rack, angled toward the spawn point.
function QubitRack({ run, fixed, noise01 }) {
  const bloch = run?.bloch
  const arrows = fixed ? bloch?.mitigated : bloch?.noisy
  const color = fixed ? COLORS.fixed : noise01 > 0 ? COLORS.noisy : COLORS.ideal
  const w = QUBITS.spacing * 3 + 0.5
  return (
    <group position={QUBITS.position} rotation={[0, QUBITS.yaw, 0]}>
      <mesh position={[0, 0.5, -0.08]}>
        <boxGeometry args={[0.1, 1.0, 0.1]} />
        <meshStandardMaterial color="#2f3541" />
      </mesh>
      <mesh position={[0, 0.95, -0.02]}>
        <boxGeometry args={[w, 0.06, 0.3]} />
        <meshStandardMaterial color="#3a404c" roughness={0.6} />
      </mesh>
      <group position={[0, QUBITS.height, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <Qubit
            key={i}
            n={i + 1}
            x={(i - 1.5) * QUBITS.spacing}
            ideal={bloch?.ideal?.[i]}
            current={arrows?.[i] ?? bloch?.ideal?.[i]}
            color={color}
          />
        ))}
      </group>
      <Label size={0.09} color={COLORS.accent} position={[0, 1.78, 0]} maxWidth={2.2}>
        QUBIT READOUT
      </Label>
      <Label size={0.075} color={COLORS.text} position={[0, 1.6, 0]} maxWidth={2.3}>
        4 qubits read the scan. Watch the arrows shrink as noise rises.
      </Label>
      <Label size={0.07} color={COLORS.textDim} position={[0, 0.78, 0]} maxWidth={2.3}>
        Grey ghost = ideal · Red = noisy · Blue = fixed
      </Label>
    </group>
  )
}

// Purpose poster, top of the back wall.
function Poster() {
  return (
    <group position={[0, 2.75, BACK_Z + 0.03]}>
      <Panel width={5.2} height={0.62} color="#12151b" opacity={1} />
      <Label size={0.15} color={COLORS.text} position={[0, 0.14, 0.003]} maxWidth={5}>
        1 READ the CT  →  2 add NOISE  →  3 press FIX
      </Label>
      <Label size={0.12} color={COLORS.accent} position={[0, -0.08, 0.003]} maxWidth={5}>
        QURE Lab explains how far you can trust a noisy quantum computer's medical answer.
      </Label>
      <Label size={0.1} color={COLORS.textDim} position={[0, -0.22, 0.003]} maxWidth={5}>
        Noisy quantum answers need error mitigation before you would trust them. Not a diagnostic tool.
      </Label>
    </group>
  )
}

// CT viewer: plinth, grayscale volume, slice slider.
function CTStation({ volume, slice, setSlice, texture, patient }) {
  const [x, y, z] = CT.position
  const half = CT.track.half
  const t = slice / (NODULE.dim - 1)
  return (
    <group>
      <mesh position={[x, 0.4, z]}>
        <boxGeometry args={[1.5, 0.8, 0.5]} />
        <meshStandardMaterial color="#2b303a" roughness={0.7} />
      </mesh>
      <group position={[x, y, z]} scale={CT.scale}>
        <CTVolume volume={volume} slice={slice} texture={texture} />
      </group>
      <group position={[x, 0.81, z + 0.1]} rotation={[-1.0, 0, 0]}>
        <Label size={0.085} color={COLORS.text} position={[0, 0.16, 0]} maxWidth={1.4}>
          {`CT slice ${slice + 1} of ${NODULE.dim} — drag to cut`}
        </Label>
        <DragTrack width={half * 2} height={0.26} position={[0, -0.04, 0]} onValue={(v) => setSlice(Math.round(v * (NODULE.dim - 1)))}>
          <mesh>
            <boxGeometry args={[half * 2, 0.03, 0.015]} />
            <meshStandardMaterial color="#454c5b" />
          </mesh>
          <mesh position={[(t - 0.5) * half * 2, 0, 0.03]}>
            <boxGeometry args={[0.06, 0.12, 0.05]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.4} />
          </mesh>
        </DragTrack>
      </group>
      <Label size={0.1} color={COLORS.accent} position={[x, 2.35, z]} maxWidth={1.6}>
        CT VOLUME
      </Label>
      <Label size={0.075} color={COLORS.textDim} position={[x, 2.22, z]} maxWidth={1.8}>
        {patient ? `patient ${patient.sample_id}` : ''}
      </Label>
    </group>
  )
}

function SliceMonitor({ texture, slice }) {
  const [x, y, z] = SLICE_MONITOR.position
  const s = SLICE_MONITOR.size
  return (
    <WallScreen position={[x, y, z]} width={s} height={s + 0.2}>
      <Label size={0.08} color={COLORS.accent} position={[0, s / 2 + 0.05, 0]} maxWidth={s}>
        CT SLICE (axial)
      </Label>
      <mesh>
        <planeGeometry args={[s - 0.1, s - 0.1]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Label size={0.07} color={COLORS.textDim} position={[0, -s / 2 - 0.04, 0]} maxWidth={s}>
        {`Slice ${slice + 1} of ${NODULE.dim} · real scan data`}
      </Label>
    </WallScreen>
  )
}

export default function VRRoom() {
  const data = useSavedResults()
  const inVR = useXR((s) => !!s.session)
  const [fixed, setFixed] = useState(false)
  const [slice, setSlice] = useState(CT.startSlice)
  const texture = useSliceTexture(data.volume, slice)
  const n = data.noiseLevels.length
  const noise01 = n > 1 ? data.noiseIndex / (n - 1) : 0
  const deskPos = { x: 0, y: 1, z: DESK.z }

  useEffect(() => {
    if (inVR) sfx.ambientHum(fixed ? 0 : noise01, deskPos)
  }, [inVR, noise01, fixed])
  const setNoiseIndex = (i) => {
    if (i !== data.noiseIndex) sfx.detentClick(deskPos)
    data.setNoiseIndex(i)
  }
  const toggleFix = (v) => {
    if (v) sfx.mitigationRise(deskPos)
    setFixed(v)
  }
  const nextPatient = () => {
    const ps = data.patients
    if (ps.length) data.setPatientId(ps[(ps.indexOf(data.patientId) + 1) % ps.length])
  }

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#aeb9d6', '#1a1d24', 0.5]} />
      <directionalLight position={[1.5, 3, 2]} intensity={0.45} />
      <pointLight position={[0, 1.7, -2.4]} intensity={0.5} color="#ffe2b8" distance={6} />

      <Shell tint={fixed ? 0 : noise01} />
      <Desk />
      <AudioBridge />
      <Player />

      {/* desktop preview only (disabled inside a session) */}
      <OrbitControls makeDefault enabled={!inVR} target={[0, 1.5, -3]} enablePan={false} minDistance={0.2} maxDistance={4} />

      {data.error ? (
        <Label size={0.12} color={COLORS.noisy} position={[0, 1.6, -2]}>
          {`Data failed to load:\n${data.error.message}`}
        </Label>
      ) : (
        <>
          <Poster />
          <CTStation volume={data.volume} slice={slice} setSlice={setSlice} texture={texture} patient={data.patient} />
          <SliceMonitor texture={texture} slice={slice} />

          <group position={[LUNG.position[0], 0, LUNG.position[2]]} rotation={[0, LUNG.yaw, 0]}>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.28, 0.3, 0.04, 20]} />
              <meshStandardMaterial color="#2b303a" />
            </mesh>
            <mesh position={[0, LUNG.position[1] / 2 - 0.2, 0]}>
              <cylinderGeometry args={[0.025, 0.025, LUNG.position[1] - 0.4, 8]} />
              <meshStandardMaterial color="#3a404c" />
            </mesh>
            <group position={[0, LUNG.position[1], 0]} scale={LUNG.scale}>
              <Lung />
              <Label size={0.1} color={COLORS.accent} position={[0, 0.72, 0.1]} maxWidth={1.6}>
                LUNG (orientation only)
              </Label>
              <Label size={0.085} color={COLORS.textDim} position={[0, -0.7, 0.1]} maxWidth={1.8}>
                Glow = where the nodule sits
              </Label>
            </group>
          </group>

          <Monitor position={[-1.15, 1.2, DESK.z - 0.2]} yaw={0.3} width={1.0} height={0.62}>
            <QuantumMonitor run={data.run} model={data.model} fixed={fixed} />
          </Monitor>
          <Monitor position={[1.15, 1.2, DESK.z - 0.2]} yaw={-0.3} width={1.0} height={0.62}>
            <ClassicalMonitor run={data.run} patient={data.patient} />
          </Monitor>

          <ControlStrip
            noiseLevels={data.noiseLevels}
            noiseIndex={data.noiseIndex}
            setNoiseIndex={setNoiseIndex}
            fixed={fixed}
            setFixed={toggleFix}
            onNextPatient={nextPatient}
          />

          <QubitRack run={data.run} fixed={fixed} noise01={noise01} />

          <DisclaimerPlate position={[0, 0.92, DESK.z + 0.6]} rotation={[-1.0, 0, 0]} />
          <DisclaimerPlate position={[0, 3.0, BACK_Z + 0.03]} scale={[1.8, 1.8, 1]} />
        </>
      )}
    </>
  )
}
