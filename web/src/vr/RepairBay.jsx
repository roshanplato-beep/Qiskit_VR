// RepairBay.jsx — SPEC station 4. Two pads:
//   (1) Mitigation pad (readout + ZNE): press toggles noisy <-> fixed values.
//       Values are the run's saved mitigated numbers; badge = index.circuit_cost_x.
//   (2) Error Correction pad: opens a tank (3 data qubits, 2 syndrome lights,
//       1 logical qubit). A lever picks one of the SAVED physical-p levels from
//       qec.json and replays that level's saved syndrome events. Every number
//       shown comes from qec.json; a missing field is labelled, never invented.
// The repetition code protects one error type only and does NOT repair the scan.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { Panel, Label, DisclaimerPlate } from '../components/Plate.jsx'
import BlochArrow from '../components/BlochArrow.jsx'
import { Hint } from './helpers.jsx'
import { COLORS, REPAIR as R } from './vrConfig.js'

const NA = 'n/a (missing in saved data)'
const f3 = (v) => (typeof v === 'number' ? v.toFixed(3) : NA)
const pct = (v) => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : NA)

// Haptic pulse on every controller that has an actuator (guarded).
function useBuzz() {
  const session = useXR((s) => s.session)
  return () => {
    for (const src of session?.inputSources ?? []) {
      try {
        src.gamepad?.hapticActuators?.[0]?.pulse?.(R.hapticIntensity, R.hapticMs)
      } catch {
        /* no haptics available */
      }
    }
  }
}

// Opaque sphere whose colour fades smoothly toward `color`.
function Glow({ color, radius, position = [0, 0, 0], emissive = 0.35 }) {
  const mat = useRef()
  const target = useMemo(() => new THREE.Color(color), [color])
  useFrame((_, dt) => {
    const m = mat.current
    if (!m) return
    const k = 1 - Math.exp(-R.colorDamp * dt)
    m.color.lerp(target, k)
    m.emissive.lerp(target, k)
  })
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, R.sphereSegments, R.sphereSegments]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={emissive} roughness={0.5} />
    </mesh>
  )
}

// A round pad button. Press => onPress + haptic.
function Pad({ position, color, active, onPress }) {
  const buzz = useBuzz()
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[R.padRadius + 0.03, R.padRadius + 0.05, 0.05, R.padSegments]} />
        <meshStandardMaterial color={COLORS.pedestal} roughness={0.9} />
      </mesh>
      <mesh
        position={[0, active ? 0.032 : 0.04, 0]}
        onClick={(e) => {
          e.stopPropagation()
          buzz()
          onPress()
        }}
      >
        <cylinderGeometry args={[R.padRadius, R.padRadius, 0.03, R.padSegments]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.7 : 0.25} roughness={0.5} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// (1) Mitigation pad
