import { useMemo } from 'react';
import { useLab } from '../state/store';
import { SETTING_IDS } from '../data/bundle';
import { CanvasBoard, type BoardItem } from '../ui3d/CanvasBoard';
import { webUrl } from '../state/url';
import { init as sfxInit } from '../audio/sfx';

/**
 * One shared in-world control board (left of the plinth) for setting / mitigation / split / case /
 * scene / tour. Mirrors the HTML DesktopBar. Lives in plinth space, so grab-to-move carries it along.
 * The whole board is one canvas texture on one plane (1 draw call).
 */
export const BOARD_W = 0.5;

export function ControlBoard() {
  const s = useLab();
  const items = useMemo(() => {
    const it: BoardItem[] = [];
    const btn = (label: string, x: number, y: number, w: number, onPress: () => void, o: Partial<BoardItem> = {}) =>
      it.push({ kind: 'button', x, y, w, h: 0.05, label, onPress: () => { sfxInit(); onPress(); }, ...o });
    const txt = (label: string, x: number, y: number, w = 0.3) => it.push({ kind: 'text', x, y, w, h: 0.03, label, size: 0.016 });
    let y = 0.05;
    txt('Scene', 0.016, y); y += 0.03;
    btn('Lab', 0.016, y, 0.15, () => s.setScene('lab'), { active: s.scene === 'lab', glyph: 'A' });
    btn('Wall', 0.176, y, 0.15, () => s.setScene('wall'), { active: s.scene === 'wall', glyph: 'C' });
    btn('Verdict', 0.336, y, 0.15, () => s.setScene('verdict'), { active: s.scene === 'verdict', glyph: 'D' });
    y += 0.06;
    if (s.scene === 'lab') {
      if (s.fromWall) { btn('Back to wall', 0.016, y, 0.475, () => { s.setFromWall(false); s.setScene('wall'); }, { glyph: '<' }); y += 0.06; }
      btn('Encoding', 0.016, y, 0.235, () => s.setView('encode'), { active: s.view === 'encode' });
      btn('Circuit', 0.256, y, 0.235, () => s.setView('circuit'), { active: s.view === 'circuit' });
      y += 0.06;
      txt('Noise setting', 0.016, y); y += 0.03;
      SETTING_IDS.forEach((id, i) => btn(id, 0.016 + i * 0.096, y, 0.088, () => s.setSetting(id), { active: s.setting === id }));
      y += 0.06;
      btn(s.mitigation ? 'Mitigation ON' : 'Mitigation OFF', 0.016, y, s.view === 'circuit' ? 0.235 : 0.475,
        () => s.setMitigation(s.mitigation ? 0 : 1), { active: s.mitigation === 1 });
      if (s.view === 'circuit') btn(s.ablation ? 'No-CX ON' : 'No-CX OFF', 0.256, y, 0.235, () => s.setAblation(!s.ablation), { active: s.ablation });
      y += 0.06;
      const list = s.derived?.casesBySplit[s.split] ?? [];
      const idx = Math.max(0, list.findIndex((c) => c.id === s.caseId));
      const go = (d: number) => { if (list.length) s.setCase(list[(idx + d + list.length) % list.length].id); };
      btn('< Prev', 0.016, y, 0.11, () => go(-1));
      txt(`${s.split === 'val' ? 'val' : 'test'} case ${idx + 1}/${list.length}`, 0.14, y + 0.01, 0.23);
      btn('Next >', 0.38, y, 0.11, () => go(1));
      y += 0.06;
    }
    txt('Cases from', 0.016, y); y += 0.03;
    btn('Validation', 0.016, y, 0.235, () => s.setSplit('val'), { active: s.split === 'val' });
    btn('Test', 0.256, y, 0.235, () => s.setSplit('test'), { active: s.split === 'test' });
    y += 0.06;
    btn(s.tourStep ? `Tour next (${s.tourStep}/8)` : 'Start tour', 0.016, y, 0.235, () => s.setTourStep(s.tourStep >= 8 ? 0 : s.tourStep + 1));
    btn(s.speak ? 'Voice ON' : 'Voice OFF', 0.256, y, 0.235, () => s.setSpeak(!s.speak), { active: s.speak, glyph: 'S' });
    y += 0.06;
    btn('Back to console', 0.016, y, 0.475, () => { window.location.href = webUrl(); });
    return it;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.scene, s.view, s.setting, s.mitigation, s.ablation, s.split, s.caseId, s.tourStep, s.speak, s.derived, s.fromWall]);
  const h = Math.max(...items.map((i) => i.y + i.h)) + 0.02;
  return <CanvasBoard width={BOARD_W} height={h} title="Controls" items={items}
    position={[-0.98, 1.4 - h / 2 + 0.1, 0.1]} rotation={[0, 0.5, 0]} />;
}
