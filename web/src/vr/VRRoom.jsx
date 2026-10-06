// VRRoom.jsx — "One Giant Scan": a single walkable room. The patient's lung
// scan floats room-sized in front of the user, 4 qubit spheres orbit it, one
// noise slider + one Fix button sit on a desk, and a big wall panel gives the
// verdict. Left stick walks, right stick snap-turns (30°). Every number comes
// from the saved JSON (useSavedResults); nothing is invented here.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, OrbitControls } from '@react-three/drei'
import { XROrigin, useXR, useXRControllerLocomotion } from '@react-three/xr'
import * as THREE from 'three'
import NoduleVoxels from '../components/NoduleVoxels.jsx'
import BlochArrow from '../components/BlochArrow.jsx'
import { Panel, Label, DisclaimerPlate } from '../components/Plate.jsx'
import * as sfx from './audio.js'
import { useSavedResults, resolveTrust } from './useSavedResults.js'
import { COLORS, ROOM, SCAN, ORBIT, CONSOLE, MOVE, WALL, trustColor } from './vrConfig.js'

const WORD = { trust: 'TRUST', caution: 'CAUTION', refer: 'REFER' }
const MEANING = {
  trust: 'The answer is stable. Noise has barely moved it.',
  caution: 'The answer is shaky. Treat it with care.',
  refer: 'Too uncertain to lean on. A human expert should look.',
}
const pct = (p) => `${Math.round(p * 100)}%`
const TISSUE = new THREE.Color('#cbb7a6')
const RED = new THREE.Color('#e2504a')
const GREY = new THREE.Color(COLORS.ideal)

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

// Starts audio when an XR session begins; the Enter VR button also inits it.
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

// Left stick = smooth walk, right stick = 30° snap turn. Drives the XROrigin.
function Player() {
  const ref = useRef()
  useXRControllerLocomotion(
    ref,
    { speed: MOVE.speed },
    { type: 'snap', degrees: MOVE.snapDegrees, deadZone: MOVE.deadZone },
    'left'
  )
  // keep the player inside the room
  useFrame(() => {
    const p = ref.current?.position
    if (!p) return
    p.x = Math.min(ROOM.limitX, Math.max(-ROOM.limitX, p.x))
    p.z = Math.min(ROOM.limitZMax, Math.max(ROOM.limitZMin, p.z))
  })
  return <XROrigin ref={ref} position={[0, 0, 0]} />
}

function Room({ tint }) {
  const light = useRef()
  useFrame((_, dt) => {
    if (light.current) light.current.intensity += (tint * 1.4 - light.current.intensity) * Math.min(1, dt * 3)
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM.centerZ]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={COLORS.roomFloor} roughness={1} />
      </mesh>
      <mesh position={[0, ROOM.height / 2, ROOM.centerZ]}>
        <boxGeometry args={[ROOM.width, ROOM.height, ROOM.depth]} />
        <meshStandardMaterial color={COLORS.roomWall} roughness={1} side={THREE.BackSide} />
      </mesh>
      <pointLight ref={light} position={[0, 3, -3.6]} intensity={0} color="#e2504a" distance={9} />
    </group>
  )
}

function Qubit({ n, angle, ideal, current, color }) {
  return (
    <group position={[Math.cos(angle) * ORBIT.radius, 0, Math.sin(angle) * ORBIT.radius]}>
      <mesh>
        <sphereGeometry args={[ORBIT.sphereRadius, 16, 12]} />
        <meshStandardMaterial color="#2b3350" roughness={0.4} transparent opacity={0.3} />
      </mesh>
      <group scale={ORBIT.arrowScale}>
        <BlochArrow vector={ideal} color={COLORS.ideal} ghost />
        <BlochArrow vector={current} color={color} />
      </group>
      <Billboard lockX lockZ position={[0, ORBIT.sphereRadius + 0.22, 0]}>
        <Label size={0.16} color={COLORS.text}>{`Qubit ${n}`}</Label>
      </Billboard>
    </group>
  )
}

// Scan + the 4 orbiting qubits.
function Scan({ volume, run, fixed, noise01 }) {
  const spin = useRef()
  const orbit = useRef()
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * SCAN.spin
    if (orbit.current) orbit.current.rotation.y += dt * ORBIT.speed
  })
  const bloch = run?.bloch
  const arrows = fixed ? bloch?.mitigated : bloch?.noisy
  const color = fixed ? COLORS.fixed : noise01 > 0 ? COLORS.noisy : COLORS.ideal
  const tissue = useMemo(
    () => '#' + TISSUE.clone().lerp(RED, fixed ? 0 : noise01 * 0.55).getHexString(),
    [noise01, fixed]
  )
  return (
    <group position={SCAN.position}>
      <group ref={spin} scale={SCAN.scale}>
        <NoduleVoxels volume={volume} color={tissue} />
      </group>
      <group ref={orbit}>
        {[0, 1, 2, 3].map((i) => (
          <Qubit
            key={i}
            n={i + 1}
            angle={(i / 4) * Math.PI * 2}
            ideal={bloch?.ideal?.[i]}
            current={arrows?.[i] ?? bloch?.ideal?.[i]}
            color={color}
          />
        ))}
      </group>
    </group>
  )
}

