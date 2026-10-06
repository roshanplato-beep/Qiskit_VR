// NoiseStorm.jsx — SPEC station 3 (hero interaction). A big physical dial with
// exactly one detent per saved noise level. The dial only ever SETS noiseIndex
// (setNoiseIndex), so the shown value is always a real saved run; QuantumCore
// already reads the snapped run, so the arrows shrink automatically.
//
// Controls: grip (squeeze) near the dial and turn your hand around it, or
// ray + trigger on a detent marker (also works with a mouse on desktop).
// Everything fades with damping; nothing blinks (well under 3 Hz).

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { Panel, Label } from '../components/Plate.jsx'
import { Hint } from './helpers.jsx'
import { resolveTrust } from './useSavedResults.js'
import { DIAL, COLORS, trustColor } from './vrConfig.js'
import * as sfx from './audio.js'
import { stationWorld } from './stationPos.js'

const ARC = (DIAL.arcDeg * Math.PI) / 180
const _p = new THREE.Vector3()
const _c = new THREE.Color()
const DIAL_POS = stationWorld('noiseStorm', [0, DIAL.centerHeight, 0])
const BASE_BG = new THREE.Color(COLORS.roomWall)
const RED_BG = new THREE.Color('#3a1412')

// Knob angle (rotation about Z, 0 = up, CCW positive) for a detent index.
// Index 0 (lowest noise) sits at the left, the last detent at the right.
const detentAngle = (i, n) => (n > 1 ? ARC / 2 - (i * ARC) / (n - 1) : 0)

function pulse(src) {
  try {
    const gp = src?.inputSource?.gamepad ?? src?.gamepad
    const act = gp?.hapticActuators?.[0] ?? gp?.vibrationActuator
    if (act?.pulse) act.pulse(DIAL.hapticStrength, DIAL.hapticMs)
    else if (act?.playEffect)
      act.playEffect('dual-rumble', { duration: DIAL.hapticMs, strongMagnitude: DIAL.hapticStrength })
  } catch {
    /* haptics are best-effort */
  }
}

