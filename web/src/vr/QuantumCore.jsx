// QuantumCore.jsx — SPEC station 2 (this increment: 4 qubit spheres on a ring,
// each holding its Bloch arrow read from the saved JSON, with the ideal arrow
// as a faint ghost). The Analyze particle stream and the noise-driven shrink
// are later dispatches; here the arrows are drawn directly from the current
// run's saved `bloch` arrays.
//
// Shrink is shown "relative to ideal": the solid arrow is the current run's
// vector, the ghost is the ideal vector. At zero noise they coincide.

import { Panel, Label, DisclaimerPlate } from '../components/Plate.jsx'
import BlochArrow from '../components/BlochArrow.jsx'
import { Hint } from './helpers.jsx'
import { CORE, COLORS } from './vrConfig.js'

function Qubit({ index, position, current, ideal, currentColor }) {
  return (
    <group position={position}>
      {/* qubit sphere — faint so the arrow inside is visible */}
      <mesh>
        <sphereGeometry args={[CORE.sphereRadius, CORE.sphereSegments, CORE.sphereSegments]} />
        <meshStandardMaterial
          color="#2b3350"
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.25}
        />
      </mesh>
      {/* ideal ghost arrow + current arrow, both from saved JSON */}
      <BlochArrow vector={ideal} color={COLORS.ideal} ghost />
      <BlochArrow vector={current} color={currentColor} />
      <Label size={0.03} color={COLORS.textDim} position={[0, CORE.sphereRadius + 0.05, 0]}>
        {`q${index}`}
      </Label>
    </group>
  )
}

export default function QuantumCore({ run, noiseValue }) {
  const bloch = run?.bloch
  // At zero noise the current state equals ideal (grey); once noise > 0 the
  // "noisy" arrow is the live one and reads red.
  const noisy = noiseValue > 0
  const currentColor = noisy ? COLORS.noisy : COLORS.ideal
  const currentArrows = bloch?.noisy ?? bloch?.ideal

  const h = CORE.centerHeight

  return (
    <group>
      <DisclaimerPlate position={[0, h + 0.75, 0]} />

      {/* glowing ring */}
      <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[CORE.ringRadius, 0.012, 8, 48]} />
        <meshStandardMaterial
          color={COLORS.accent}
          emissive={COLORS.accent}
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* 4 qubit spheres on the ring, one per PCA feature */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        const pos = [Math.cos(a) * CORE.ringRadius, h, Math.sin(a) * CORE.ringRadius]
        return (
          <Qubit
            key={i}
            index={i}
            position={pos}
            current={currentArrows?.[i]}
            ideal={bloch?.ideal?.[i]}
            currentColor={currentColor}
          />
        )
      })}

      {/* caption */}
      <Panel position={[0, h - 0.45, 0]} width={0.8} height={0.18}>
        <Label size={0.04} position={[0, 0.035, 0.003]} color={COLORS.text}>
          Quantum Core — 4 qubits
        </Label>
        <Label size={0.028} position={[0, -0.03, 0.003]} color={COLORS.textDim}>
          solid = current · ghost = ideal · shrink is relative to ideal
        </Label>
      </Panel>

      <Hint position={[0, h + 0.5, 0]}>each arrow is a qubit's Bloch vector from the saved run</Hint>
    </group>
  )
}