// ---------------------------------------------------------------------------
function MitigationPad({ run, index }) {
  const [fixed, setFixed] = useState(false)
  const [pulseT, setPulseT] = useState(null) // seconds since toggle-on, null = idle
  const ring = useRef()
  const pop = useRef()

  const noise = run?.noise_p2
  const bloch = run?.bloch
  const mitigatedArrows = bloch?.mitigated
  const hasMitigated = !!mitigatedArrows && typeof run?.p_malignant?.mitigated === 'number'
  const showFixed = fixed && hasMitigated
  const shown = showFixed ? mitigatedArrows : bloch?.noisy ?? bloch?.ideal
  const color = showFixed ? COLORS.fixed : noise > 0 ? COLORS.noisy : COLORS.ideal
  const cost = index?.circuit_cost_x

  useEffect(() => {
    setPulseT(fixed && hasMitigated ? 0 : null)
  }, [fixed, hasMitigated, run])

  useFrame((_, dt) => {
    if (pulseT == null) return
    const t = pulseT + dt
    const k = Math.min(1, t / R.pulseSeconds)
    if (ring.current) {
      const s = 0.4 + k * 1.2
      ring.current.scale.set(s, s, 1)
      ring.current.material.opacity = (1 - k) * 0.8
    }
    if (pop.current) pop.current.scale.setScalar(0.85 + 0.15 * (1 - Math.pow(1 - k, 3)))
    if (k >= 1) setPulseT(null)
    else setPulseT(t)
  })

  const pm = run?.p_malignant
  const ez = run?.expZ
  const lines = !run
    ? 'No saved run loaded.'
    : showFixed
      ? `p(malignant) fixed ${f3(pm?.mitigated)}  (noisy ${f3(pm?.noisy)}, ideal ${f3(pm?.ideal)})\nexpZ readout-corrected ${f3(ez?.readout)} → ZNE ${f3(ez?.zne)}`
      : `p(malignant) noisy ${f3(pm?.noisy)}  (ideal ${f3(pm?.ideal)})\nexpZ noisy ${f3(ez?.noisy)}`
  const status = !run
    ? ''
    : noise === 0
      ? 'This run has no noise: nothing to fix.'
      : fixed && !hasMitigated
        ? `Mitigated values ${NA}`
        : fixed
          ? 'FIXED — mitigated values (blue)'
          : 'NOISY — press pad to apply mitigation'

  return (
    <group position={[R.mitigationX, 0, 0]}>
      <Panel position={[0, 1.78, 0]} width={0.9} height={0.14}>
        <Label size={0.045} color={COLORS.text} position={[0, 0, 0.003]}>
          Mitigation pad — readout + ZNE
        </Label>
      </Panel>

      {/* 4 mini Bloch arrows from the run's saved vectors (ghost = ideal) */}
      <group position={[0, R.arrowY, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[(i - 1.5) * R.arrowSpacing, 0, 0]}>
            <BlochArrow vector={bloch?.ideal?.[i]} color={COLORS.ideal} ghost />
            <group ref={i === 0 ? pop : undefined}>
              <BlochArrow vector={shown?.[i]} color={color} />
            </group>
            <Label size={0.025} color={COLORS.textDim} position={[0, -0.05, 0]}>{`q${i}`}</Label>
          </group>
        ))}
        {/* blue pulse ring when mitigation switches on */}
        {pulseT != null && (
          <mesh ref={ring} position={[0, 0, -0.02]}>
            <ringGeometry args={[0.28, 0.3, 32]} />
            <meshBasicMaterial color={COLORS.fixed} transparent opacity={0.8} />
          </mesh>
        )}
      </group>

      <Panel position={[0, 1.12, 0]} width={0.95} height={0.22}>
        <Label size={0.028} color={showFixed ? COLORS.fixed : COLORS.text} maxWidth={0.9} position={[0, 0.035, 0.003]}>
          {lines}
        </Label>
        <Label size={0.026} color={showFixed ? COLORS.fixed : COLORS.textDim} maxWidth={0.9} position={[0, -0.06, 0.003]}>
          {status}
        </Label>
      </Panel>

      {/* cost badge — index.circuit_cost_x */}
      {fixed && (
        <Panel position={[0.42, 1.12, 0.02]} width={0.2} height={0.1} color={COLORS.fixed} opacity={1}>
          <Label size={0.032} color="#ffffff" maxWidth={0.2} position={[0, 0, 0.003]}>
            {typeof cost === 'number' ? `${cost}x cost` : 'cost n/a'}
          </Label>
        </Panel>
      )}

      <Pad position={[0, R.padY - 0.1, 0.2]} color={COLORS.fixed} active={fixed} onPress={() => setFixed((v) => !v)} />
      <Hint position={[0, R.padY - 0.2, 0.2]}>point + trigger on the pad: noisy ↔ fixed</Hint>
    </group>
  )
}

// ---------------------------------------------------------------------------
// (2) Error Correction pad + tank
// ---------------------------------------------------------------------------
function flipsText(flips) {
  const idx = flips.map((f, i) => (f ? `q${i}` : null)).filter(Boolean)
  return idx.length ? `physical flip on ${idx.join(', ')}` : 'no physical flip'
}

function Lever({ rows, selected, onSelect }) {
  const root = useRef()
  const dragging = useRef(false)
  const buzz = useBuzz()
  const yAt = (i) => R.leverYMin + (i / Math.max(1, rows.length - 1)) * (R.leverYMax - R.leverYMin)

  const pick = (e) => {
    if (!root.current) return
    const y = root.current.worldToLocal(e.point.clone()).y
    const k = (y - R.leverYMin) / (R.leverYMax - R.leverYMin)
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(k * (rows.length - 1))))
    if (i !== selected) {
      onSelect(i)
      buzz()
    }
  }
  return (
    <group ref={root} position={[R.leverX, 0, 0]}>
      <mesh position={[0, (R.leverYMin + R.leverYMax) / 2, 0]}>
        <boxGeometry args={[0.02, R.leverYMax - R.leverYMin, 0.02]} />
        <meshStandardMaterial color={COLORS.pedestal} roughness={0.9} />
      </mesh>
      {rows.map((row, i) => (
        <group key={i} position={[0, yAt(i), 0]}>
          <mesh>
            <boxGeometry args={[0.07, 0.01, 0.03]} />
            <meshStandardMaterial color={COLORS.textDim} />
          </mesh>
          <Label size={0.025} color={COLORS.textDim} position={[0.1, 0, 0]}>{`${row.p}`}</Label>
        </group>
      ))}
      {/* handle */}
      <mesh position={[0, yAt(selected), 0.03]}>
        <sphereGeometry args={[0.045, R.sphereSegments, R.sphereSegments]} />
        <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.5} />
      </mesh>
      {/* invisible drag surface */}
      <mesh
        position={[0.04, (R.leverYMin + R.leverYMax) / 2, 0.04]}
        visible={false}
        onPointerDown={(e) => {
          e.stopPropagation()
          dragging.current = true
          pick(e)
        }}
        onPointerMove={(e) => dragging.current && pick(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <planeGeometry args={[0.3, R.leverYMax - R.leverYMin + 0.12]} />
        <meshBasicMaterial />
      </mesh>
      <Label size={0.026} color={COLORS.text} position={[0, R.leverYMax + 0.1, 0]}>
        error rate
      </Label>
    </group>
  )
}

