/**
 * 마굿간 빛 연출: 창 · 판자 틈에서 내려오는 햇빛 줄기, 빛이 닿는 바닥, 줄기 속 먼지.
 * 진짜 조명이 아니라 반투명 그림(더하기 섞기)이다 — 태블릿에서 가볍다. 해가 지면 사라진다.
 * 줄기 자리 · 세기는 barnLayout.ts 의 SHAFTS.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
  type MeshBasicMaterial,
  type PointsMaterial,
} from 'three';
import { daylight, glowTexture } from '../../rendering/dayNight';
import { COLORS, SHAFTS } from './barnLayout';

const SUNLIGHT = new Color(COLORS.sunlight);
const UP = new Vector3(0, 1, 0);

export function SunShafts(): React.ReactElement {
  const main = SHAFTS[0];
  return (
    <group>
      {SHAFTS.map((shaft, i) => (
        <Shaft key={i} {...shaft} />
      ))}
      {/* 큰 줄기가 닿는 바닥이 밝다 */}
      <FloorGlow x={main.to[0]} z={main.to[2] - 0.2} width={2.2} depth={1.6} strength={0.42} dayOnly />
      <Dust from={main.from} to={main.to} />
    </group>
  );
}

/* ------------------------------- 햇빛 줄기 ------------------------------- */

let shaftTextureCache: CanvasTexture | null = null;
/** 가로는 가운데가 밝고 가장자리로 흐려지고, 세로는 위(창 쪽)가 밝고 아래로 옅어진다 */
function shaftTexture(): CanvasTexture {
  if (shaftTextureCache) return shaftTextureCache;
  const w = 64;
  const h = 128;
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

/** 창에서 바닥까지 비스듬한 반투명 띠 (어느 쪽에서 봐도 보이게 십자로 두 장) */
function Shaft({
  from,
  to,
  width,
  strength,
}: {
  from: [number, number, number];
  to: [number, number, number];
  width: number;
  strength: number;
}): React.ReactElement {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const direction = a.clone().sub(b);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      // 판의 세로(y)를 바닥 → 창 방향에 맞춘다 (질감 위쪽 = 창)
      quaternion: new Quaternion().setFromUnitVectors(UP, direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    // 아주 천천히 숨 쉬듯 (4.8초), 해가 질수록 사라진다
    const breathe = 0.9 + 0.1 * Math.sin((clock.elapsedTime * (Math.PI * 2)) / 4.8);
    const opacity = strength * breathe * (1 - daylight.darkness);
    for (const material of materials.current) if (material) material.opacity = opacity;
  });
  return (
    <group position={position} quaternion={quaternion}>
      {[0, Math.PI / 2].map((spin, i) => (
        <mesh key={i} rotation-y={spin} renderOrder={2}>
          <planeGeometry args={[width, length]} />
          <meshBasicMaterial
            ref={(m) => {
              materials.current[i] = m;
            }}
            map={shaftTexture()}
            color={SUNLIGHT}
            transparent
            opacity={strength}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* -------------------------------- 바닥 빛 -------------------------------- */

/** 바닥에 번지는 빛 (입구 · 햇빛이 닿는 곳). dayOnly 가 아니면 밤에도 조금 남는다 (달빛) */
export function FloorGlow({
  x,
  z,
  width,
  depth,
  strength,
  dayOnly = false,
}: {
  x: number;
  z: number;
  width: number;
  depth: number;
  strength: number;
  dayOnly?: boolean;
}): React.ReactElement {
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!material.current) return;
    const day = 1 - daylight.darkness;
    material.current.opacity = strength * (dayOnly ? day : 0.35 + 0.65 * day);
  });
  return (
    <mesh position={[x, 0.02, z]} rotation-x={-Math.PI / 2} renderOrder={1}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial
        ref={material}
        map={glowTexture()}
        color={SUNLIGHT}
        transparent
        opacity={strength}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ---------------------------------- 먼지 ---------------------------------- */

/** 햇빛 줄기 속을 천천히 떠도는 먼지 */
const DUST_COUNT = 40;

function Dust({ from, to }: { from: [number, number, number]; to: [number, number, number] }): React.ReactElement {
  const material = useRef<PointsMaterial>(null);
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
    if (material.current) material.current.opacity = 0.75 * (1 - daylight.darkness);
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        color="#fff4d0"
        size={0.06}
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
