/**
 * 걸어 다니는 범위 밖을 둘러싼 숲 벽. 숲속 빈터에 들어와 있는 것처럼, 경계 너머 땅이 보이지 않게 한다.
 *
 * 카메라는 캐릭터 뒤 8m · 높이 5.9m 에서 내려다본다. 화면 맨 위 시선이 경계 바로 너머에서 높이 4m 쯤을 지나므로,
 * 경계 뒤에 그보다 높은 나무를 세 줄(앞줄 낮게 → 뒷줄 높게) 세워 시선을 막는다.
 *  - 앞줄: 진짜 3D 숲 나무 · 침엽수 모델. 놓을 때마다 방향 · 크기가 달라 같은 나무가 반복돼 보이지 않는다
 *  - 뒷줄 둘: 줄기 + 둥근 잎 뭉치로 만든 가벼운 나무 (짙은 색이라 깊은 숲처럼 보인다)
 *  - 바닥: 같은 잔디 무늬를 바깥으로 갈수록 어둡게 (나무 그늘)
 * 카메라 쪽(남쪽)은 비워 둔다 — 화면을 가린다. 장면 사이를 잇는 길이 나가는 자리(openings)는 숲을 튼다.
 *
 * 그리기를 줄이려고: 같은 모양은 한 번에 그리고(인스턴싱), 서 · 북 · 동 쪽마다 나눠 화면 밖 쪽은 아예 안 그린다.
 * 그림자는 미리 그린다 (부르는 쪽이 StaticShadow 안에 둔다). 위치는 고정된 씨앗이라 매번 같은 숲이다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import { ArtTexture, ModelParts, type ModelPart } from '../rendering/assets';
import { applyGroundShadow } from '../rendering/groundShadow';
import { GRASS_TILE, grassOrigin } from './Ground';

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type Side = 'west' | 'north' | 'east';
const SIDES: Side[] = ['west', 'north', 'east'];

export interface ForestOpening {
  side: 'west' | 'east';
  z: number;
  /** 트는 폭 (m) */
  width: number;
}

/** 모양 하나: 자리 · 크기(축마다) · 돌림 · 색 */
interface Blob {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  turn: number;
  color: string;
}

type ModelKind = 'tree' | 'pine' | 'bush';

/** 진짜 모델 한 그루: 자리 · 돌림 · 크기 */
interface Placement {
  x: number;
  z: number;
  turn: number;
  scale: number;
}

interface SideForest {
  leaves: Blob[];
  trunks: Blob[];
  models: Record<ModelKind, Placement[]>;
}

/** 뒷줄 잎 색. 뒤로 갈수록 짙게 (깊은 숲) */
const LEAF_COLORS = [
  ['#4a9049', '#458a45', '#3f8242', '#4f944b'],
  ['#3a7640', '#356f3c', '#3f7a42', '#326a39'],
];
const TRUNK_COLORS = ['#8a5e3c', '#7a5236', '#94663f'];

export function ForestWall({ bounds, openings = [] }: { bounds: Bounds; openings?: ForestOpening[] }): React.ReactElement {
  const key = JSON.stringify([bounds, openings]);
  const forest = useMemo(() => buildForest(bounds, openings), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      <ForestFloor bounds={bounds} />
      {SIDES.map((side) => (
        <SideGroup key={side} forest={forest[side]} />
      ))}
    </group>
  );
}

/**
 * 숲 바닥: 경계 밖 땅을 같은 잔디 무늬로 깔되 바깥으로 갈수록 어둡게 한다 (나무 그늘).
 * 무늬는 잔디 땅판과 같은 자리에서 시작해 이어지고, 경계 가까이는 땅판과 같은 밝기라 이음매가 보이지 않는다.
 * 미리 그린 그림자도 받는다 (나무 그림자가 숲 바닥에도 진다).
 */
/** 이 거리(경계 밖, m)까지는 땅판과 같은 밝기, 그 밖으로 FLOOR_DARK_AT 까지 어두워진다 */
const FLOOR_FADE_FROM = 0.4;
const FLOOR_DARK_AT = 3.2;
/** 경계 밖으로 까는 폭 (m) */
const FLOOR_DEPTH = 16;
/** 가장 어두운 곳의 밝기 (잔디 무늬에 곱한다). 살짝 어둡게 */
const FLOOR_SHADE = new Color(0.62, 0.68, 0.6);
const FLOOR_STEP = 0.5;

