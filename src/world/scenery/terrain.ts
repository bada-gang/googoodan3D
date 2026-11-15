/**
 * 맵 가장자리 지형: 걸어 다니는 범위 밖에서 땅이 자연스럽게 솟아올라 숲 언덕 · 산으로 이어진다.
 *
 * 카메라는 비스듬히 내려다봐서 지평선이 화면에 들어오지 않는다. 대신 화면 위쪽에는 경계 너머 20m 쯤의 땅이 보인다.
 * 그 땅이 평평하게 끝나면 "맵을 잘랐다"는 느낌이 나서, 경계에서 바깥으로 갈수록 언덕이 되어 화면 위쪽을 채우게 했다.
 *
 * 모양 · 색은 장면에 들어갈 때 한 번만 계산한다 (매 프레임 바뀌는 것이 없다). 고정된 씨앗이라 매번 같은 풍경이다.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 걸어 다니는 범위 밖으로 평평한 잔디를 더 까는 폭 (m). 그 밖부터 지형이 솟는다 */
export const FLAT_EDGE = 1.5;
/** 카메라 쪽(남쪽)은 지형을 두지 않는다 (화면을 가린다). 평평한 잔디를 이만큼 더 깐다 */
const SOUTH_FLAT = 30;
/** 지형을 까는 범위 (평평한 잔디 바깥으로) */
const SIDE_REACH = 40;
const BACK_REACH = 45;
/** 지형 격자 간격 (m) */
const STEP = 1;
/** 잔디 질감 한 장이 덮는 크기 (m). 평평한 잔디(GrassGround)와 같아야 이음매에서 무늬가 맞는다 */
export const GRASS_TILE = 4;

/** 평평한 잔디 네모. 지형은 이 밖에만 깐다 */
export function flatRect(b: Bounds): Bounds {
  return { minX: b.minX - FLAT_EDGE, maxX: b.maxX + FLAT_EDGE, minZ: b.minZ - FLAT_EDGE, maxZ: b.maxZ + SOUTH_FLAT };
}

/** 평평한 잔디 밖으로 얼마나 나왔는지 (m). 안이면 0 */
export function outsideDistance(b: Bounds, x: number, z: number): number {
  const r = flatRect(b);
  const dx = Math.max(r.minX - x, 0, x - r.maxX);
  const dz = Math.max(r.minZ - z, 0);
  return Math.hypot(dx, dz);
}

/* ------------------------------- 잡음 (값 잡음) ------------------------------- */