function Caption({ position, size = 0.14, color = COLORS.text, width = 3.2, children }) {
  return (
    <Billboard lockX lockZ position={position}>
      <Label size={size} color={color} maxWidth={width}>{children}</Label>
    </Billboard>
  )
}

function Button({ position, width, height, color, onClick, children, size = 0.09 }) {
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          buzz(e)
          onClick()
        }}
      >
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <Label size={size} color="#ffffff" maxWidth={width - 0.06} position={[0, 0, 0.03]}>{children}</Label>
    </group>
  )
}

// The one noise control: a slider with one detent per SAVED noise level.
function Desk({ noiseLevels, noiseIndex, setNoiseIndex, fixed, setFixed, onNextPatient }) {
  const n = noiseLevels.length
  const knob = useRef()
  const xOf = (i) => (n > 1 ? -CONSOLE.trackHalf + (i * 2 * CONSOLE.trackHalf) / (n - 1) : 0)
  useFrame((_, dt) => {
    const k = knob.current
    if (k) k.position.x += (xOf(noiseIndex) - k.position.x) * Math.min(1, dt * CONSOLE.knobDamp)
  })
  const hot = n > 1 ? noiseIndex / (n - 1) : 0
  const knobColor = useMemo(() => '#' + GREY.clone().lerp(RED, hot).getHexString(), [hot])
  return (
    <group position={CONSOLE.position} rotation={[CONSOLE.tilt, 0, 0]}>
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[4.2, 1.0, 0.06]} />
        <meshStandardMaterial color={COLORS.pedestal} roughness={0.9} />
      </mesh>
      <Label size={0.1} color={COLORS.text} position={[0, 0.4, 0.01]} maxWidth={3.6}>
        NOISE: slide it up. More noise = the computer is less sure.
      </Label>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[CONSOLE.trackHalf * 2 + 0.1, 0.05, 0.03]} />
        <meshStandardMaterial color="#444b5a" />
      </mesh>
      {noiseLevels.map((lv, i) => (
        <group key={i} position={[xOf(i), 0.05, 0.02]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation()
              buzz(e)
              setNoiseIndex(i)
            }}
          >
            <sphereGeometry args={[CONSOLE.markerRadius, 12, 10]} />
            <meshStandardMaterial color={i === 0 ? COLORS.ideal : COLORS.noisy} roughness={0.7} />
          </mesh>
          <Label size={0.08} color={COLORS.textDim} position={[0, -0.2, 0]} maxWidth={0.4}>
            {i === 0 ? 'none' : String(lv)}
          </Label>
        </group>
      ))}
      <mesh ref={knob} position={[xOf(noiseIndex), 0.05, 0.08]}>
        <sphereGeometry args={[CONSOLE.knobRadius, 16, 12]} />
        <meshStandardMaterial color={knobColor} emissive={knobColor} emissiveIntensity={0.35} />
      </mesh>
      <Button position={[-1.65, 0.05, 0.02]} width={0.8} height={0.34} color="#3a4050" size={0.07} onClick={onNextPatient}>
        Next patient
      </Button>
      <Button
        position={[1.55, 0.05, 0.02]}
        width={0.9}
        height={0.4}
        color={fixed ? COLORS.fixed : '#2d3f63'}
        size={0.11}
        onClick={() => setFixed(!fixed)}
      >
        {fixed ? 'FIX: ON' : 'FIX: OFF'}
      </Button>
      <Label size={0.075} color={COLORS.textDim} position={[1.55, -0.3, 0.01]} maxWidth={1.1}>
        Fix = error mitigation recovers the answer
      </Label>
    </group>
  )
}

