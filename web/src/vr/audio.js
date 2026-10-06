// audio.js — tiny dependency-free Web Audio module for the VR room.
// NOT wired into any station yet (integration is god's job).
//
// HOW TO TRIGGER (for god / integrators)
//   import * as sfx from './audio.js'
//   1. Call `sfx.init()` once from a user gesture. Entering VR counts: do it in
//      the "Enter VR" click handler, or in the XR session 'start' event. It is
//      safe to call repeatedly; it also resumes a suspended context.
//   2. Pass a world position {x,y,z} (metres; same frame as the scene, i.e.
//      a station's world position) to place each sound in space:
//        sfx.ambientHum(noise01, {x,y,z})   // clean at 0, detuned as noise -> 1.
//                                           // Call on every noise change; it
//                                           // starts the hum on first call.
//        sfx.stopHum()                      // fade the hum out
//        sfx.detentClick({x,y,z})           // noise dial snaps to a detent
//        sfx.mitigationRise({x,y,z})        // mitigation applied (rising sweep)
//        sfx.correctionChime({x,y,z})       // error-correction success (chime)
//        sfx.setListener({x,y,z}, {x,y,z})  // optional: listener pos + forward
//                                           // (default: origin, facing -Z)
//   All calls are no-ops until init() has run, so they are safe to call early.
//   `noise01` is noise_p2 divided by the largest saved noise level (0..1).

let ctx = null
let master = null
let hum = null // { a, b, c, gain, p }

const ORIGIN = { x: 0, y: 0, z: 0 }

export function init() {
  if (typeof window === 'undefined') return false
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return true
}

export function setListener(pos = ORIGIN, forward = { x: 0, y: 0, z: -1 }) {
  if (!ctx) return
  const l = ctx.listener
  if (l.positionX) {
    l.positionX.value = pos.x
    l.positionY.value = pos.y
    l.positionZ.value = pos.z
    l.forwardX.value = forward.x
    l.forwardY.value = forward.y
    l.forwardZ.value = forward.z
    l.upX.value = 0
    l.upY.value = 1
    l.upZ.value = 0
  } else {
    l.setPosition(pos.x, pos.y, pos.z)
    l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
  }
}

function panner(pos = ORIGIN) {
  const p = ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = 1
  p.rolloffFactor = 1
  p.positionX.value = pos.x
  p.positionY.value = pos.y
  p.positionZ.value = pos.z
  p.connect(master)
  return p
}

// One-shot tone: oscillator -> envelope -> panner. Frequency may sweep.
function blip({ pos, type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.3, delay = 0 }) {
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  const p = panner(pos)
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(p)
  o.start(t)
  o.stop(t + dur + 0.05)
  o.onended = () => p.disconnect()
}

// Looping hum: two oscillators on the same pitch (pure tone at noise 0). As
// noise rises the second detunes up to 60 cents and a third, dissonant
// oscillator fades in, so the hum audibly goes out of tune.
export function ambientHum(noise01 = 0, pos = ORIGIN) {
  if (!ctx) return
  const n = Math.min(1, Math.max(0, noise01))
  if (!hum) {
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    const p = panner(pos)
    gain.connect(p)
    const mk = (f) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      o.connect(g).connect(gain)
      o.start()
      return { o, g }
    }
    hum = { a: mk(110), b: mk(110), c: mk(110 * 1.06), gain, p }
    hum.a.g.gain.value = 0.5
    hum.c.g.gain.value = 0
  }
  const t = ctx.currentTime
  hum.p.positionX.setTargetAtTime(pos.x, t, 0.1)
  hum.p.positionY.setTargetAtTime(pos.y, t, 0.1)
  hum.p.positionZ.setTargetAtTime(pos.z, t, 0.1)
  hum.gain.gain.setTargetAtTime(0.12, t, 0.2)
  hum.b.o.detune.setTargetAtTime(n * 60, t, 0.1) // cents
  hum.b.g.gain.setTargetAtTime(0.5, t, 0.1)
  hum.c.g.gain.setTargetAtTime(n * 0.35, t, 0.1)
}

export function stopHum() {
  if (!ctx || !hum) return
  const h = hum
  hum = null
  h.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15)
  setTimeout(() => {
    for (const k of ['a', 'b', 'c']) h[k].o.stop()
    h.p.disconnect()
  }, 800)
}

export function detentClick(pos = ORIGIN) {
  blip({ pos, type: 'square', f0: 1800, f1: 900, dur: 0.03, vol: 0.15 })
}

export function mitigationRise(pos = ORIGIN) {
  blip({ pos, type: 'triangle', f0: 220, f1: 880, dur: 0.6, vol: 0.25 })
}

export function correctionChime(pos = ORIGIN) {
  // rising three-note arpeggio
  blip({ pos, f0: 659.25, dur: 0.5, vol: 0.22 })
  blip({ pos, f0: 830.6, dur: 0.5, vol: 0.2, delay: 0.09 })
  blip({ pos, f0: 987.8, dur: 0.7, vol: 0.18, delay: 0.18 })
}
