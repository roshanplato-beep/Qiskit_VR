// VRRoom.jsx — one circular room; user stands in the middle and turns to face
// each station. This increment populates the Nodule Chamber and the Quantum
// Core; the Noise Storm, Repair Bay and Verdict Deck are reserved slots filled
// by a later dispatch. No locomotion, no teleport: fixed spawn at standing
// height (SPEC).

import { OrbitControls } from '@react-three/drei'
import { XROrigin, useXR } from '@react-three/xr'
import { Station } from './helpers.jsx'
import { Label } from '../components/Plate.jsx'
import NoduleChamber from './NoduleChamber.jsx'
import QuantumCore from './QuantumCore.jsx'
import { useSavedResults } from './useSavedResults.js'
import { ROOM, STATIONS, COLORS } from './vrConfig.js'

function Room() {
  return (
    <group>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[ROOM.radius, 48]} />
        <meshStandardMaterial color={COLORS.roomFloor} roughness={1} />
      </mesh>
      {/* wall — open cylinder seen from inside */}
      <mesh position={[0, ROOM.height / 2, 0]}>
        <cylinderGeometry args={[ROOM.radius, ROOM.radius, ROOM.height, 48, 1, true]} />
        <meshStandardMaterial color={COLORS.roomWall} roughness={1} side={1 /* BackSide */} />
      </mesh>
    </group>
  )
}

export default function VRRoom() {
  const data = useSavedResults()
  const session = useXR((s) => s.session)
  const inVR = !!session

  return (
    <>
      {/* lights — kept few for Quest 2 */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 2]} intensity={0.7} />
      <pointLight position={[0, 2.6, 0]} intensity={0.5} color={COLORS.accent} />

      <Room />

      {/* fixed spawn at standing height, centre of the room */}
      <XROrigin position={[0, 0, 0]} />

      {/* desktop / emulator preview control only (disabled inside a session) */}
      <OrbitControls
        makeDefault
        enabled={!inVR}
        target={[0, 1.2, -ROOM.stationRadius]}
        enablePan={false}
        minDistance={0.2}
        maxDistance={3}
      />

      {data.error ? (
        <Label size={0.06} color={COLORS.noisy} position={[0, 1.4, -1.5]}>
          {`Data failed to load:\n${data.error.message}`}
        </Label>
      ) : (
        <>
          {/* Station 1 — Nodule Chamber (straight ahead) */}
          <Station angle={STATIONS.noduleChamber.angle}>
            <NoduleChamber
              patient={data.patient}
              volume={data.volume}
              patients={data.patients}
              patientId={data.patientId}
              onPickPatient={data.setPatientId}
            />
          </Station>

          {/* Station 2 — Quantum Core (to the right) */}
          <Station angle={STATIONS.quantumCore.angle}>
            <QuantumCore run={data.run} noiseValue={data.noiseValue} />
          </Station>

          {/* Reserved slots (later dispatch) — labelled placeholders so the
              room reads as complete and the layout is fixed. */}
          <Station angle={STATIONS.noiseStorm.angle}>
            <Label size={0.05} color={COLORS.textDim} position={[0, 1.4, 0]}>
              Noise Storm — coming soon
            </Label>
          </Station>
          <Station angle={STATIONS.repairBay.angle}>
            <Label size={0.05} color={COLORS.textDim} position={[0, 1.4, 0]}>
              Repair Bay — coming soon
            </Label>
          </Station>
        </>
      )}
    </>
  )
}