// Big verdict panel on the back wall.
function VerdictWall({ run, patient, model, fixed }) {
  if (!run) {
    return (
      <Label size={0.2} color={COLORS.textDim} position={[0, WALL.y, WALL.z + 0.02]}>
        Loading saved results…
      </Label>
    )
  }
  const p = fixed ? run.p_malignant.mitigated : run.p_malignant.noisy
  const { verdict } = resolveTrust(run, fixed ? 'mitigated' : 'noisy')
  const vc = trustColor(verdict)
  const label = p >= 0.5 ? 'malignant' : 'benign'
  const sure = Math.max(p, 1 - p)
  const cls = patient?.classical
  return (
    <group position={[0, WALL.y, WALL.z + 0.03]}>
      <Panel width={WALL.width} height={WALL.height} color="#1b1e25" opacity={1} />
      <Label size={0.42} color={vc} position={[-1.35, 0.55, 0.01]} maxWidth={2.2}>
        {WORD[verdict] ?? 'n/a'}
      </Label>
      <mesh position={[-2.1, -0.15, 0.01]}>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color={vc} />
      </mesh>
      <Label size={0.13} color={COLORS.text} position={[-1.2, -0.15, 0.01]} maxWidth={1.9}>
        {MEANING[verdict] ?? ''}
      </Label>
      <Label size={0.17} color={fixed ? COLORS.fixed : COLORS.text} position={[1.15, 0.55, 0.01]} maxWidth={2.2}>
        {`Quantum model: ${pct(sure)} sure it is ${label}`}
      </Label>
      <Label size={0.1} color={COLORS.textDim} position={[1.15, 0.2, 0.01]} maxWidth={2.2}>
        {`${pct(p)} malignant · ${fixed ? 'with Fix' : 'with noise'} · ${model?.qubits ?? 4} qubits`}
      </Label>
      <Label size={0.15} color={COLORS.classical} position={[1.15, -0.4, 0.01]} maxWidth={2.2}>
        {cls ? `Normal computer model: ${pct(cls.logreg_p)} malignant (logistic) · ${pct(cls.svm_p)} (SVM)` : ''}
      </Label>
      <Label size={0.1} color={COLORS.textDim} position={[0, -0.92, 0.01]} maxWidth={4.2}>
        This is a research demo that shows how noise changes a quantum answer. It does not say who is ill.
      </Label>
    </group>
  )
}

export default function VRRoom() {
  const data = useSavedResults()
  const inVR = useXR((s) => !!s.session)
  const [fixed, setFixed] = useState(false)
  const n = data.noiseLevels.length
  const noise01 = n > 1 ? data.noiseIndex / (n - 1) : 0

  // audio hooks: hum follows noise, click on detent, rise on Fix
  useEffect(() => {
    if (inVR) sfx.ambientHum(fixed ? 0 : noise01, { x: 0, y: 1, z: -1.5 })
  }, [inVR, noise01, fixed])
  const setNoiseIndex = (i) => {
    if (i !== data.noiseIndex) sfx.detentClick({ x: 0, y: 1, z: -1.5 })
    data.setNoiseIndex(i)
  }
  const toggleFix = (v) => {
    if (v) sfx.mitigationRise({ x: 1.5, y: 1, z: -1.5 })
    setFixed(v)
  }
  const nextPatient = () => {
    const ps = data.patients
    if (ps.length) data.setPatientId(ps[(ps.indexOf(data.patientId) + 1) % ps.length])
  }

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 4, 2]} intensity={0.7} />
      <pointLight position={[0, 2.6, -1]} intensity={0.5} color={COLORS.accent} />

      <Room tint={fixed ? 0 : noise01} />
      <AudioBridge />
      <Player />

      {/* desktop preview only (disabled inside a session) */}
      <OrbitControls
        makeDefault
        enabled={!inVR}
        target={[0, 1.5, -3]}
        enablePan={false}
        minDistance={0.2}
        maxDistance={4}
      />

      {data.error ? (
        <Label size={0.12} color={COLORS.noisy} position={[0, 1.6, -2]}>
          {`Data failed to load:\n${data.error.message}`}
        </Label>
      ) : (
        <>
          <Scan volume={data.volume} run={data.run} fixed={fixed} noise01={noise01} />

          <Caption position={[0, 3.35, -3.6]} size={0.2}>
            This is the patient's lung scan
          </Caption>
          <Caption position={[0, 0.7, -2.4]} size={0.13} color={COLORS.textDim} width={4}>
            These 4 qubits read the scan. Watch their arrows shrink as noise rises.
          </Caption>
          <Caption position={[3.4, 1.6, -3.4]} size={0.13} color={COLORS.textDim} width={1.8}>
            Grey ghost arrow = ideal. Red = noisy. Blue = fixed.
          </Caption>

          <Desk
            noiseLevels={data.noiseLevels}
            noiseIndex={data.noiseIndex}
            setNoiseIndex={setNoiseIndex}
            fixed={fixed}
            setFixed={toggleFix}
            onNextPatient={nextPatient}
          />

          <VerdictWall run={data.run} patient={data.patient} model={data.model} fixed={fixed} />
          <Caption position={[0, 3.85, WALL.z + 0.2]} size={0.16}>
            The verdict: can you trust the quantum answer?
          </Caption>

          <DisclaimerPlate position={[0, 3.0, WALL.z + 0.05]} />
          <DisclaimerPlate position={[0, 0.3, -0.9]} rotation={[-Math.PI / 2.4, 0, 0]} />
        </>
      )}
    </>
  )
}
