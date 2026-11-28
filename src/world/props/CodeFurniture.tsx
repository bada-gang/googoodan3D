/**
 * 코드로 만드는 가구: 정글짐 · 그네 (config/decor 의 codeBuilt).
 * 가는 막대가 많아 3D 변환(Hunyuan)으로 만들면 막대가 부러지고 면이 많아진다.
 * 막대 · 판을 모두 한 모양으로 합치고 색은 꼭짓점 색으로 넣어, 물건 하나가 그리기 호출 1번(+그림자 1번)이다.
 * 모양은 물건마다 한 번만 만들어 같은 물건끼리 나눠 쓴다.
 */
import { useMemo } from 'react';
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
  Matrix4,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 막대: from 에서 to 까지 (m) */
interface Bar {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: string;
}

/** 상자: 가운데 · 크기 (m) */
interface Block {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
}

type Part = Bar | Block;

const UP = new Vector3(0, 1, 0);

function partGeometry(part: Part): BufferGeometry {
  let geometry: BufferGeometry;
  if ('from' in part) {
    const from = new Vector3(...part.from);
    const to = new Vector3(...part.to);
    const length = from.distanceTo(to);
    // 막대는 면 8개면 둥글어 보인다 (태블릿용으로 적게)
    geometry = new CylinderGeometry(part.radius, part.radius, length, 8, 1, false);
    const rotation = new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    geometry.applyMatrix4(new Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), rotation, new Vector3(1, 1, 1)));
  } else {
    geometry = new BoxGeometry(...part.size);
    geometry.translate(...part.at);
  }
  // 합치려면 속성이 같아야 한다: 꼭짓점 색을 넣고 uv 는 뺀다
  geometry.deleteAttribute('uv');
  const color = new Color(part.color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

function build(parts: Part[]): BufferGeometry {
  const pieces = parts.map(partGeometry);
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  return merged;
}

/* ------------------------------- 정글짐 ------------------------------- */

const GYM_RED = '#e8524a';
const GYM_YELLOW = '#f6d24a';
const GYM_BLUE = '#7fb8e6';

/** 정글짐 한 칸의 크기 (m): 가로 · 세로 · 높이 */
const GYM_CELL = 0.6;
const GYM_LEVEL = 0.75;

/** 칸 줄(xs · zs 는 기둥이 서는 선)을 y0 에서 y1 높이까지: 기둥 + 위 가로대 (+ 꼭대기 마개) */
function gymLayer(xs: number[], zs: number[], y0: number, y1: number, post: string, bar: string, caps: boolean): Part[] {
  const parts: Part[] = [];
  for (const x of xs) {
    for (const z of zs) {
      parts.push({ from: [x, y0, z], to: [x, y1 + 0.04, z], radius: 0.075, color: post });
      // 꼭대기 둥근 마개 대신 작은 상자 (면 수 절약)
      if (caps) parts.push({ at: [x, y1 + 0.06, z], size: [0.18, 0.07, 0.18], color: GYM_YELLOW });
    }
  }
  for (const z of zs) {
    for (let i = 0; i < xs.length - 1; i++) parts.push({ from: [xs[i], y1, z], to: [xs[i + 1], y1, z], radius: 0.06, color: bar });
  }
  for (const x of xs) {
    for (let i = 0; i < zs.length - 1; i++) parts.push({ from: [x, y1, zs[i]], to: [x, y1, zs[i + 1]], radius: 0.06, color: bar });
  }
  return parts;
}

/** 칸 수만큼 가운데 맞춘 선 자리 (칸 n 개면 선 n+1 개) */
function gymLines(cells: number): number[] {
  return Array.from({ length: cells + 1 }, (_, i) => (i - cells / 2) * GYM_CELL);
}

/**
 * 아래층 4×3 칸, 그 가운데 위에 2×1 칸 (사용자 요청).
 * 가로 2.4m · 세로 1.8m · 높이 1.5m (FURNITURE_3D.jungle_gym)
 */
function jungleGym(): Part[] {
  return [
    // 아래층: 빨간 기둥 · 노란 가로대. 위층이 올라가는 가운데 기둥은 위층 기둥이 이어서 세운다
    ...gymLayer(gymLines(4), gymLines(3), 0, GYM_LEVEL, GYM_RED, GYM_YELLOW, false),
    // 위층: 파란 가로대, 꼭대기 노란 마개
    ...gymLayer(gymLines(2), gymLines(1), GYM_LEVEL, GYM_LEVEL * 2, GYM_RED, GYM_BLUE, true),
  ];
}

/* -------------------------------- 그네 -------------------------------- */

const SWING_FRAME = '#7fb8e6';
const SWING_ROPE = '#8a6a4a';
const SWING_SEAT = '#f6d24a';

/** A자 기둥 둘, 위 가로대, 그네 2개. 폭 2.1m, 높이 2.2m (FURNITURE_3D.swing) */
function swing(): Part[] {
  const top = 2.15;
  const parts: Part[] = [];
  for (const x of [-1.0, 1.0]) {
    parts.push({ from: [x, 0, -0.6], to: [x, top, 0], radius: 0.085, color: SWING_FRAME });
    parts.push({ from: [x, 0, 0.6], to: [x, top, 0], radius: 0.085, color: SWING_FRAME });
    // A자 가운데 버팀대
    parts.push({ from: [x, 0.7, -0.4], to: [x, 0.7, 0.4], radius: 0.045, color: SWING_FRAME });
  }
  parts.push({ from: [-1.1, top, 0], to: [1.1, top, 0], radius: 0.08, color: SWING_FRAME });
  for (const x of [-0.48, 0.48]) {
    for (const side of [-0.2, 0.2]) {
      parts.push({ from: [x + side, top, 0], to: [x + side, 0.55, 0], radius: 0.018, color: SWING_ROPE });
    }
    parts.push({ at: [x, 0.52, 0], size: [0.52, 0.07, 0.28], color: SWING_SEAT });
  }
  return parts;
}

const BUILDERS: Record<string, () => Part[]> = {
  jungle_gym: jungleGym,
  swing,
};

/** 코드로 만드는 가구인가 */
export function isCodeFurniture(itemId: string): boolean {
  return itemId in BUILDERS;
}

const geometryCache = new Map<string, BufferGeometry>();

function geometryOf(itemId: string): BufferGeometry | null {
  const builder = BUILDERS[itemId];
  if (!builder) return null;
  let geometry = geometryCache.get(itemId);
  if (!geometry) {
    geometry = build(builder());
    geometryCache.set(itemId, geometry);
  }
  return geometry;
}

export function CodeFurniture({
  itemId,
  ghost = false,
  tint = '#ffffff',
}: {
  itemId: string;
  /** 꾸미기 미리보기: 반투명, 놓을 수 없는 자리면 붉게 */
  ghost?: boolean;
  tint?: string;
}): React.ReactElement | null {
  const geometry = useMemo(() => geometryOf(itemId), [itemId]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow={!ghost} receiveShadow={!ghost}>
      <meshStandardMaterial
        vertexColors
        color={ghost ? tint : '#ffffff'}
        transparent={ghost}
        opacity={ghost ? 0.55 : 1}
        depthWrite={!ghost}
        roughness={0.7}
      />
    </mesh>
  );
}
