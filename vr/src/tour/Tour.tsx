import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useLab } from '../state/store';
import { PLINTH_TOP } from '../xr/Placement';
import { Label } from '../xr/Label';
import { Button3D } from '../ui3d/Button3D';
import { xrStore } from '../xr/xrStore';
import { haptic } from '../xr/haptics';

/**
 * Scene E: guided tour, 8 steps. The tour only SETS STATE (scene / view / setting / mitigation);
 * it never moves the user's head or the world. Captions are always on; narration through
 * speechSynthesis is optional behind the Voice toggle. Next = A button (or X on the left
 * controller), a ray/pinch on the in-world Next button, or the HTML bar.
 */
export const TOUR_STEPS: { caption: string[] }[] = [
  { caption: ['1 / 8  The lab appears.', 'A virtual lab: a plinth with one real CT patch.'] },
  { caption: ['2 / 8  One nodule -> four numbers -> four rotations.', 'Four features become four encoding angles.'] },
  { caption: ['3 / 8  The circuit.', 'Rebuilt from the recorded gates: encoding, trainable (frozen), CX bridges.'] },
  { caption: ['4 / 8  Noiseless (solid white) vs noisy (dashed amber) Bloch arrows.', 'Each noisy arrow is compared with its own noiseless ghost.'] },
  { caption: ['5 / 8  The decision wall at N0 (noiseless).', 'Each orb is a case; depth = score minus threshold.'] },
  { caption: ['6 / 8  Lever to N4: noisy repeats cross the wall.', 'Red sparks are repeats whose decision flipped. U = review flag.'] },
  { caption: ['7 / 8  Mitigation ON: most repeats return.', 'Read the cost: 3x the shots and a larger run-to-run spread.'] },
  { caption: ['8 / 8  Verdict: not distinguishable from logistic regression.', 'No quantum-advantage claim. Research prototype.'] },
];

export function applyTourStep(step: number) {
  const st = useLab.getState();
  switch (step) {
    case 1: st.setScene('lab'); st.setView('encode'); st.setSetting('N0'); st.setMitigation(0); st.setAblation(false); break;
    case 2: st.setScene('lab'); st.setView('encode'); st.setCase(st.caseId); break; // replays the strands
    case 3: st.setScene('lab'); st.setView('circuit'); break;
    case 4: st.setScene('lab'); st.setView('circuit'); st.setSetting('N4'); break;
    case 5: st.setScene('wall'); st.setSetting('N0'); st.setMitigation(0); break;
    case 6: st.setScene('wall'); st.setSetting('N4'); st.setMitigation(0); break;
    case 7: st.setScene('wall'); st.setSetting('N4'); st.setMitigation(1); break;
    case 8: st.setScene('verdict'); break;
  }
}

export function Tour() {
  const step = useLab((s) => s.tourStep);
  const speak = useLab((s) => s.speak);
  const setStep = useLab((s) => s.setTourStep);
  const prevBtn = useRef(false);

  useEffect(() => { if (step > 0) applyTourStep(step); }, [step]);

  useEffect(() => {
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!ss) return;
    ss.cancel();
    if (speak && step > 0) {
      const u = new SpeechSynthesisUtterance(TOUR_STEPS[step - 1].caption.join(' ').replace('->', 'to'));
      u.rate = 0.95; ss.speak(u);
    }
    return () => { ss.cancel(); };
  }, [speak, step]);

  // A button (right controller) or X (left) advances; edge-triggered
  useFrame(() => {
    const session = xrStore.getState().session;
    if (!session || useLab.getState().tourStep === 0) return;
    let pressed = false;
    for (const src of session.inputSources) {
      const b = src.gamepad?.buttons?.[4];
      if (b?.pressed) pressed = true;
    }
    if (pressed && !prevBtn.current) { haptic(0.4, 25); next(); }
    prevBtn.current = pressed;
  });

  const next = () => { const s = useLab.getState().tourStep; setStep(s >= 8 ? 0 : s + 1); };
  if (step === 0) return null;
  const cap = TOUR_STEPS[step - 1].caption;
  return (
    <group>
      <Label text={cap} width={0.95} px={44} color="#ffffff" bg="#0b1b28f0" align="left"
        position={[0, PLINTH_TOP + 0.9, 0.05]} />
      <Button3D label={step >= 8 ? 'End tour' : 'Next'} glyph=">" width={0.16} height={0.06}
        position={[0.62, PLINTH_TOP + 0.9, 0.05]} onPress={next} />
    </group>
  );
}
