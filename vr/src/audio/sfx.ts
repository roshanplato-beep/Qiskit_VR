// WebAudio-generated sounds, no files. All functions are safe no-ops before init().
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function init(): void {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC() as AudioContext;
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
  } catch { ctx = null; master = null; }
}

function tick(freq: number, dur: number, type: OscillatorType, peak: number, sweep = 0): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

/** Short tick paired with a haptic pulse when a lever passes a detent. */
export function detentClick(): void { tick(1800, 0.03, 'square', 0.35, -600); }
/** Lower, longer click for switches and buttons. */
export function flipClick(): void { tick(520, 0.06, 'triangle', 0.5, -200); }
