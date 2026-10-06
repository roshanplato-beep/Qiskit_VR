// Plate.jsx — SHARED 3D panel + text helpers for the VR scenes.
// Page HTML does not appear inside the headset, so every label is drei <Text>
// on a plain mesh (SPEC). Panels face the user; text is sized to be legible at
// arm's length.

import { Text } from '@react-three/drei'
import { COLORS, DISCLAIMER } from '../vr/vrConfig.js'

// A flat rounded-ish panel (plane) with a dark backing.
export function Panel({ width = 0.9, height = 0.28, color = '#1b1e25', opacity = 0.92, children, ...props }) {
  return (
    <group {...props}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      {children}
    </group>
  )
}

// A single line/paragraph of 3D text.
export function Label({
  children,
  size = 0.05,
  color = COLORS.text,
  maxWidth = 0.84,
  anchorY = 'middle',
  position = [0, 0, 0.002],
  ...props
}) {
  return (
    <Text
      position={position}
      fontSize={size}
      color={color}
      maxWidth={maxWidth}
      anchorX="center"
      anchorY={anchorY}
      textAlign="center"
      {...props}
    >
      {children}
    </Text>
  )
}

// The research-prototype plate. Must be visible in EVERY VR scene.
export function DisclaimerPlate(props) {
  return (
    <Panel width={0.9} height={0.16} color="#2a1414" opacity={0.95} {...props}>
      <Label size={0.05} color="#ff8a80" position={[0, 0, 0.003]}>
        {DISCLAIMER}
      </Label>
    </Panel>
  )
}
