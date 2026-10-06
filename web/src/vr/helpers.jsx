// helpers.jsx — small VR building blocks shared by the stations.
//   Station     — places a group on the room circle, facing the user.
//   GrabRotate  — grip (squeeze) on either controller rotates the children,
//                 following the wrist. No locomotion, no teleport (SPEC).
//   Hint        — a small floating 3D text hint ("what to do next").

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { ROOM } from './vrConfig.js'
import { Label } from '../components/Plate.jsx'

// Position a station on the circle and rotate it so its +Z faces the centre.
//   angle 0 => straight ahead (-Z), +Z/2 => right, etc. (see vrConfig STATIONS)
export function Station({ angle = 0, radius = ROOM.stationRadius, children, ...props }) {
  const x = Math.sin(angle) * radius
  const z = -Math.cos(angle) * radius
  return (
    <group position={[x, 0, z]} rotation={[0, -angle, 0]} {...props}>
      {children}
    </group>
  )
}

const _q = new THREE.Quaternion()
const _prev = new THREE.Quaternion()
const _delta = new THREE.Quaternion()

// Grip-to-rotate. Wraps children in a group; while a controller's squeeze is
// held, the wrist's rotation is applied incrementally to the group.
export function GrabRotate({ children, ...props }) {
  const group = useRef()
  const left = useXRInputSourceState('controller', 'left')
  const right = useXRInputSourceState('controller', 'right')
  const grabbing = useRef(null) // 'left' | 'right' | null

  useFrame(() => {
    const g = group.current
    if (!g) return

    const pressed = (c) => c?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
    const obj = (c) => c?.object

    // Pick/keep the grabbing controller.
    let active = grabbing.current
    if (active === 'left' && !pressed(left)) active = null
    if (active === 'right' && !pressed(right)) active = null
    if (!active) {
      if (pressed(right) && obj(right)) active = 'right'
      else if (pressed(left) && obj(left)) active = 'left'
    }

    const controller = active === 'left' ? left : active === 'right' ? right : null
    const co = obj(controller)

    if (active && co) {
      co.getWorldQuaternion(_q)
      if (grabbing.current !== active) {
        // grab just started: seed previous, no jump this frame
        _prev.copy(_q)
        grabbing.current = active
      } else {
        // delta = now * prev^-1 ; apply in world space
        _delta.copy(_q).multiply(_prev.clone().invert())
        g.quaternion.premultiply(_delta)
        _prev.copy(_q)
      }
    } else {
      grabbing.current = null
    }
  })

  return (
    <group ref={group} {...props}>
      {children}
    </group>
  )
}

// A small floating hint. One short instruction per station.
export function Hint({ children, position = [0, 0, 0], ...props }) {
  return (
    <Label size={0.035} color="#8fa0b4" position={position} {...props}>
      {children}
    </Label>
  )
}
