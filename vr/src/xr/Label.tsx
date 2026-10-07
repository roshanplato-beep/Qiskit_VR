import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Procedural text label (canvas texture on a plane). No font download, no drei <Html>.
 * width is the plane width in metres; height follows the canvas aspect.
 */
export interface LabelProps {
  text: string | string[];
  width?: number;
  px?: number;                 // canvas font size in pixels
  color?: string;
  bg?: string | null;
  align?: 'left' | 'center';
  position?: [number, number, number];
  rotation?: [number, number, number];
  bold?: boolean;
}

export function Label({ text, width = 0.5, px = 56, color = '#e8f1ff', bg = null, align = 'center', position, rotation, bold }: LabelProps) {
  const lines = Array.isArray(text) ? text : [text];
  const { tex, aspect } = useMemo(() => {
    const pad = px * 0.5;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = `${bold ? '700 ' : ''}${px}px system-ui, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2);
    const h = Math.ceil(lines.length * px * 1.25 + pad * 2);
    c.width = w; c.height = h;
    ctx.font = font; ctx.textBaseline = 'middle';
    if (bg) { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, w, h, px * 0.4); ctx.fill(); }
    ctx.fillStyle = color;
    ctx.textAlign = align === 'center' ? 'center' : 'left';
    lines.forEach((l, i) => ctx.fillText(l, align === 'center' ? w / 2 : pad, pad + px * 0.625 + i * px * 1.25));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { tex: t, aspect: w / h };
  }, [lines.join('\n'), px, color, bg, align, bold]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} rotation={rotation} renderOrder={5}>
      <planeGeometry args={[width, width / aspect]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
