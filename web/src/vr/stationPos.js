// stationPos.js — world positions for audio, using the same math as <Station>
// (helpers.jsx): the group sits at (sin a, 0, -cos a) * radius and is rotated
// by -a about Y, so a station-local point is rotated by -a then offset.
import { ROOM, STATIONS } from './vrConfig.js'

export function stationWorld(key, local = [0, 0, 0]) {
  const a = STATIONS[key].angle
  const r = ROOM.stationRadius
  const [lx, ly, lz] = local
  const c = Math.cos(-a)
  const s = Math.sin(-a)
  return {
    x: Math.sin(a) * r + lx * c + lz * s,
    y: ly,
    z: -Math.cos(a) * r - lx * s + lz * c,
  }
}
