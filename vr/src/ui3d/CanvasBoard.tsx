import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { flipClick } from '../audio/sfx';
import { haptic } from '../xr/haptics';

/**
 * A whole control panel drawn into ONE canvas texture on ONE plane (1 draw call, 1 text instance),
 * with ray/pinch hit-testing through the pointer uv. Keeps Quest 2 draw calls low.
 * Units are metres, measured from the board's top-left corner. Every button is >= 4 cm.
 */
export interface BoardItem {
  kind: 'button' | 'text';
  x: number; y: number; w: number; h: number;
  label: string;
  glyph?: string;            // letter/symbol so colour is never the only cue
  active?: boolean;
  disabled?: boolean;
  size?: number;             // text height in metres (defaults from h)
  align?: 'left' | 'center';
  color?: string;
  onPress?: () => void;
}

export interface CanvasBoardProps {
  width: number; height: number;
  items: BoardItem[];
  title?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

const PPM = 2000; // canvas pixels per metre

export function CanvasBoard({ width, height, items, title, position, rotation }: CanvasBoardProps) {
  const [hover, setHover] = useState(-1);
  const [down, setDown] = useState(-1);
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = Math.round(width * PPM); c.height = Math.round(height * PPM);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return { canvas: c, tex: t };
  }, [width, height]);
  useEffect(() => () => tex.dispose(), [tex]);

  useEffect(() => {
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d141d'; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 28); ctx.fill();
    ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(3, 3, W - 6, H - 6, 28); ctx.stroke();
    ctx.textBaseline = 'middle';
    if (title) {
      ctx.fillStyle = '#ffffff'; ctx.font = `700 ${0.026 * PPM}px system-ui, sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(title, 0.016 * PPM, 0.028 * PPM);
    }
    items.forEach((it, i) => {
      const x = it.x * PPM, y = it.y * PPM, w = it.w * PPM, h = it.h * PPM;
      const px = (it.size ?? Math.min(it.h * 0.42, 0.024)) * PPM;
      if (it.kind === 'text') {
        ctx.fillStyle = it.color ?? '#9fc4dc'; ctx.font = `${px}px system-ui, sans-serif`;
        ctx.textAlign = it.align ?? 'left';
        ctx.fillText(it.label, it.align === 'center' ? x + w / 2 : x, y + h / 2, w);
        return;
      }
      const isDown = down === i, isHover = hover === i;
      ctx.fillStyle = it.disabled ? '#1a1f29' : isDown ? '#ffffff' : isHover ? '#4a78c2' : it.active ? '#2b6f5e' : '#23324a';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
      if (it.active || isHover) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.fillStyle = isDown ? '#000000' : it.disabled ? '#7a8494' : '#ffffff';
      ctx.font = `${it.active ? '700 ' : ''}${px}px system-ui, sans-serif`; ctx.textAlign = 'center';
      const text = `${it.active ? '> ' : ''}${it.glyph ? it.glyph + ' ' : ''}${it.label}`;
      ctx.fillText(text, x + w / 2, y + h / 2 + 2, w * 0.94);
    });
    tex.needsUpdate = true;
  }, [items, hover, down, canvas, tex, title]);

  const itemsRef = useRef(items); itemsRef.current = items;
  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!e.uv) return -1;
    const mx = e.uv.x * width, my = (1 - e.uv.y) * height;
    const list = itemsRef.current;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (it.kind === 'button' && mx >= it.x && mx <= it.x + it.w && my >= it.y && my <= it.y + it.h) return i;
    }
    return -1;
  };

  return (
    <mesh position={position} rotation={rotation}
      onPointerMove={(e) => { e.stopPropagation(); const i = pick(e); if (i !== hover) setHover(i); }}
      onPointerOut={() => { setHover(-1); setDown(-1); }}
      onPointerDown={(e) => { e.stopPropagation(); const i = pick(e); if (i >= 0 && !itemsRef.current[i].disabled) setDown(i); }}
      onPointerUp={(e) => { e.stopPropagation(); setDown(-1); }}
      onClick={(e) => {
        e.stopPropagation();
        const i = pick(e);
        const it = i >= 0 ? itemsRef.current[i] : undefined;
        if (it && !it.disabled) { flipClick(); haptic(0.5, 25); it.onPress?.(); }
      }}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}
