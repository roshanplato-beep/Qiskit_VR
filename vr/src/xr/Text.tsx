import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Drop-in replacement for drei <Text> (which downloads a CDN font). Canvas texture on a plane;
 * fontSize is the glyph height in metres. Supports anchorX/anchorY, maxWidth (word wrap), lineHeight.
 */
export interface TextProps {
  children?: string | number | (string | number)[];
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  lineHeight?: number;
  bold?: boolean;
}

const PX = 64; // canvas pixels per fontSize
const FONT = 'system-ui, "Segoe UI", sans-serif';

export function Text({ children, position, fontSize = 0.02, color = '#ffffff', anchorX = 'center', anchorY = 'middle', maxWidth, lineHeight = 1.2, bold }: TextProps) {
  const raw = Array.isArray(children) ? children.join('') : String(children ?? '');
  const { tex, w, h } = useMemo(() => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `${bold ? '700 ' : ''}${PX}px ${FONT}`;
    ctx.font = font;
    const maxPx = maxWidth ? (maxWidth / fontSize) * PX : Infinity;
    const lines: string[] = [];
    for (const para of raw.split('\n')) {
      let cur = '';
      for (const word of para.split(' ')) {
        const t = cur ? cur + ' ' + word : word;
        if (cur && ctx.measureText(t).width > maxPx) { lines.push(cur); cur = word; } else cur = t;
      }
      lines.push(cur);
    }
    const pad = PX * 0.15;
    const lh = PX * lineHeight;
    const cw = Math.max(8, Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2));
    const ch = Math.max(8, Math.ceil(lines.length * lh + pad * 2));
    c.width = cw; c.height = ch;
    ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.textAlign = anchorX === 'left' ? 'left' : anchorX === 'right' ? 'right' : 'center';
    const x = anchorX === 'left' ? pad : anchorX === 'right' ? cw - pad : cw / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, pad + lh / 2 + i * lh));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const k = fontSize / PX;
    return { tex: t, w: cw * k, h: ch * k };
  }, [raw, fontSize, color, anchorX, maxWidth, lineHeight, bold]);
  useEffect(() => () => tex.dispose(), [tex]);
  const ox = anchorX === 'left' ? w / 2 : anchorX === 'right' ? -w / 2 : 0;
  const oy = anchorY === 'top' ? -h / 2 : anchorY === 'bottom' ? h / 2 : 0;
  const p = position ?? [0, 0, 0];
  return (
    <mesh position={[p[0] + ox, p[1] + oy, p[2]]} renderOrder={5}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
