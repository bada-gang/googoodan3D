/**
 * 마굿간 빛 연출: 창 아래 · 입구 바닥에 번지는 빛 (한 모양, 그리기 1번). 진짜 조명이 아니라 반투명 그림이다.
 *
 * 햇빛 줄기 · 먼지는 사용자 요청으로 뺐다 (2026-11-26, 그리기 호출을 30번대로 줄이려고).
 * 자리 · 세기는 barnLayout.ts 의 FLOOR_GLOWS.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Float32BufferAttribute, PlaneGeometry, type BufferGeometry, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { daylight, glowTexture } from '../../rendering/dayNight';
import { COLORS, FLOOR_GLOWS } from './barnLayout';

/** 꼭짓점 색 (세기 × 햇빛 색). 더하기 섞기에서는 색이 곧 밝기라 곳마다 세기를 따로 줄 수 있다 */
function tint(geometry: BufferGeometry, strength: number): BufferGeometry {
  const color = new Color(COLORS.sunlight).multiplyScalar(strength);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** 바닥에 번지는 빛 (창 아래 · 입구). 밤에는 조금만 남는다 (달빛) */
export function BarnLight(): React.ReactElement {
  const geometry = useMemo(() => {
    const planes = FLOOR_GLOWS.map((g) =>
      tint(new PlaneGeometry(g.width, g.depth).rotateX(-Math.PI / 2).translate(g.x, 0.02, g.z), g.strength),
    );
    const merged = mergeGeometries(planes, false);
    for (const plane of planes) plane.dispose();
    return merged;
  }, []);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (material.current) material.current.opacity = 0.3 + 0.7 * (1 - daylight.darkness);
  });
  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        ref={material}
        map={glowTexture()}
        vertexColors
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