export default function NoiseStorm({ noiseIndex, setNoiseIndex, noiseLevels = [], noiseValue, run }) {
  const n = noiseLevels.length
  const scene = useThree((s) => s.scene)
  const root = useRef()
  const knob = useRef()
  const light = useRef()
  const lamp = useRef()
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')

  const angle = useRef(detentAngle(noiseIndex, n)) // current visual knob angle
  const target = useRef(angle.current) // where the knob is heading
  const grabbing = useRef(null) // 'left' | 'right' | null
  const level = useRef(n > 1 ? noiseIndex / (n - 1) : 0) // smoothed 0..1 storm level
  const lampColor = useRef(new THREE.Color(trustColor('n/a')))

  const verdict = run ? resolveTrust(run, 'noisy').verdict : 'n/a'
  const verdictRef = useRef(verdict)
  verdictRef.current = verdict
  const indexRef = useRef(noiseIndex)
  indexRef.current = noiseIndex

  // Audio: hum tracks noise (clean at 0); detent click on each change. No-ops
  // until sfx.init() has run (Enter VR click / XR session start).
  const inSession = useXR((s) => !!s.session)
  const maxNoise = n ? noiseLevels[n - 1] : 0
  const noise01 = maxNoise > 0 && typeof noiseValue === 'number' ? noiseValue / maxNoise : 0
  const firstIdx = useRef(true)
  useEffect(() => {
    if (inSession) sfx.ambientHum(noise01, DIAL_POS)
  }, [noise01, inSession])
  useEffect(() => {
    if (firstIdx.current) {
      firstIdx.current = false
      return
    }
    sfx.detentClick(DIAL_POS)
  }, [noiseIndex])

  // Select a detent: only ever a real saved level index.
  const choose = (i, src) => {
    if (i === indexRef.current || i < 0 || i >= n) return
    indexRef.current = i
    setNoiseIndex(i)
    if (src) pulse(src)
    else {
      pulse(left)
      pulse(right)
    }
  }

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05)

    // --- grip to turn ---------------------------------------------------
    const pressed = (c) => c?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
    const near = (c) => {
      const o = c?.object
      if (!o || !root.current) return false
      o.getWorldPosition(_p)
      root.current.worldToLocal(_p)
      return Math.hypot(_p.x, _p.y - DIAL.centerHeight, _p.z) < DIAL.grabReach
    }
    let active = grabbing.current
    if (active === 'left' && !pressed(left)) active = null
    if (active === 'right' && !pressed(right)) active = null
    if (!active) {
      if (pressed(right) && near(right)) active = 'right'
      else if (pressed(left) && near(left)) active = 'left'
    }
    grabbing.current = active
    const ctrl = active === 'left' ? left : active === 'right' ? right : null

    if (ctrl?.object && root.current && n > 0) {
      ctrl.object.getWorldPosition(_p)
      root.current.worldToLocal(_p)
      const a = Math.atan2(-_p.x, _p.y - DIAL.centerHeight)
      target.current = THREE.MathUtils.clamp(a, -ARC / 2, ARC / 2)
      // nearest detent to the hand angle -> the value only ever snaps
      const f = n > 1 ? (ARC / 2 - target.current) / (ARC / (n - 1)) : 0
      choose(THREE.MathUtils.clamp(Math.round(f), 0, n - 1), ctrl)
    } else {
      // not grabbed: ease the knob onto the chosen detent
      target.current = detentAngle(indexRef.current, n)
    }
    angle.current = THREE.MathUtils.damp(angle.current, target.current, DIAL.followDamp, d)
    if (knob.current) knob.current.rotation.z = angle.current

    // --- storm tint + trust light (slow damped fades, no flashing) --------
    const want = n > 1 ? indexRef.current / (n - 1) : 0
    level.current = THREE.MathUtils.damp(level.current, want, DIAL.colorDamp, d)
    if (light.current) light.current.intensity = level.current * DIAL.tintMax
    if (scene.background?.isColor) scene.background.lerpColors(BASE_BG, RED_BG, level.current)
    else scene.background = BASE_BG.clone()
    _c.set(trustColor(verdictRef.current))
    lampColor.current.lerp(_c, 1 - Math.exp(-DIAL.colorDamp * d))
    if (lamp.current) {
      lamp.current.color.copy(lampColor.current)
      lamp.current.emissive.copy(lampColor.current)
    }
  })

  const h = DIAL.centerHeight
  const fmt = (v) => (v == null ? '-' : String(v))

  return (
    <group ref={root}>
      {/* red storm light: rises with noise, fades smoothly */}
      <pointLight ref={light} position={[0, DIAL.tintHeight, 1.5]} color={COLORS.noisy} intensity={0} distance={7} />

      {/* pedestal + dial plate */}
      <mesh position={[0, h / 2 - 0.1, -0.05]}>
        <cylinderGeometry args={[0.2, 0.28, h - 0.2, 12]} />
        <meshStandardMaterial color={COLORS.pedestal} roughness={0.9} />
      </mesh>
      <mesh position={[0, h, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[DIAL.detentRingRadius + 0.08, DIAL.detentRingRadius + 0.08, 0.04, 32]} />
        <meshStandardMaterial color="#1b1e25" roughness={0.8} />
      </mesh>

      {/* knob: opaque cylinder + pointer in one rotating group */}
      <group position={[0, h, 0]} ref={knob}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[DIAL.radius, DIAL.radius, 0.08, 24]} />
          <meshStandardMaterial color="#3a404c" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh position={[0, DIAL.radius * 0.6, 0.05]}>
          <boxGeometry args={[0.04, DIAL.radius * 0.7, 0.03]} />
          <meshStandardMaterial color={COLORS.noisy} emissive={COLORS.noisy} emissiveIntensity={0.5} />
        </mesh>
      </group>

      {/* detent markers (ray + trigger) with the saved noise value on each */}
      {noiseLevels.map((v, i) => {
        const a = detentAngle(i, n)
        const x = -Math.sin(a) * DIAL.detentRingRadius
        const y = Math.cos(a) * DIAL.detentRingRadius
        const on = i === noiseIndex
        return (
          <group key={i} position={[x, h + y, 0.01]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation()
                choose(i, null)
              }}
            >
              <sphereGeometry args={[DIAL.detentMarkerRadius, 10, 8]} />
              <meshStandardMaterial
                color={on ? COLORS.noisy : COLORS.pedestal}
                emissive={on ? COLORS.noisy : '#000000'}
                emissiveIntensity={on ? 0.6 : 0}
              />
            </mesh>
            <Label size={0.03} color={on ? COLORS.text : COLORS.textDim} position={[0, 0.07, 0.01]}>
              {fmt(v)}
            </Label>
          </group>
        )
      })}

      {/* trust light */}
      <mesh position={[0.62, h + 0.2, 0]}>
        <sphereGeometry args={[0.07, 14, 10]} />
        <meshStandardMaterial ref={lamp} color={trustColor(verdict)} emissive={trustColor(verdict)} emissiveIntensity={0.8} />
      </mesh>
      <Label size={0.035} color={COLORS.textDim} position={[0.62, h + 0.07, 0.01]}>
        trust
      </Label>
      <Label size={0.045} color={trustColor(verdict)} position={[0.62, h - 0.02, 0.01]}>
        {verdict}
      </Label>

      {/* value readout: straight from the saved JSON */}
      <Panel position={[0, h - 0.55, 0.02]} width={0.8} height={0.2}>
        <Label size={0.04} color={COLORS.text} position={[0, 0.03, 0.003]}>
          {`Noise Storm - noise p2 = ${fmt(noiseValue)}`}
        </Label>
        <Label size={0.026} color={COLORS.textDim} position={[0, -0.05, 0.003]}>
          {`detent ${noiseIndex + 1} of ${n} - saved run`}
        </Label>
      </Panel>

      <Hint position={[0, h + 0.62, 0]}>grip the dial and turn it, or point and pull the trigger on a detent</Hint>
    </group>
  )
}
