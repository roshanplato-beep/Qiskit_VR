import { createXRStore } from '@react-three/xr';

// Quest 2 = virtual reality only. No planeDetection / hitTest / anchors: the lab is virtual.
// foveation is 0..1 in @react-three/xr 6.6 (not 2); 1 = maximum, see DECISIONS.md.
export const xrStore = createXRStore({
  emulate: 'metaQuest2',
  frameRate: 'high',
  foveation: 1,
  handTracking: true,
  offerSession: false,
});
