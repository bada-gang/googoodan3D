/**
 * 마굿간 빛 연출: 창 · 판자 틈에서 내려오는 햇빛 줄기, 빛이 닿는 바닥 · 입구 바닥, 줄기 속 먼지.
 * 진짜 조명이 아니라 반투명 그림(더하기 섞기)이다. 해가 지면 옅어진다.
 *
 * 가볍게 (태블릿에서 반투명 판은 화면을 덮는 넓이만큼 무겁다):
 *  - 카메라가 고정이라 줄기는 카메라를 향한 판 한 장이면 된다 (양면 십자 6장 → 3장). 세 줄기를 한 모양으로 = 그리기 1번.
 *    줄기마다 세기는 꼭짓점 색으로 넣는다 (더하기 섞기에서는 색이 곧 밝기다).
 *  - 바닥 빛 두 곳도 한 모양 = 그리기 1번.
 *  - 먼지는 24개, 위치 계산은 두 프레임에 한 번.
 * 자리 · 세기는 barnLayout.ts 의 SHAFTS · FLOOR_GLOWS.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  PlaneGeometry,
  Vector3,
  type MeshBasicMaterial,
  type PointsMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { daylight, glowTexture } from '../../rendering/dayNight';
import { BARN_VIEW, COLORS, FLOOR_GLOWS, SHAFTS } from './barnLayout';

export function BarnLight(): React.ReactElement {
  const main = SHAFTS[0];
  return (
    <group>
      <Shafts />
      <FloorGlows />
      <Dust from={main.from} to={main.to} />
    </group>
  );
}

/* ------------------------------- 햇빛 줄기 ------------------------------- */

let shaftTextureCache: CanvasTexture | null = null;
/** 가로는 가운데가 밝고 가장자리로 흐려지고, 세로는 위(창 쪽)가 밝고 아래로 옅어진다 */
function shaftTexture(): CanvasTexture {
  if (shaftTextureCache) return shaftTextureCache;
  const w = 32;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  const image = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1); // 0 = 위
    const along = 1 - 0.7 * v;
    const ends = Math.min(1, v / 0.08) * Math.min(1, (1 - v) / 0.15);
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x / (w - 1) - 0.5) * 2;
      const across = Math.pow(Math.max(0, 1 - u), 1.6);
      const i = (y * w + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = Math.round(along * ends * across * 255);
    }
  }
  g.putImageData(image, 0, 0);
  shaftTextureCache = new CanvasTexture(canvas);
  return shaftTextureCache;
}

/** 꼭짓점 색 (세기 × 햇빛 색) */
function tint(geometry: BufferGeometry, strength: number): BufferGeometry {
  const color = new Color(COLORS.sunlight).multiplyScalar(strength);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

const CAMERA = new Vector3(...BARN_VIEW.position);

/** 줄기 하나: 바닥 점 → 창 점을 잇는, 카메라를 향한 판 (질감 위쪽 = 창) */
function shaftQuad(from: [number, number, number], to: [number, number, number], width: number, strength: number): BufferGeometry {
  const top = new Vector3(...from);
  const bottom = new Vector3(...to);
  const along = top.clone().sub(bottom).normalize();
  const middle = top.clone().add(bottom).multiplyScalar(0.5);
  const toCamera = CAMERA.clone().sub(middle).normalize();
  const across = new Vector3().crossVectors(along, toCamera).normalize().multiplyScalar(width / 2);
  const corners = [bottom.clone().sub(across), bottom.clone().add(across), top.clone().add(across), top.clone().sub(across)];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return tint(geometry, strength);
}

function Shafts(): React.ReactElement {
  const geometry = useMemo(() => {
    const quads = SHAFTS.map((s) => shaftQuad(s.from, s.to, s.width, s.strength));
    const merged = mergeGeometries(quads, false);
    for (const quad of quads) quad.dispose();
    return merged;
  }, []);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!material.current) return;
    // 아주 천천히 숨 쉬듯 (4.8초), 해가 질수록 사라진다
    const breathe = 0.9 + 0.1 * Math.sin((clock.elapsedTime * (Math.PI * 2)) / 4.8);
    material.current.opacity = breathe * (1 - daylight.darkness);
  });
  return (
    <mesh geometry={geometry} renderOrder={2} frustumCulled={false}>
      <meshBasicMaterial
        ref={material}
        map={shaftTexture()}
        vertexColors
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* -------------------------------- 바닥 빛 -------------------------------- */

/** 바닥에 번지는 빛 (햇빛이 닿는 곳 · 입구). 밤에는 조금만 남는다 (달빛) */
function FloorGlows(): React.ReactElement {
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

/* ---------------------------------- 먼지 ---------------------------------- */

/** 햇빛 줄기 속을 천천히 떠도는 먼지 */
const DUST_COUNT = 24;

function Dust({ from, to }: { from: [number, number, number]; to: [number, number, number] }): React.ReactElement {
  const material = useRef<PointsMaterial>(null);
  const frame = useRef(0);
  const seeds = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, (_, i) => ({
        t: (i * 0.618) % 1,
        side: ((i * 0.377) % 1) - 0.5,
        depth: ((i * 0.791) % 1) - 0.5,
        speed: 0.012 + ((i * 0.233) % 1) * 0.02,
        phase: i * 1.7,
      })),
    [],
  );
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(DUST_COUNT * 3), 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    const day = 1 - daylight.darkness;
    if (material.current) material.current.opacity = 0.75 * day;
    // 밤에는 안 보이니 계산하지 않고, 낮에도 두 프레임에 한 번만 (아주 느려서 티가 안 난다)
    if (day < 0.05 || frame.current++ % 2 !== 0) return;
    const time = clock.elapsedTime;
    const attribute = geometry.getAttribute('position') as Float32BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      const s = seeds[i];
      // 줄기를 따라 아주 천천히 내려가고, 좌우로 살랑인다
      const t = (s.t + time * s.speed) % 1;
      const wobble = Math.sin(time * 0.6 + s.phase) * 0.12;
      attribute.setXYZ(
        i,
        from[0] + (to[0] - from[0]) * t + s.side * 1.1 + wobble,
        from[1] + (to[1] - from[1]) * t + 0.15,
        from[2] + (to[2] - from[2]) * t + s.depth * 0.8,
      );
    }
    attribute.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        color="#fff4d0"
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.75}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
