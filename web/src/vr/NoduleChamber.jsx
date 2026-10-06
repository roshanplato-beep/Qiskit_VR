// NoduleChamber.jsx — SPEC station 1 (this increment: voxels + grab-rotate +
// patient/classical card + patient picker). Slice-plane and two-hand scale are
// a later dispatch.
//
// The nodule floats at chest height on a pedestal. Grip to rotate it. A card
// shows the patient ID + classical probabilities (straight from saved JSON).
// Pointing + trigger on a picker card reloads everything from saved JSON.

import NoduleVoxels from '../components/NoduleVoxels.jsx'
import { Panel, Label, DisclaimerPlate } from '../components/Plate.jsx'
import { GrabRotate, Hint } from './helpers.jsx'
import { NODULE, COLORS } from './vrConfig.js'

function PatientCard({ id, selected, onPick, position }) {
  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onPick(id)
        }}
      >
        <planeGeometry args={[0.26, 0.09]} />
        <meshBasicMaterial color={selected ? COLORS.accent : '#242833'} />
      </mesh>
      <Label size={0.03} color={selected ? '#06222014' : COLORS.text} position={[0, 0, 0.003]} maxWidth={0.24}>
        {id.replace('nodule_', '#')}
      </Label>
    </group>
  )
}

export default function NoduleChamber({ patient, volume, patients, patientId, onPickPatient }) {
  const classical = patient?.classical
  const pedH = NODULE.pedestalHeight

  return (
    <group>
      {/* Disclaimer plate — required in every scene */}
      <DisclaimerPlate position={[0, pedH + 0.62, 0]} />

      {/* Pedestal */}
      <mesh position={[0, pedH / 2, 0]}>
        <cylinderGeometry args={[0.16, 0.2, pedH, 24]} />
        <meshStandardMaterial color={COLORS.pedestal} roughness={0.8} />
      </mesh>

      {/* Nodule, grip to rotate, floating above the pedestal */}
      <GrabRotate position={[0, pedH + 0.22, 0]}>
        <NoduleVoxels volume={volume} />
      </GrabRotate>

      {/* Patient / classical card */}
      <Panel position={[0, pedH + 0.44, 0.02]} width={0.6} height={0.2}>
        <Label size={0.045} position={[0, 0.05, 0.003]} color={COLORS.text}>
          {patient ? patient.sample_id.replace('nodule_', 'Patient #') : 'Loading…'}
        </Label>
        <Label size={0.03} position={[0, -0.01, 0.003]} color={COLORS.textDim}>
          {classical
            ? `classical  logreg ${classical.logreg_p.toFixed(2)}   svm ${classical.svm_p.toFixed(2)}`
            : ''}
        </Label>
        <Label size={0.026} position={[0, -0.055, 0.003]} color={COLORS.textDim}>
          {patient ? `true label: ${patient.true_label === 1 ? 'malignant' : 'benign'}` : ''}
        </Label>
      </Panel>

      {/* Patient picker row */}
      <group position={[0, 0.5, 0.0]}>
        <Label size={0.03} position={[0, 0.12, 0]} color={COLORS.textDim}>
          pick a patient
        </Label>
        {(patients || []).map((id, i) => {
          const n = patients.length
          const spread = 0.3
          const px = (i - (n - 1) / 2) * spread
          return (
            <PatientCard
              key={id}
              id={id}
              selected={id === patientId}
              onPick={onPickPatient}
              position={[px, 0, 0]}
            />
          )
        })}
      </group>

      <Hint position={[0, pedH - 0.05, 0.25]}>grip to rotate the nodule</Hint>
    </group>
  )
}
