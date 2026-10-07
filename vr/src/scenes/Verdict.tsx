import { useLab } from '../state/store';
import { PLINTH_TOP } from '../xr/Placement';
import { Text } from '../xr/Text';
import { Panel3D } from '../ui3d/Panel3D';

/**
 * Scene D: verdict podium. Three free-standing bars (quantum noiseless, logistic regression at 0.5,
 * logistic regression val-tuned) whose height is validation balanced accuracy, each with its 95%
 * CI whisker; bars start at 0 and the scale is fixed (1.0 = 0.8 m). The plaque reads
 * summary.comparison_val. Nothing is computed here: every number comes from bundle.summary.
 */
export const BAR_SCALE = 0.8;
const BAR_Z = -0.05;
const BAR_W = 0.16;

interface Bar { label: string; ba: number; ci: [number, number]; color: string; hint: string }

function Whisker({ x, ci, color }: { x: number; ci: [number, number]; color: string }) {
  const lo = ci[0] * BAR_SCALE, hi = ci[1] * BAR_SCALE;
  return (
    <group position={[x, 0, BAR_W / 2 + 0.01]}>
      <mesh position={[0, (lo + hi) / 2, 0]} scale={[0.012, Math.max(0.004, hi - lo), 0.012]}>
        <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={color} />
      </mesh>
      {[lo, hi].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} scale={[0.07, 0.012, 0.012]}>
          <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

export function Verdict() {
  const bundle = useLab((s) => s.bundle)!;
  const sum = bundle.summary ?? {};
  const q0 = sum.quantum_val?.find((r: any) => r.setting === 'N0');
  const cl = sum.classical_val ?? {};
  const cmp = sum.comparison_val;
  const bars: Bar[] = [];
  if (q0) bars.push({ label: 'Quantum (noiseless)', ba: q0.balanced_accuracy, ci: q0.ci, color: '#7fd4ff', hint: 'VQC' });
  if (cl.lr_at_0_5) bars.push({ label: 'Logistic regression @0.5', ba: cl.lr_at_0_5.balanced_accuracy, ci: cl.lr_at_0_5.ci, color: '#ffd27f', hint: 'LR' });
  if (cl.lr_val_tuned) bars.push({ label: 'Logistic regression (tuned)', ba: cl.lr_val_tuned.balanced_accuracy, ci: cl.lr_val_tuned.ci, color: '#c58bff', hint: 'LRt' });
  const xs = [-0.3, 0, 0.3];
  const fmt = (v: number) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
  const plaque = cmp
    ? `Quantum minus logistic regression (val-tuned): difference ${fmt(cmp.difference)}, 95% CI ${fmt(cmp.ci[0])} to ${fmt(cmp.ci[1])}: ${cmp.verdict}. No quantum-advantage claim.`
    : 'Comparison not present in this bundle.';
  return (
    <group>
      <group position={[0, PLINTH_TOP, 0]}>
      <Text position={[0, 1.0, BAR_Z]} fontSize={0.04} bold>Verdict podium - validation balanced accuracy</Text>
      <Text position={[0, 0.96, BAR_Z]} fontSize={0.018} color="#9fc4dc" anchorY="top">Bars start at 0; 1.0 = 0.8 m. Whiskers = 95% confidence interval.</Text>
      {bars.map((b, i) => (
        <group key={b.label}>
          <mesh position={[xs[i], (b.ba * BAR_SCALE) / 2, BAR_Z]} scale={[BAR_W, b.ba * BAR_SCALE, BAR_W]}>
            <boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color={b.color} />
          </mesh>
          <group position={[0, 0, BAR_Z]}><Whisker x={xs[i]} ci={b.ci} color="#ffffff" /></group>
          <Text position={[xs[i], b.ci[1] * BAR_SCALE + 0.03, BAR_Z + BAR_W / 2 + 0.02]} fontSize={0.022} anchorY="bottom" bold maxWidth={0.28}>
            {`${b.label}
${b.ba.toFixed(3)}  (CI ${b.ci[0].toFixed(2)} - ${b.ci[1].toFixed(2)})`}
          </Text>
        </group>
      ))}
      </group>
      <Panel3D width={0.46} height={0.3} position={[0.68, PLINTH_TOP + 0.35, 0.05]} rotation={[0, -0.45, 0]} tone="warn" title="Result" body={plaque} />
      <Panel3D width={0.4} height={0.14} position={[0.66, PLINTH_TOP + 0.12, 0.1]} rotation={[0, -0.45, 0]} tone="info" title="Disclaimer"
        body="Research prototype. Simulated quantum execution. Not a medical device." />
    </group>
  );
}
