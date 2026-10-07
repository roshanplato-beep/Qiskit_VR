import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

/**
 * Opt-in (?perf=1) probe: logs draw calls, triangles and mean frame time every 2 s and exposes the
 * latest numbers as window.__perf. No effect (and no cost) without the query flag.
 */
const on = typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1';

export function PerfProbe() {
  const acc = useRef({ t: 0, n: 0, ms: 0 });
  useFrame((state, dt) => {
    if (!on) return;
    const a = acc.current;
    a.t += dt; a.n++; a.ms += dt * 1000;
    if (a.t >= 2) {
      const info = state.gl.info;
      const out = { calls: info.render.calls, triangles: info.render.triangles, frameMs: +(a.ms / a.n).toFixed(2), fps: +(a.n / a.t).toFixed(1) };
      (window as any).__perf = out;
      console.log('[perf]', JSON.stringify(out));
      a.t = 0; a.n = 0; a.ms = 0;
    }
  });
  return null;
}