function ForestFloor({ bounds }: { bounds: Bounds }): React.ReactElement {
  const geometry = useMemo(() => forestFloorGeometry(bounds), [bounds]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    // 땅판 위에 살짝 띄워 깐다. 길(0.012)보다는 낮아 길 틈의 길이 위로 보인다
    <mesh geometry={geometry} position-y={0.006}>
      <ArtTexture assetKey={ASSETS.textures.grass} repeat={[1, 1]}>
        {(map) => (
          <meshLambertMaterial
            ref={(material) => void (material && applyGroundShadow(material))}
            map={map}
            color={map ? '#ffffff' : PALETTE.grass}
            vertexColors
            polygonOffset
            polygonOffsetFactor={-1}
          />
        )}
      </ArtTexture>
    </mesh>
  );
}

/** 숲 바닥 모양: 경계 밖 띠(서 · 북 · 동). 꼭짓점 색으로 바깥쪽을 어둡게, 질감 좌표는 땅판과 같은 m 단위 */
function forestFloorGeometry(bounds: Bounds): BufferGeometry {
  const { minX, maxX, minZ, maxZ } = bounds;
  const origin = grassOrigin(bounds);
  const southEnd = maxZ + 2;
  const x0 = minX - FLOOR_DEPTH;
  const z0 = minZ - FLOOR_DEPTH;
  const cols = Math.ceil((maxX + FLOOR_DEPTH - x0) / FLOOR_STEP);
  const rows = Math.ceil((southEnd - z0) / FLOOR_STEP);
  const outside = (x: number, z: number) => Math.max(minX - x, x - maxX, minZ - z);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const tint = new Color();
  const white = new Color(1, 1, 1);
  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const x = x0 + i * FLOOR_STEP;
      const z = Math.min(z0 + j * FLOOR_STEP, southEnd);
      positions.push(x, 0, z);
      uvs.push((x - origin.x) / GRASS_TILE, (origin.z - z) / GRASS_TILE);
      // 바깥으로 갈수록 어둡게. 남쪽 끝(카메라 쪽)에서는 다시 땅판 밝기로 돌아와 끝선이 보이지 않게
      const dark = smoothstep(FLOOR_FADE_FROM, FLOOR_DARK_AT, outside(x, z)) * smoothstep(southEnd, maxZ - 2, z);
      tint.copy(white).lerp(FLOOR_SHADE, dark);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      // 걸어 다니는 범위 안쪽 칸은 건너뛴다 (땅판이 그대로 보인다)
      const cx = x0 + (i + 0.5) * FLOOR_STEP;
      const cz = z0 + (j + 0.5) * FLOOR_STEP;
      if (outside(cx, cz) < FLOOR_FADE_FROM - FLOOR_STEP) continue;
      const a = j * (cols + 1) + i;
      const c = a + cols + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(new Array(positions.length / 3).fill([0, 1, 0]).flat(), 3));
  geometry.setIndex(index);
  return geometry;
}

function smoothstep(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function SideGroup({ forest }: { forest: SideForest }): React.ReactElement {
  return (
    <group>
      <BlobInstances list={forest.leaves} kind="leaf" />
      <BlobInstances list={forest.trunks} kind="trunk" />
      {(['tree', 'pine', 'bush'] as ModelKind[]).map((kind) =>
        forest.models[kind].length ? (
          <ModelParts key={kind} modelKey={MODELS.scenery[kind]} fallback={null}>
            {(parts) => <ModelInstances parts={parts} list={forest.models[kind]} />}
          </ModelParts>
        ) : null,
      )}
    </group>
  );
}

/* --------------------------------- 그리기 --------------------------------- */

const matrix = new Matrix4();
const rotation = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scale = new Vector3();
const color = new Color();

function BlobInstances({ list, kind }: { list: Blob[]; kind: 'leaf' | 'trunk' }): React.ReactElement | null {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    list.forEach((item, i) => {
      rotation.setFromEuler(euler.set(0, item.turn, 0));
      target.setMatrixAt(i, matrix.compose(position.set(item.x, item.y, item.z), rotation, scale.set(item.sx, item.sy, item.sz)));
      target.setColorAt(i, color.set(item.color));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [list]);
  if (!list.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, list.length]} castShadow>
      {kind === 'leaf' ? <sphereGeometry args={[1, 9, 7]} /> : <cylinderGeometry args={[0.75, 1, 1, 6]} />}
      <meshStandardMaterial roughness={0.92} />
    </instancedMesh>
  );
}

/** 진짜 모델을 여러 그루 한 번에 (모델 안의 모양마다 인스턴싱 1번) */
function ModelInstances({ parts, list }: { parts: ModelPart[]; list: Placement[] }): React.ReactElement {
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    const base = new Matrix4();
    list.forEach((item, i) => {
      rotation.setFromEuler(euler.set(0, item.turn, 0));
      base.compose(position.set(item.x, 0, item.z), rotation, scale.setScalar(item.scale));
      parts.forEach((part, p) => meshes.current[p]?.setMatrixAt(i, matrix.multiplyMatrices(base, part.matrix)));
    });
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [parts, list]);
  return (
    <group>
      {parts.map((part, p) => (
        <instancedMesh
          key={p}
          ref={(mesh) => void (meshes.current[p] = mesh)}
          args={[part.geometry, part.material, list.length]}
          castShadow
          // 모양 · 재질은 불러온 모델 것을 같이 쓴다. 장면을 떠날 때 정리하면 다른 장면이 다시 올려야 한다
          dispose={null}
        />
      ))}
    </group>
  );
}