function Tank({ qec, open }) {
  const grp = useRef()
  const rows = qec?.rows ?? []
  const events = qec?.events ?? []
  const [sel, setSel] = useState(0)
  const [evI, setEvI] = useState(0)
  const [phase, setPhase] = useState(0)
  const t = useRef(0)

  const row = rows[Math.min(sel, rows.length - 1)]
  const evs = useMemo(() => (row ? events.filter((e) => e.p === row.p) : []), [events, row])
  const ev = evs.length ? evs[evI % evs.length] : null

  // restart the replay when the level changes
  useEffect(() => {
    setEvI(0)
    setPhase(0)
    t.current = 0
  }, [sel])

  useFrame((_, dt) => {
    const g = grp.current
    if (g) {
      const s = THREE.MathUtils.damp(g.scale.x, open ? 1 : 0.001, R.tankOpenDamp, dt)
      g.scale.setScalar(s)
      g.visible = s > 0.02
    }
    if (!open || !ev) return
    t.current += dt
    if (t.current >= R.phaseSeconds[phase]) {
      t.current = 0
      if (phase === R.phaseSeconds.length - 1) {
        setPhase(0)
        setEvI((i) => i + 1)
      } else setPhase(phase + 1)
    }
  })

  if (!qec) return null

  // Display state is derived only from the saved event.
  const flips = ev?.flips ?? [0, 0, 0]
  const corr = ev?.corrected_qubit
  const finalFlips = flips.map((f, i) => (corr === i ? f ^ 1 : f))
  const dataColor = (i) => {
    if (!ev) return COLORS.ideal
    if (phase >= 2) {
      if (finalFlips[i]) return COLORS.noisy
      return flips[i] ? COLORS.fixed : COLORS.ideal
    }
    return flips[i] ? COLORS.noisy : COLORS.ideal
  }
  const lightColor = (i) => (ev && phase >= 1 && ev.syndrome?.[i] ? COLORS.caution : '#3a3f4a')
  const logicalColor = !ev || phase < 3 ? COLORS.ideal : ev.logical_error ? COLORS.noisy : COLORS.fixed

  const eps = 1e-9
  const code = row?.bitflip_code
  const raw = row?.unprotected
  let verdict = NA
  let verdictColor = COLORS.textDim
  if (typeof code === 'number' && typeof raw === 'number') {
    if (code < raw - eps) {
      verdict = 'CODE FAILING: worse than unprotected (past break-even)'
      verdictColor = COLORS.noisy
    } else if (Math.abs(code - raw) <= eps) {
      verdict = 'Break-even: code gives no gain'
      verdictColor = COLORS.caution
    } else {
      verdict = 'Code beats unprotected here'
      verdictColor = COLORS.fixed
    }
  }

  const phaseLine = !ev
    ? `No saved syndrome event for this level (${NA})`
    : phase === 0
      ? `event ${(evI % evs.length) + 1}/${evs.length} (saved): ${flipsText(flips)}`
      : phase === 1
        ? `syndrome [${ev.syndrome?.join(', ') ?? '?'}] — amber light = parity mismatch`
        : phase === 2
          ? corr == null
            ? 'decoder sees no mismatch: cannot fix'
            : `decoder flips q${corr} (majority vote)`
          : ev.logical_error
            ? 'LOGICAL ERROR — decoder could not recover'
            : 'logical qubit OK — flip fixed'

  const barH = 0.3
  return (
    <group ref={grp}>
      <Panel position={[0, R.tankY + 0.52, 0]} width={1.2} height={0.2}>
        <Label size={0.032} color={COLORS.text} maxWidth={1.15} position={[0, 0.045, 0.003]}>
          {`physical p = ${row?.p ?? NA}   unprotected ${pct(raw)}   3-qubit code ${pct(code)}`}
        </Label>
        <Label size={0.03} color={verdictColor} maxWidth={1.15} position={[0, -0.04, 0.003]}>
          {`${verdict}${typeof qec.break_even_p === 'number' ? `  (break-even p = ${qec.break_even_p})` : ''}`}
        </Label>
      </Panel>

      {/* tank glass */}
      <mesh position={[0, R.tankY, -0.02]}>
        <boxGeometry args={[R.tankWidth, R.tankHeight, R.tankDepth]} />
        <meshStandardMaterial color="#2b3350" transparent opacity={0.22} roughness={0.2} />
      </mesh>

      {/* 3 data qubits */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[(i - 1) * 0.22, R.tankY + 0.12, 0]}>
          <Glow color={dataColor(i)} radius={R.qubitRadius} />
          <Label size={0.025} color={COLORS.text} position={[0, 0.1, 0]}>{`data q${i}`}</Label>
        </group>
      ))}
      {/* 2 syndrome lights between them */}
      {[0, 1].map((i) => (
        <group key={i} position={[(i - 0.5) * 0.22, R.tankY - 0.02, 0]}>
          <Glow color={lightColor(i)} radius={R.lightRadius} emissive={0.8} />
          <Label size={0.02} color={COLORS.textDim} position={[0, -0.06, 0]}>{`s${i}`}</Label>
        </group>
      ))}
      {/* 1 logical qubit */}
      <group position={[0, R.tankY - 0.22, 0]}>
        <Glow color={logicalColor} radius={R.qubitRadius * 1.2} />
        <Label size={0.025} color={COLORS.text} position={[0, -0.12, 0]}>logical</Label>
      </group>

      {/* fidelity bars from saved rows: red = unprotected, blue = code */}
      <group position={[-0.5, R.tankY - 0.3, 0]}>
        {rows.map((r, i) => (
          <group key={i} position={[(i - (rows.length - 1) / 2) * 0.085, 0, 0]}>
            <mesh position={[-0.017, (r.unprotected * barH) / 2, 0]}>
              <boxGeometry args={[0.03, Math.max(0.002, r.unprotected * barH), 0.02]} />
              <meshStandardMaterial color={COLORS.noisy} />
            </mesh>
            <mesh position={[0.017, (r.bitflip_code * barH) / 2, 0]}>
              <boxGeometry args={[0.03, Math.max(0.002, r.bitflip_code * barH), 0.02]} />
              <meshStandardMaterial color={COLORS.fixed} />
            </mesh>
            {i === sel && (
              <mesh position={[0, barH + 0.04, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.02, 0.04, 6]} />
                <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.5} />
              </mesh>
            )}
            <Label size={0.016} color={COLORS.textDim} position={[0, -0.03, 0]}>{`${r.p}`}</Label>
          </group>
        ))}
        <Label size={0.02} color={COLORS.textDim} position={[0, barH + 0.1, 0]}>
          fidelity vs p (red raw, blue code)
        </Label>
      </group>

      <Panel position={[0, R.tankY - 0.55, 0.05]} width={1.2} height={0.12}>
        <Label size={0.028} color={COLORS.text} maxWidth={1.15} position={[0, 0, 0.003]}>
          {phaseLine}
        </Label>
      </Panel>

      <Lever rows={rows} selected={sel} onSelect={setSel} />
    </group>
  )
}

