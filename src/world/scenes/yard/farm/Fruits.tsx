/**
 * 나무에 달린 열매(톡 튀어나오기 · 인스턴싱)와 수확할 때 캐릭터에게 날아가는 열매.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Quaternion, Vector3, type Group, type InstancedMesh } from 'three';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import type { TreeSpeciesId } from '@/types/game';
import { GltfModel, ModelParts, type ModelPart } from '../../../rendering/assets';
import { player } from '../../../state/runtime';
import { PLOT_HEIGHT } from './farmShared';
import type { Crown } from './Tree';

const FRUIT_COLOR: Record<TreeSpeciesId, string> = {
  apple: PALETTE.apple,
  orange: PALETTE.orange,
  peach: PALETTE.peach,
  cherry: PALETTE.cherry,
  grape: '#8f6fc4',
  persimmon: '#ea8034',
};

/**
 * 열매 자리. (둘레 각도, 높이 각도) — 카메라 쪽(+z)과 옆에 둔다. 뒤에 달면 안 보인다.
 * 나무 하나에 다섯 개. 더 많으면 열매가 잎을 덮어 나무처럼 안 보인다.
 */
const FRUIT_ANGLES: [number, number][] = [
  [0.15, 0.1],
  [0.95, -0.2],
  [-0.85, 0.2],
  [-0.3, -0.45],
  [0.55, 0.55],
];

/**
 * 수관 겉면보다 안쪽에 단다 (1 이면 겉면). 수관은 잎 덩어리를 감싼 상자로 잰 타원체라
 * 겉면에 달면 잎 밖에 떠 보인다.
 */
const FRUIT_INSET = 0.78;

/** 나무마다 잎 모양이 달라 잎에 묻히는 자리가 있다. 그 자리만 겉으로 더 뺀다 (열매 번호 → inset) */
const FRUIT_INSET_BY_SPECIES: Partial<Record<TreeSpeciesId, Record<number, number>>> = {
  // 체리: 오른쪽 열매가 잎 속에 묻혔다
  cherry: { 1: 0.95 },
};

/** 나무 모델을 아직 못 불러왔을 때(임시 나무)의 수관 */
export const FALLBACK_CROWN: Crown = { center: [0, 2.2, 0], radius: [1, 0.75, 0.85] };

/** 열매 모델 크기 배율 (모델 키 약 0.22m → 0.33m). 나무에서 잘 보이게 실제보다 크게 */
const FRUIT_SCALE = 1.5;
/** 열매 모델은 원점이 밑바닥이라, 매달린 것처럼 반쯤 내린다 */
const FRUIT_HANG = 0.16;

/** 열매 인스턴스 위치 계산에 다시 쓰는 값 (매 프레임 새로 만들지 않게) */
const UP = new Vector3(0, 1, 0);
const FRUIT_ROTATION = new Quaternion();
const FRUIT_POSITION = new Vector3();
const FRUIT_SIZE = new Vector3();
const FRUIT_BASE = new Matrix4();
const FRUIT_MATRIX = new Matrix4();

/** 수확한 열매가 캐릭터에게 날아가는 시간 */
export const FLY_SECONDS = 0.7;

function fruitSpots({ center, radius }: Crown, species: TreeSpeciesId): [number, number, number][] {
  return FRUIT_ANGLES.map(([around, up], i) => {
    const inset = FRUIT_INSET_BY_SPECIES[species]?.[i] ?? FRUIT_INSET;
    return [
      center[0] + radius[0] * inset * Math.cos(up) * Math.sin(around),
      center[1] + radius[1] * inset * Math.sin(up) - FRUIT_HANG,
      center[2] + radius[2] * inset * Math.cos(up) * Math.cos(around),
    ];
  });
}

/** 살짝 넘쳤다가 돌아오는 곡선 (Back.easeOut). 0~1 → 0~1 */
function backOut(k: number): number {
  const c = 1.7;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}

function FruitModel({ species }: { species: TreeSpeciesId }): React.ReactElement {
  return (
    <GltfModel
      modelKey={MODELS.fruits[species]}
      castShadow={false}
      fallback={
        <mesh position-y={0.1}>
          <sphereGeometry args={[0.1, 14, 10]} />
          <meshStandardMaterial color={FRUIT_COLOR[species]} roughness={0.5} />
        </mesh>
      }
    />
  );
}

/** 나무에 열린 열매. 열매가 열릴 때 하나씩 톡톡 돋아난다 */
/**
 * 나무에 달린 열매. 모델을 불러왔으면 다섯 개를 한 번에 그린다(인스턴싱 — 그리기 호출 5번 → 1번).
 * 모델이 아직 없으면 하나씩 그리는 예전 방식(임시 공 포함)으로.
 */