function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth01(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth01(x - x0);
  const fz = smooth01(z - z0);
  const a = hash(x0, z0);
  const b = hash(x0 + 1, z0);
  const c = hash(x0, z0 + 1);
  const d = hash(x0 + 1, z0 + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** 여러 크기의 잡음을 겹친 것 (0~1) */
export function fbm(x: number, z: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += valueNoise(x * freq, z * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / 0.9375;
}

export function smoothstep(a: number, b: number, t: number): number {
  return smooth01(Math.min(1, Math.max(0, (t - a) / (b - a))));
}

/* --------------------------------- 높이 --------------------------------- */

/**
 * 땅 높이 (m). 평평한 잔디 가장자리에서 0 으로 시작해
 *  - 처음 몇 m 는 둔덕처럼 완만하게 (덤불 · 나무 줄이 선다)
 *  - 그 밖으로 꾸준히 오르는 숲 언덕 (잡음으로 굽이친다)
 *  - 아주 멀리는 산등성이
 */
export function terrainHeight(b: Bounds, x: number, z: number): number {
  const d = outsideDistance(b, x, z);
  if (d <= 0) return 0;
  const ramp = smoothstep(0, 5, d);
  const climb = Math.max(0, d - 2) * 0.3;
  const hills = (fbm(x * 0.07, z * 0.07) - 0.35) * (1.4 + d * 0.16) * ramp;
  const ridge = smoothstep(16, 34, d) * fbm(x * 0.03 + 7, z * 0.03 + 3) * 12;
  return Math.max(0, ramp * 0.5 + climb + hills + ridge);
}

/* --------------------------------- 색 --------------------------------- */

const MEADOW = new Color('#ffffff');
const FOREST_FLOOR = new Color('#7d9a6a');
const DEEP_FOREST = new Color('#5f7f5a');
const HIGH_GROUND = new Color('#8f9c84');

/** 땅 색 (잔디 질감에 곱한다). 가장자리는 평평한 잔디와 같은 흰색, 숲 바닥은 어둡게, 높은 곳은 회록색 */
function groundTint(b: Bounds, x: number, z: number, h: number, out: Color): Color {
  const d = outsideDistance(b, x, z);
  out.copy(MEADOW).lerp(FOREST_FLOOR, smoothstep(0.5, 5, d));
  out.lerp(DEEP_FOREST, smoothstep(6, 18, d) * (0.4 + fbm(x * 0.15, z * 0.15) * 0.6));
  out.lerp(HIGH_GROUND, smoothstep(8, 18, h) * 0.6);
  return out;
}

/* ------------------------------- 모양 만들기 ------------------------------- */

/**
 * 지형 모양 한 개 (그리기 1번). 평평한 잔디 네모 밖에만 면이 있다.
 * 격자선이 잔디 네모의 변과 정확히 겹치게 잡아, 이음매에서 높이 0 · 질감 좌표가 딱 맞는다.
 */
export function buildTerrain(b: Bounds): BufferGeometry {
  const r = flatRect(b);
  const x0 = r.minX - SIDE_REACH;
  const z0 = r.minZ - BACK_REACH;
  const cols = Math.round((r.maxX + SIDE_REACH - x0) / STEP);
  const rows = Math.round((r.maxZ - z0) / STEP);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const tint = new Color();
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const x = x0 + i * STEP;
      const z = z0 + j * STEP;
      const h = terrainHeight(b, x, z);
      positions.push(x, h, z);
      // 평평한 잔디와 같은 질감 좌표 (왼쪽 · 아래 변 기준)
      uvs.push((x - r.minX) / GRASS_TILE, (r.maxZ - z) / GRASS_TILE);
      groundTint(b, x, z, h, tint);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  const index: number[] = [];
  const inside = (x: number, z: number) => x > r.minX + 1e-6 && x < r.maxX - 1e-6 && z > r.minZ + 1e-6;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      // 칸 가운데가 잔디 네모 안이면 건너뛴다
      const cx = x0 + (i + 0.5) * STEP;
      const cz = z0 + (j + 0.5) * STEP;
      if (inside(cx, cz)) continue;
      const a = j * (cols + 1) + i;
      const c = a + cols + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------- 나무 자리 ------------------------------- */

export type SceneryKind = 'tree' | 'pine' | 'bush';

export interface SceneryItem {
  kind: SceneryKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  /** 좌우 뒤집기 (같은 그림이 덜 반복돼 보이게) */
  flip: boolean;
}

/**
 * 숲 · 덤불 자리. 고정된 씨앗이라 매번 같은 숲이다.
 *  - 잔디 가장자리: 덤불 줄 + 드문드문 나무 (이음매를 가린다)
 *  - 그 밖: 빽빽한 숲. 멀고 높을수록 침엽수가 많다. 잡음으로 숲 사이 빈터를 남긴다
 * 카메라 쪽(남쪽) 옆구리는 화면 아래 모서리를 가리지 않게 비운다.
 */
export function sceneryItems(b: Bounds): SceneryItem[] {
  const r = flatRect(b);
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const items: SceneryItem[] = [];
  const southLimit = b.maxZ - 1;
  const add = (kind: SceneryKind, x: number, z: number, scale: number) => {
    if (z > southLimit) return;
    if (outsideDistance(b, x, z) <= 0.2) return;
    items.push({ kind, x, y: terrainHeight(b, x, z), z, scale, flip: random() > 0.5 });
  };

  // 가장자리 덤불 줄 (서 · 북 · 동). 둘레를 따라 걷는다
  const edgePoints: { x: number; z: number; nx: number; nz: number }[] = [];
  for (let z = southLimit; z > r.minZ; z -= 1.4) edgePoints.push({ x: r.minX, z, nx: -1, nz: 0 });
  for (let x = r.minX; x < r.maxX; x += 1.4) edgePoints.push({ x, z: r.minZ, nx: 0, nz: -1 });
  for (let z = r.minZ; z < southLimit; z += 1.4) edgePoints.push({ x: r.maxX, z, nx: 1, nz: 0 });
  for (const p of edgePoints) {
    const out = 0.6 + random() * 1.0;
    const slide = (random() - 0.5) * 0.8;
    add('bush', p.x + p.nx * out + p.nz * slide, p.z + p.nz * out + p.nx * slide, 0.8 + random() * 0.5);
    if (random() < 0.6) {
      const back = 2 + random() * 2;
      add(random() < 0.3 ? 'pine' : 'tree', p.x + p.nx * back, p.z + p.nz * back, 0.75 + random() * 0.35);
    }
  }

  // 숲: 흔들린 격자
  const spacing = 2.2;
  for (let z = r.minZ - 32; z < southLimit; z += spacing) {
    for (let x = r.minX - 30; x < r.maxX + 30; x += spacing) {
      const px = x + (random() - 0.5) * spacing * 0.9;
      const pz = z + (random() - 0.5) * spacing * 0.9;
      const d = outsideDistance(b, px, pz);
      if (d < 2.6 || d > 28) continue;
      // 빈터: 잡음이 낮은 곳은 비운다
      if (fbm(px * 0.09 + 20, pz * 0.09) < 0.3) {
        if (random() < 0.15) add('bush', px, pz, 0.9 + random() * 0.5);
        continue;
      }
      const pineChance = 0.15 + smoothstep(8, 24, d) * 0.5;
      add(random() < pineChance ? 'pine' : 'tree', px, pz, 0.8 + random() * 0.5);
    }
  }
  // 카메라에 가까운 것(남쪽)부터 그린다. 뒤에 가려지는 나무는 깊이 검사에서 일찍 걸러져 덜 칠한다
  items.sort((a, c) => c.z - a.z);
  return items;
}
