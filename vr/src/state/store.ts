import { create } from 'zustand';
import type { Bundle, SettingId } from '../data/bundle';
import type { Derived, Mit, Split } from '../data/derive';

export type SceneId = 'lab' | 'wall' | 'verdict';
export type LabView = 'encode' | 'circuit';

export interface LabState {
  bundle: Bundle | null;
  derived: Derived | null;
  loadError: string | null;
  caseId: string;
  setting: SettingId;
  mitigation: Mit;
  split: Split;
  scene: SceneId;
  tourStep: number;      // 0 = tour off, 1..8 = step
  ablation: boolean;
  /** inside the lab scene: A (encoding) or B (circuit sculpture) */
  view: LabView;
  /** optional speechSynthesis narration for the tour (captions are always on) */
  speak: boolean;
  /** true while a case chosen on the wall is being inspected in the lab (shows 'Back to wall') */
  fromWall: boolean;
  seated: boolean;
  /** user placement of the lab: metres on the floor and yaw in radians (snapped to 15 deg) */
  rig: { x: number; z: number; yaw: number };
  setLoaded: (b: Bundle, d: Derived) => void;
  setLoadError: (e: string) => void;
  setCase: (id: string) => void;
  setSetting: (s: SettingId) => void;
  setMitigation: (m: Mit) => void;
  setSplit: (s: Split) => void;
  setScene: (s: SceneId) => void;
  setTourStep: (n: number) => void;
  setAblation: (a: boolean) => void;
  setView: (v: LabView) => void;
  setSpeak: (v: boolean) => void;
  setFromWall: (v: boolean) => void;
  setSeated: (v: boolean) => void;
  setRig: (r: Partial<LabState['rig']>) => void;
  /** monotonically increasing; bumps whenever case or setting changes so scenes can replay pulses */
  tick: number;
}

export const useLab = create<LabState>((set) => ({
  bundle: null, derived: null, loadError: null,
  caseId: '', setting: 'N0', mitigation: 0, split: 'test', scene: 'lab', tourStep: 0,
  ablation: false, view: 'encode', speak: false, fromWall: false, seated: false, rig: { x: 0, z: -0.6, yaw: 0 }, tick: 0,
  setLoaded: (bundle, derived) => set((s) => ({
    bundle, derived, loadError: null,
    // keep a case from the URL if it exists, otherwise the first of the current split
    caseId: bundle.cases.some((c) => c.id === s.caseId) ? s.caseId
      : (derived.casesBySplit[s.split][0] ?? bundle.cases[0]).id,
  })),
  setLoadError: (loadError) => set({ loadError }),
  setCase: (caseId) => set((s) => ({ caseId, tick: s.tick + 1 })),
  setSetting: (setting) => set((s) => ({ setting, tick: s.tick + 1 })),
  setMitigation: (mitigation) => set((s) => ({ mitigation, tick: s.tick + 1 })),
  setSplit: (split) => set((s) => {
    const first = s.derived?.casesBySplit[split][0]?.id ?? s.caseId;
    const keep = s.bundle?.cases.find((c) => c.id === s.caseId)?.split === split;
    return { split, caseId: keep ? s.caseId : first, tick: s.tick + 1 };
  }),
  setScene: (scene) => set({ scene }),
  setTourStep: (tourStep) => set({ tourStep }),
  setAblation: (ablation) => set((s) => ({ ablation, tick: s.tick + 1 })),
  setView: (view) => set((s) => ({ view, tick: s.tick + 1 })),
  setSpeak: (speak) => set({ speak }),
  setFromWall: (fromWall) => set({ fromWall }),
  setSeated: (seated) => set({ seated }),
  setRig: (r) => set((s) => ({ rig: { ...s.rig, ...r } })),
}));
