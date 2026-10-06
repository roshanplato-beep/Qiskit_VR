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
// Room / layout. One circular room; user stands in the middle and turns.
// Stations are placed on a circle by angle (radians). Steps 1-3 populate the
// Nodule Chamber and Quantum Core; the remaining angles are reserved so the
// later dispatch (noise dial, repair bay, verdict deck) drops in without a
// re-layout.
// ---------------------------------------------------------------------------
export const ROOM = {
  radius: 3.0, // metres — wall radius
  height: 3.0, // metres — wall height
  spawnHeight: 1.6, // standing eye height for the XR origin (seated option later)
  stationRadius: 1.9, // how far stations sit from centre
}

// Station placement angle (radians, 0 = +Z toward user's initial facing is -Z).
// We face the user toward -Z at spawn, so angle 0 => directly ahead (-Z).
export const STATIONS = {
  noduleChamber: { angle: 0, label: 'Nodule Chamber' },
  quantumCore: { angle: Math.PI / 2, label: 'Quantum Core' }, // to the right
  noiseStorm: { angle: Math.PI, label: 'Noise Storm' }, // behind (later)
  repairBay: { angle: (3 * Math.PI) / 2, label: 'Repair Bay' }, // to the left (later)
  verdictDeck: { angle: Math.PI / 4, label: 'Verdict Deck' }, // (later)
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
// NOISE STORM DIAL (station 3) — presentational knobs only. Detent *values*
// come from the saved index.json noise_p2; the dial has one detent per level.
// ---------------------------------------------------------------------------
export const DIAL = {
  centerHeight: 1.2, // dial centre height (chest height)
  radius: 0.26, // knob radius (m)
  arcDeg: 240, // total sweep from first to last detent
  grabReach: 0.4, // controller must be within this of dial centre to grab
  detentMarkerRadius: 0.035, // ray-clickable detent marker
  detentRingRadius: 0.36, // markers sit on this radius
  followDamp: 14, // knob easing toward its target angle (1/s)
  colorDamp: 3, // slow colour fades, never flashes (< 3 Hz)
  tintMax: 0.9, // red point-light intensity at max noise
  tintHeight: 2.2, // red storm light height
  hapticStrength: 0.6, // 0..1
  hapticMs: 40,
}

// ---------------------------------------------------------------------------
// REPAIR block — Repair Bay (SPEC station 4) presentational knobs only.
// Every number SHOWN comes from index.json / the run / qec.json at runtime.
// ---------------------------------------------------------------------------
export const REPAIR = {
  mitigationX: -0.72, // local x of the Mitigation pad group
  correctionX: 0.55, // local x of the Error Correction pad group
  padY: 0.95, // pad height (waist)
  padRadius: 0.14,
  padSegments: 20,
  arrowSpacing: 0.2, // spacing of the 4 mini Bloch arrows on the mitigation pad
  arrowY: 1.4,
  pulseSeconds: 0.9, // blue pulse ring duration on mitigation toggle (<3 Hz)
  tankWidth: 0.7,
  tankHeight: 0.7,
  tankDepth: 0.3,
  tankY: 1.45, // tank centre height
  tankOpenDamp: 6, // open/close fade-scale speed
  qubitRadius: 0.07,
  lightRadius: 0.03,
  sphereSegments: 14,
  leverX: 0.55, // lever track x, relative to the correction group
  leverYMin: 1.1,
  leverYMax: 1.75,
  // Event replay phase lengths in seconds: error, syndrome, decode, result.
  // Each >= 0.9 s so nothing changes faster than ~1 Hz (no flashing > 3 Hz).
  phaseSeconds: [1.0, 1.0, 1.0, 1.6],
  colorDamp: 8, // colour fade speed
  hapticIntensity: 0.4,
  hapticMs: 40,
}
