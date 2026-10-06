// vrConfig.js — every tunable constant for the VR world in ONE place.
// Thresholds, detents, sizes, and the shared colour code live here so the
// scene components never hard-code a magic number. Numbers that describe the
// *data* (noise levels, trust words) are NOT invented here — they come from
// the saved JSON at runtime (see useSavedResults.js). The constants below are
// purely presentational / performance knobs for the Quest 2 target.

// ---------------------------------------------------------------------------
// Colour code — identical to the website (SPEC "Colour code").
// Ideal = grey, Noisy = red, Fixed (mitigated/corrected) = blue,
// Classical = white, Trust verdict = green / amber / red.
// ---------------------------------------------------------------------------
export const COLORS = {
  ideal: '#9aa0a6', // grey
  noisy: '#e2504a', // red
  fixed: '#4a90e2', // blue
  classical: '#ffffff', // white
  trust: '#39b36a', // green
  caution: '#e0a93b', // amber
  refer: '#e2504a', // red
  roomWall: '#15171c',
  roomFloor: '#0d0f13',
  pedestal: '#2a2e37',
  text: '#e7e9ee',
  textDim: '#9aa0a6',
  accent: '#5bd1c3',
}

// Map a trust verdict word (from the saved JSON) to its colour.
export function trustColor(word) {
  switch (word) {
    case 'trust':
      return COLORS.trust
    case 'caution':
      return COLORS.caution
    case 'refer':
      return COLORS.refer
    default:
      return COLORS.textDim
  }
}

// ---------------------------------------------------------------------------
// Nodule Chamber — density-thresholded instanced voxels.
// Volume is Uint8 28x28x28, row-major. We draw ONLY voxels whose density is
// at or above DENSITY_THRESHOLD, as a single opaque InstancedMesh (SPEC
// performance budget: never draw all 21,952 voxels).
// ---------------------------------------------------------------------------
export const NODULE = {
  dim: 28, // voxels per side
  densityThreshold: 110, // 0..255; tune to show the nodule mass, not the whole cube
  worldSize: 0.34, // metres across the whole 28^3 cube when shown at scale 1
  pedestalHeight: 1.0, // top of pedestal / nodule centre height (chest height)
  minScale: 0.5, // two-hand scale clamp (later dispatch uses these)
  maxScale: 2.5,
  rotateSpeed: 1.0, // grip-rotate gain
}
// Derived: size of one voxel cube in metres.
export const VOXEL_SIZE = NODULE.worldSize / NODULE.dim

// ---------------------------------------------------------------------------
// Quantum Core — 4 qubit spheres orbiting a ring, each holding a Bloch arrow.
// Arrow length is the Bloch vector magnitude (0..1) from the saved JSON,
// scaled to ARROW.maxLen metres. The ideal arrow shows as a faint ghost so the
// shrink under noise is visible (SPEC station 2).
// ---------------------------------------------------------------------------
export const CORE = {
  ringRadius: 0.45, // metres — qubit orbit radius
  sphereRadius: 0.11, // qubit sphere radius
  sphereSegments: 16, // low-poly for Quest 2
  centerHeight: 1.3, // height of the core centre
}
export const ARROW = {
  maxLen: 0.16, // metres for a unit Bloch vector
  shaftRadius: 0.006,
  headLen: 0.04,
  headRadius: 0.016,
  ghostOpacity: 0.28,
}

// ---------------------------------------------------------------------------
// Noise detents — reserved for the later dispatch. The *values* come from the
// saved index.json noise_p2 at runtime; this only records how many detents and
// the default index so station 3 snaps to a real saved run.
// ---------------------------------------------------------------------------
export const NOISE = {
  defaultIndex: 0, // start at zero noise (ideal == noisy)
}

// ---------------------------------------------------------------------------
// Research-prototype plate — shown in EVERY scene (hard constraint).
// ---------------------------------------------------------------------------
export const DISCLAIMER = 'Research prototype. Not a diagnosis.'

// ---------------------------------------------------------------------------
// ONE GIANT SCAN — the single room. Presentational knobs only; every number
// shown still comes from the saved JSON.
// ---------------------------------------------------------------------------
export const ROOM = {
  spawnHeight: 1.6, // standing eye height (desktop preview camera)
  width: 12, // x extent
  depth: 10, // z extent
  centerZ: -1.5, // room centre (spawn at 0,0,0 facing -Z)
  height: 4,
  limitX: 5.4, // locomotion clamp
  limitZMin: -5.8,
  limitZMax: 3.0,
}
export const SCAN = {
  position: [0, 1.75, -3.6],
  scale: 5, // 0.34 m cube x5 = 1.7 m across
  spin: 0.12, // rad/s, slow turn so the 3D shape reads
}
export const ORBIT = {
  radius: 2.1, // qubit ring radius around the scan
  speed: 0.18, // rad/s
  sphereRadius: 0.3,
  arrowScale: 6, // BlochArrow is drawn at 0.16 m per unit; scaled up for the room
}
export const CONSOLE = {
  position: [0, 0.95, -1.5], // control desk, in front of the user
  tilt: -0.5, // rad, leans toward the user
  trackHalf: 0.95, // slider half-length
  markerRadius: 0.09,
  knobRadius: 0.13,
  knobDamp: 12,
}
export const MOVE = { speed: 1.6, snapDegrees: 30, deadZone: 0.6 }
export const WALL = { z: -6.4, y: 2.3, width: 4.6, height: 2.3 }

// ---------------------------------------------------------------------------
// RADIOLOGY READING ROOM — replaces the "One Giant Scan" layout. Presentational
// knobs only; every number shown still comes from the saved JSON.
// Spawn is (0,0,0) facing -Z. Everything below is laid out so it is readable
// from there with no overlaps.
// ---------------------------------------------------------------------------
export const READING = {
  room: { width: 9, depth: 7, height: 3.4, centerZ: -1.1 },
  limit: { x: 4.0, zMin: -2.9, zMax: 2.0 },
  // walkable obstacle: the desk footprint (centre x/z + half extents)
  deskBox: { x: 0, z: -1.5, hx: 1.8, hz: 0.55 },
}
export const DESK = { z: -1.5, width: 3.2, depth: 0.8, top: 0.75 }
// CT viewer: grayscale voxel volume on a plinth, with a slice plane.
export const CT = {
  position: [-0.35, 1.55, -3.3],
  scale: 3.6, // 0.34 m cube x3.6 = 1.22 m across
  threshold: 110, // starting density cut-off (raised automatically if too many voxels)
  maxShell: 5500, // max instanced voxels (surface shell only)
  windowLo: 25, // CT "window": density at/below this is black
  windowHi: 235, // at/above this is white
  startSlice: 14,
  track: { y: 0.92, half: 0.62 },
}
export const SLICE_MONITOR = { position: [1.0, 1.75, -4.5], size: 1.0 }
export const LUNG = { position: [-2.0, 2.0, -3.7], yaw: 0.3, scale: 0.8 }
export const QUBITS = {
  position: [1.3, 0, -1.1], // front-right of spawn, in clear view
  yaw: -0.87, // faces the spawn point
  spacing: 0.55,
  sphereRadius: 0.24,
  arrowScale: 2.5, // BlochArrow draws 0.16 m per unit -> a full arrow is 0.4 m
  height: 1.78,
  minVisual: 0.25, // shortest visual arrow (fraction of full) so it never vanishes
  floorRatio: 0.4, // saved |noisy|/|ideal| at or below this draws as the minimum
}
export const NOISE_TRACK = { half: 0.95, markerRadius: 0.05, knobRadius: 0.075, damp: 12 }