export function Fruits({ species, crown }: { species: TreeSpeciesId; crown: Crown | null }): React.ReactElement {
  const spots = fruitSpots(crown ?? FALLBACK_CROWN, species);
  return (
    <ModelParts modelKey={MODELS.fruits[species]} fallback={<FruitGroups species={species} spots={spots} />}>
      {(parts) => <FruitInstances parts={parts} spots={spots} />}
    </ModelParts>
  );
}

/** 열매가 하나씩 차례로 톡 튀어나오는 크기 (0 → FRUIT_SCALE) */
function popScale(age: number, i: number): number {
  const k = Math.min(1, Math.max(0, (age - i * 0.09) / 0.3));
  return FRUIT_SCALE * backOut(k) + 1e-4;
}

/** 다 튀어나온 뒤에는 열매 위치를 다시 계산하지 않는다 */
const FRUIT_POP_DONE = 0.09 * 5 + 0.4;

function FruitInstances({ parts, spots }: { parts: ModelPart[]; spots: [number, number, number][] }): React.ReactElement {
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const started = useRef(performance.now());
  const done = useRef(false);

  useFrame(() => {
    if (done.current) return;
    const age = (performance.now() - started.current) / 1000;
    spots.forEach((spot, i) => {
      FRUIT_ROTATION.setFromAxisAngle(UP, i * 1.3);
      FRUIT_BASE.compose(FRUIT_POSITION.set(spot[0], spot[1], spot[2]), FRUIT_ROTATION, FRUIT_SIZE.setScalar(popScale(age, i)));
      parts.forEach((part, p) => {
        meshes.current[p]?.setMatrixAt(i, FRUIT_MATRIX.multiplyMatrices(FRUIT_BASE, part.matrix));
      });
    });
    for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    if (age > FRUIT_POP_DONE) done.current = true;
  });

  return (
    <group>
      {parts.map((part, p) => (
        <instancedMesh
          key={p}
          ref={(mesh) => void (meshes.current[p] = mesh)}
          args={[part.geometry, part.material, spots.length]}
          receiveShadow
          // 인스턴스가 원점에서 떨어져 있어 모양 하나 기준의 가림 판정이 틀린다. 다섯 개뿐이라 늘 그린다
          frustumCulled={false}
          // 모양 · 재질은 불러온 모델 것을 같이 쓴다. 이 열매가 사라질 때 정리하면 다른 나무 열매까지 다시 올려야 한다
          dispose={null}
        />
      ))}
    </group>
  );
}

/** 모델이 아직 없을 때: 열매를 하나씩 그린다 (임시 공) */
function FruitGroups({ species, spots }: { species: TreeSpeciesId; spots: [number, number, number][] }): React.ReactElement {
  const groups = useRef<(Group | null)[]>([]);
  const started = useRef(performance.now());

  useFrame(() => {
    const age = (performance.now() - started.current) / 1000;
    groups.current.forEach((group, i) => {
      if (group) group.scale.setScalar(popScale(age, i));
    });
  });

  return (
    <group>
      {spots.map((spot, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} position={spot} rotation-y={i * 1.3} scale={1e-4}>
          <FruitModel species={species} />
        </group>
      ))}
    </group>
  );
}

/**
 * 수확한 열매가 캐릭터에게 날아가 쏙 들어간다.
 * 밭 그룹 안에 그린다 — 좌표는 밭 기준이라, 캐릭터 위치에서 밭 위치를 빼서 목적지로 쓴다.
 */
export function FlyingFruits({
  species,
  crown,
  plot,
  startedAt,
}: {
  species: TreeSpeciesId;
  crown: Crown;
  plot: { x: number; z: number };
  startedAt: number;
}): React.ReactElement {
  const spots = fruitSpots(crown, species);
  const groups = useRef<(Group | null)[]>([]);

  useFrame(() => {
    const age = (performance.now() - startedAt) / 1000;
    // 캐릭터 가슴 높이로
    const tx = player.position.x - plot.x;
    const ty = 0.9;
    const tz = player.position.z - plot.z;
    groups.current.forEach((group, i) => {
      if (!group) return;
      const k = Math.min(1, Math.max(0, (age - i * 0.06) / FLY_SECONDS));
      const e = k * k * (3 - 2 * k);
      const [sx, sy, sz] = spots[i];
      group.position.set(
        sx + (tx - sx) * e,
        PLOT_HEIGHT + sy + (ty - sy - PLOT_HEIGHT) * e + Math.sin(Math.PI * e) * 0.9,
        sz + (tz - sz) * e,
      );
      group.scale.setScalar(FRUIT_SCALE * (1 - 0.75 * e));
      group.visible = k < 1;
    });
  });

  return (
    <group>
      {spots.map((spot, i) => (
        <group
          key={i}
          ref={(g) => void (groups.current[i] = g)}
          position={[spot[0], PLOT_HEIGHT + spot[1], spot[2]]}
          scale={FRUIT_SCALE}
        >
          <FruitModel species={species} />
        </group>
      ))}
    </group>
  );
}
