import { useLab, type SceneId } from './store';
import { SETTING_IDS, type SettingId } from '../data/bundle';

/** URL state: ?case=<id>&n=<N0..N4>&mit=<0|1>&split=<val|test>&scene=<lab|wall|verdict> */
export function readUrlState() {
  const q = new URLSearchParams(location.search);
  const patch: Partial<ReturnType<typeof useLab.getState>> = {};
  const n = q.get('n') as SettingId | null;
  if (n && SETTING_IDS.includes(n)) patch.setting = n;
  const mit = q.get('mit');
  if (mit === '0' || mit === '1') patch.mitigation = Number(mit) as 0 | 1;
  const split = q.get('split');
  if (split === 'val' || split === 'test') patch.split = split;
  const scene = q.get('scene') as SceneId | null;
  if (scene === 'lab' || scene === 'wall' || scene === 'verdict') patch.scene = scene;
  const c = q.get('case');
  if (c) patch.caseId = c;
  useLab.setState(patch);
}

export function startUrlSync() {
  const write = () => {
    const s = useLab.getState();
    if (!s.bundle) return;
    const q = new URLSearchParams(location.search);
    q.set('case', s.caseId); q.set('n', s.setting); q.set('mit', String(s.mitigation));
    q.set('split', s.split); q.set('scene', s.scene);
    history.replaceState(null, '', `${location.pathname}?${q.toString()}${location.hash}`);
  };
  return useLab.subscribe(write);
}

export const webUrl = () => import.meta.env.VITE_WEB_URL ?? '../index.html#cases';