function CorrectionPad({ qec, error }) {
  const [open, setOpen] = useState(false)
  return (
    <group position={[R.correctionX, 0, 0]}>
      <Panel position={[0, 2.12, 0]} width={1.2} height={0.12}>
        <Label size={0.045} color={COLORS.text} maxWidth={1.15} position={[0, 0, 0.003]}>
          Error Correction pad — 3-qubit repetition code
        </Label>
      </Panel>
      {error && (
        <Label size={0.035} color={COLORS.noisy} position={[0, 1.5, 0]} maxWidth={1}>
          {`qec.json failed to load: ${error.message}`}
        </Label>
      )}
      {!qec && !error && (
        <Label size={0.035} color={COLORS.textDim} position={[0, 1.5, 0]}>
          loading saved qec data…
        </Label>
      )}
      <Tank qec={qec} open={open} />
      <Pad position={[0, R.padY - 0.1, 0.2]} color={COLORS.fixed} active={open} onPress={() => setOpen((v) => !v)} />
      <Hint position={[0, R.padY - 0.2, 0.2]}>
        {open ? 'drag the lever: pick an error rate; replays saved events' : 'press the pad to open the tank'}
      </Hint>
      <Label size={0.022} color={COLORS.textDim} position={[0, R.padY - 0.27, 0.2]} maxWidth={1.2}>
        Protects against bit-flips only. This demo does not repair the scan.
      </Label>
    </group>
  )
}

export default function RepairBay({ run, index, qec, qecError }) {
  return (
    <group>
      <DisclaimerPlate position={[0, 2.4, 0]} />
      <MitigationPad run={run} index={index} />
      <CorrectionPad qec={qec} error={qecError} />
    </group>
  )
}