/* --------------------------------- 숲 만들기 --------------------------------- */

function buildForest(bounds: Bounds, openings: ForestOpening[]): Record<Side, SideForest> {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length)];
  const forest = Object.fromEntries(
    SIDES.map((side) => [side, { leaves: [], trunks: [], models: { tree: [], pine: [], bush: [] } } as SideForest]),
  ) as Record<Side, SideForest>;

  /** 길이 나가는 자리인지. margin 은 나무 크기만큼 더 비운다 */
  const inOpening = (side: Side, z: number, margin: number) =>
    openings.some((o) => o.side === side && Math.abs(z - o.z) < o.width / 2 + margin);

  /** 둘레를 따라 step 간격의 점 (바깥 방향 포함). 남쪽 끝은 조금 남기고 멈춘다 */
  const perimeter = (out: number, step: number, margin: number) => {
    const points: { side: Side; x: number; z: number; nx: number; nz: number }[] = [];
    const west = bounds.minX - out;
    const east = bounds.maxX + out;
    const north = bounds.minZ - out;
    const southEnd = bounds.maxZ + 2;
    for (let z = southEnd; z > north; z -= step) if (!inOpening('west', z, margin)) points.push({ side: 'west', x: west, z, nx: -1, nz: 0 });
    for (let x = west; x < east; x += step) points.push({ side: 'north', x, z: north, nx: 0, nz: -1 });
    for (let z = north; z < southEnd; z += step) if (!inOpening('east', z, margin)) points.push({ side: 'east', x: east, z, nx: 1, nz: 0 });
    return points;
  };
  const jitter = (p: { x: number; z: number; nx: number; nz: number }, along: number, across: number) => {
    const slide = (random() - 0.5) * along;
    const depth = (random() - 0.4) * across;
    return { x: p.x + p.nx * depth + p.nz * slide, z: p.z + p.nz * depth + p.nx * slide };
  };

  // 앞줄 나무 (진짜 모델). 숲 나무가 대부분, 침엽수가 섞인다. 모델이 무거워 간격을 넉넉히
  for (const p of perimeter(2.6, 3.4, 1.8)) {
    const { x, z } = jitter(p, 1.2, 1.0);
    const kind: ModelKind = random() < 0.3 ? 'pine' : 'tree';
    forest[p.side].models[kind].push({ x, z, turn: random() * Math.PI * 2, scale: 0.9 + random() * 0.3 });
  }

  // 뒷줄 둘: 줄기 + 잎 뭉치. [경계에서 거리, 간격, 키 범위]
  const rows: [number, number, [number, number]][] = [
    [5, 2.8, [5.4, 6.6]],
    [7.6, 3.2, [6.8, 8.2]],
  ];
  rows.forEach(([out, step, [hMin, hMax]], row) => {
    for (const p of perimeter(out, step, hMax * 0.3)) {
      const { x, z } = jitter(p, step * 0.5, 1.2);
      const height = hMin + random() * (hMax - hMin);
      const crown = height * (0.26 + random() * 0.05);
      const crownY = height - crown * 1.05;
      const side = forest[p.side];
      side.trunks.push({
        x, y: crownY / 2, z,
        sx: 0.16 + height * 0.02, sy: crownY, sz: 0.16 + height * 0.02,
        turn: random() * Math.PI,
        color: pick(TRUNK_COLORS),
      });
      const clumps = 3 + Math.floor(random() * 2);
      for (let c = 0; c < clumps; c += 1) {
        const angle = random() * Math.PI * 2;
        const spread = c === 0 ? 0 : crown * (0.55 + random() * 0.3);
        const r = crown * (c === 0 ? 1 : 0.7 + random() * 0.25);
        side.leaves.push({
          x: x + Math.cos(angle) * spread,
          y: crownY + (c === 0 ? crown * 0.25 : (random() - 0.4) * crown * 0.6),
          z: z + Math.sin(angle) * spread,
          sx: r * (0.95 + random() * 0.15),
          sy: r * (0.82 + random() * 0.15),
          sz: r * (0.95 + random() * 0.15),
          turn: random() * Math.PI * 2,
          color: pick(LEAF_COLORS[row]),
        });
      }
    }
  });
  return forest;
}
