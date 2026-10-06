// VerdictDeck.jsx — Station 5. A curved board (open cylinder segment curved
// around the user) with the trust triplet (ideal grey / noisy red / fixed
// blue) beside the classical model (white), a green/amber/red trust light, and
// a ONE-LINE template explanation. No LLM, no invented text: every number is
// read from the saved run/patient (useSavedResults) and dropped into a fixed
// template. Cheap on Quest 2: one backing mesh, one mesh per bar (5), one
// threshold line, one light sphere, plain opaque materials.

import { Label, DisclaimerPlate } from '../components/Plate.jsx'
import { COLORS, ROOM, trustColor } from './vrConfig.js'
import { resolveTrust } from './useSavedResults.js'

// Local geometry. The curve's axis sits at the user (room centre), so the
// board is concave toward them. Station group +Z points at the room centre.
const AXIS_Z = ROOM.stationRadius // axis (user) in station-local z
const R = 0.9 // board radius → board sits 0.9 m in front of the user
const SPAN = 1.9 // radians of arc covered by the backing
const Y = { disclaimer: 2.15, title: 1.9, base: 1.0, names: 0.93, verdict: 0.72, line: 0.48 }
const BAR_MAX = 0.6 // metres for p = 1
const BAR_W = 0.15

// Place children at arc angle phi (rad, 0 = straight at the user) and height.
function OnArc({ phi = 0, y = 0, r = R - 0.012, children }) {
  return (
    <group position={[Math.sin(phi) * r, y, AXIS_Z - Math.cos(phi) * r]} rotation={[0, -phi, 0]}>
      {children}
    </group>
  )
}

const pct = (p) => `${(p * 100).toFixed(1)}%`
const WORD = { trust: 'TRUST', caution: 'CAUTION', refer: 'REFER' }

// Fixed template filled from saved numbers only.
export function explain(run, noisyV, fixedV) {
  const p = run.p_malignant
  const label = (v) => (v >= 0.5 ? 'malignant' : 'benign')
  const shift = Math.abs(p.noisy - p.ideal) * 100
  const flipped = label(p.noisy) !== label(p.ideal)
  return (
    `At noise ${run.noise_p2}: ideal ${pct(p.ideal)}, noisy ${pct(p.noisy)} ` +
    `(${shift.toFixed(1)} pts from ideal${flipped ? ', label flips' : ', same label'}), ` +
    `fixed ${pct(p.mitigated)}. Verdict: ${WORD[noisyV] ?? 'n/a'}` +
    (fixedV ? `, after fix: ${WORD[fixedV] ?? 'n/a'}.` : '.')
  )
}

function Bar({ phi, value, color, name }) {
  const h = Math.max(0.004, value * BAR_MAX)
  return (
    <>
      <OnArc phi={phi} y={Y.base + h / 2}>
        <mesh>
          <boxGeometry args={[BAR_W, h, 0.02]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </OnArc>
      <OnArc phi={phi} y={Y.base + h + 0.05}>
        <Label size={0.04} color={color} maxWidth={0.3} position={[0, 0, 0]}>
          {pct(value)}
        </Label>
      </OnArc>
      <OnArc phi={phi} y={Y.names}>
        <Label size={0.034} color={COLORS.text} maxWidth={0.26} anchorY="top" position={[0, 0, 0]}>
          {name}
        </Label>
      </OnArc>
    </>
  )
}

export default function VerdictDeck({ run, patient, model }) {
  if (!run) {
    return (
      <Label size={0.05} color={COLORS.textDim} position={[0, 1.4, AXIS_Z - R]}>
        Verdict Deck — loading saved results…
      </Label>
    )
  }

  const p = run.p_malignant
  const noisy = resolveTrust(run, 'noisy')
  const fixed = resolveTrust(run, 'mitigated')
  const cls = patient?.classical
  const fixedUsable = fixed.verdict !== 'n/a'

  return (
    <group>
      {/* curved backing: inside face visible to the user at the axis */}
      <mesh position={[0, 1.175, AXIS_Z]}>
        <cylinderGeometry args={[R, R, 1.65, 32, 1, true, Math.PI - SPAN / 2, SPAN]} />
        <meshBasicMaterial color="#1b1e25" side={2 /* DoubleSide */} />
      </mesh>

      {/* research-prototype plate, top of the deck */}
      <OnArc phi={0} y={Y.disclaimer} r={R - 0.01}>
        <DisclaimerPlate />
      </OnArc>

      <OnArc phi={0} y={Y.title}>
        <Label size={0.04} color={COLORS.textDim} position={[0, 0, 0]} maxWidth={1}>
          {`P(malignant) — ${model?.qubits ?? 4}-qubit model, ${patient?.sample_id ?? ''}`}
        </Label>
      </OnArc>

      {/* trust triplet */}
      <Bar phi={-0.62} value={p.ideal} color={COLORS.ideal} name="Ideal" />
      <Bar phi={-0.34} value={p.noisy} color={COLORS.noisy} name="Noisy" />
      <Bar phi={-0.06} value={p.mitigated} color={COLORS.fixed} name="Fixed" />

      {/* classical model, white */}
      {cls && (
        <>
          <Bar phi={0.32} value={cls.logreg_p} color={COLORS.classical} name="Classical LR" />
          <Bar phi={0.6} value={cls.svm_p} color={COLORS.classical} name="Classical SVM" />
        </>
      )}

      {/* 0.5 decision line across the bars */}
      <OnArc phi={-0.17} y={Y.base + 0.5 * BAR_MAX} r={R - 0.02}>
        <mesh>
          <planeGeometry args={[0.95, 0.003]} />
          <meshBasicMaterial color={COLORS.textDim} />
        </mesh>
      </OnArc>

      {/* trust verdict light (noisy answer) */}
      <OnArc phi={-0.34} y={Y.verdict} r={R - 0.03}>
        <mesh>
          <sphereGeometry args={[0.05, 16, 12]} />
          <meshBasicMaterial color={trustColor(noisy.verdict)} />
        </mesh>
      </OnArc>
      <OnArc phi={-0.12} y={Y.verdict}>
        <Label size={0.045} color={trustColor(noisy.verdict)} maxWidth={0.6} position={[0, 0, 0]}>
          {`Noisy answer: ${WORD[noisy.verdict] ?? 'n/a'}`}
        </Label>
      </OnArc>
      {fixedUsable && (
        <OnArc phi={0.34} y={Y.verdict}>
          <Label size={0.04} color={trustColor(fixed.verdict)} maxWidth={0.6} position={[0, 0, 0]}>
            {`After fix: ${WORD[fixed.verdict] ?? 'n/a'}`}
          </Label>
        </OnArc>
      )}

      {/* one-line template explanation */}
      <OnArc phi={0} y={Y.line}>
        <Label size={0.03} color={COLORS.text} maxWidth={1.3} position={[0, 0, 0]}>
          {explain(run, noisy.verdict, fixedUsable ? fixed.verdict : null)}
        </Label>
      </OnArc>
    </group>
  )
}

