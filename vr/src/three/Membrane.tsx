import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface MembraneHandle { addHit: (x: number, y: number) => void }
export interface MembraneProps {
  width?: number; height?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;          // base tint
  rippleSpeed?: number;    // plane units per second
  rippleLife?: number;     // seconds
  /** if set, the membrane is a vertical cylinder section of this radius and arc (rad), centred on -z, bulging away from the origin */
  radius?: number;
  arc?: number;
}

const MAX_HITS = 12;

const vert = /* glsl */ `
uniform float uFlip;
uniform vec2 uSize;
varying vec2 vPos; varying vec3 vN; varying vec3 vV;
void main(){
  vPos = vec2((0.5 - uv.x) * uSize.x * uFlip + (uv.x - 0.5) * uSize.x * (1.0 - uFlip), (uv.y - 0.5) * uSize.y);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
precision mediump float;
uniform vec3 uColor; uniform float uTime; uniform float uSpeed; uniform float uLife;
uniform vec3 uHits[${MAX_HITS}];
varying vec2 vPos; varying vec3 vN; varying vec3 vV;
void main(){
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float rip = 0.0;
  for(int i=0;i<${MAX_HITS};i++){
    float age = uTime - uHits[i].z;
    if(uHits[i].z > 0.0 && age >= 0.0 && age < uLife){
      float d = distance(vPos, uHits[i].xy);
      float r = age * uSpeed;
      float ring = exp(-pow((d - r) * 28.0, 2.0));
      rip += ring * (1.0 - age / uLife);
    }
  }
  float a = clamp(0.16 + 0.55 * fres + 0.6 * rip, 0.0, 0.92);
  gl_FragColor = vec4(uColor + vec3(rip * 0.5), a);
}`;

export const Membrane = forwardRef<MembraneHandle, MembraneProps>(function Membrane(
  { width = 1, height = 0.6, position, rotation, color = '#7fd4ff', rippleSpeed = 0.35, rippleLife = 1.4, radius, arc }, ref,
) {
  const next = useRef(0);
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uSize: { value: new THREE.Vector2(radius && arc ? radius * arc : width, height) },
    uFlip: { value: radius && arc ? 1 : 0 },
    uTime: { value: 0.01 },
    uSpeed: { value: rippleSpeed },
    uLife: { value: rippleLife },
    uHits: { value: Array.from({ length: MAX_HITS }, () => new THREE.Vector3(0, 0, -1)) },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    /** x,y in the plane's local units. Ring buffer of 12; oldest hit is overwritten. */
    addHit(x: number, y: number) {
      const i = next.current;
      next.current = (i + 1) % MAX_HITS;
      uniforms.uHits.value[i].set(x, y, Math.max(uniforms.uTime.value, 0.001));
    },
  }), [uniforms]);

  useFrame((s) => { uniforms.uTime.value = s.clock.elapsedTime + 0.01; });

  return (
    <mesh position={position} rotation={rotation}>
      {radius && arc
        ? <cylinderGeometry args={[radius, radius, height, 48, 1, true, Math.PI - arc / 2, arc]} />
        : <planeGeometry args={[width, height, 1, 1]} />}
      <shaderMaterial uniforms={uniforms} vertexShader={vert} fragmentShader={frag}
        transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
});
