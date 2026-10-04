/**
 * 밭 한 칸: 씨앗 심기 → 물 주기(5단계 성장) → 수확.
 * 규칙은 2D 판 YardScene 과 같다. 행동마다 곱셈 문제를 하나 푼다. (명세 78)
 *
 * 나무 모양은 3단계에서 생성 모델로 바뀐다. 지금은 코드로 만든 단계별 모양에
 * 열매만 생성 모델(사과·오렌지 …)을 단다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Matrix4, Quaternion, Vector3, type Group, type InstancedMesh, type Mesh, type Object3D } from 'three';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { MAX_HARVESTS_PER_TREE, STAGE_LABEL } from '@/config/balance';
import { TREE_SPECIES, seedIdOf } from '@/config/catalog';
import { PLOT_COUNT, YARD, plotPosition } from '@/config/layout';
import { MODELS } from '@/config/models';
import { gameEvents } from '@/bridge/eventBus';
import type { InteractionPrompt } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { FarmPlot as FarmPlotData, TreeSpeciesId, TreeStage } from '@/types/game';
import { audio } from '@/audio/sfx';
import { ArtTexture, GltfModel, ModelParts, type ModelPart } from '../../../rendering/assets';
import { burstStars, floatText } from '../../../effects/effects';
import { spawnParticles } from '../../../effects/particles';
import { StaticShadow } from '../../../rendering/bakedShadows';
import { mergedBoxGeometry, type BoxSpec } from '../../../props/mergedBoxes';
import { askMath, awardExperience, toast } from '../../../gameplay/gameplay';
import { useInteractable } from '../../../systems/interaction';
import { obstacles, player, raisedAreas } from '../../../state/runtime';

const PLOT_HEIGHT = 0.14;
/** 나무가 서 있으면 걸어서 지나갈 수 없는 반지름 */
const TREE_RADIUS = 0.45;

/** 물방울이 떨어지기 시작하는 높이 (물 주기 전 단계의 나무 크기) */
const WATER_HEIGHT: Record<TreeStage, number> = { seed: 0.9, sprout: 1.1, sapling: 2.0, mature: 3.1, fruiting: 3.1 };

const FRUIT_COLOR: Record<TreeSpeciesId, string> = {
  apple: PALETTE.apple,
  orange: PALETTE.orange,
  peach: PALETTE.peach,
  cherry: PALETTE.cherry,
  grape: '#8f6fc4',
  persimmon: '#ea8034',
};

/* ------------------------------- 행동 규칙 ------------------------------- */

function plotById(plotId: string): FarmPlotData | undefined {
  return useGameStore.getState().plots.find((p) => p.id === plotId);
}

function ownedSeeds(): TreeSpeciesId[] {
  const inventory = useGameStore.getState().inventory;
  return (Object.keys(TREE_SPECIES) as TreeSpeciesId[]).filter(
    (species) => (inventory[seedIdOf(species)] ?? 0) > 0,
  );
}

function plotPrompts(plotId: string): InteractionPrompt[] {
  const plot = plotById(plotId);
  if (!plot) return [];

  if (!plot.species) {
    const seeds = ownedSeeds();
    return [
      {
        id: 'plant',
        label: '씨앗 심기',
        enabled: seeds.length > 0,
        hint: seeds.length === 0 ? '농장 가게에서 씨앗을 사 오세요' : undefined,
      },
    ];
  }

  if (plot.stage === 'fruiting') {
    const left = MAX_HARVESTS_PER_TREE - plot.harvestCount;
    return [
      {
        id: 'harvest',
        // 밭이 여섯 개라 어떤 나무 앞인지 버튼에서 바로 보여 준다
        label: `${TREE_SPECIES[plot.species].name} 수확하기`,
        enabled: true,
        highlight: true,
        // 나무가 곧 사라진다는 걸 미리 알려 준다. (요청 3)
        hint: left <= 1 ? '이번이 마지막 수확이에요' : `앞으로 ${left}번 딸 수 있어요`,
      },
    ];
  }

  const water = useGameStore.getState().itemCount('water');
  return [
    {
      id: 'grow',
      label: `${TREE_SPECIES[plot.species].name} 물 주기`,
      enabled: water > 0,
      hint: water > 0 ? `${STAGE_LABEL[plot.stage]} · 물 ${water}개` : '물이 없어요. 농장 가게에서 사 오세요',
    },
  ];
}

/** 연출 위치 (밭 가운데 위) */
function above(plotIndex: number, height: number): { x: number; y: number; z: number } {
  const { x, z } = plotPosition(plotIndex);
  return { x, y: height, z };
}

export function plantWithMath(plotId: string, species: TreeSpeciesId): void {
  const plot = plotById(plotId);
  if (!plot || plot.species) return;
  const def = TREE_SPECIES[species];
  askMath('PLANT', `${def.seedName}을 심어 볼까요?`, (math) => {
    if (!useGameStore.getState().plantSeed(plotId, species)) return;
    burstStars(above(plot.index, 0.4), 6);
    audio.play('place');
    floatText(above(plot.index, 1.2), `${def.name} 심기`, PALETTE.leafShade);
    awardExperience('PLANT', math);
  });
}

function handlePlotAction(plotId: string, actionId: string): void {
  const plot = plotById(plotId);
  if (!plot) return;

  if (actionId === 'plant') {
    const seeds = ownedSeeds();
    if (seeds.length === 0) return;
    if (seeds.length === 1) {
      plantWithMath(plotId, seeds[0]);
      return;
    }
    gameEvents.emit('seedpicker:open', { plotId });
    return;
  }

  const species = plot.species;
  if (!species) return;
  const def = TREE_SPECIES[species];

  if (actionId === 'grow') {
    askMath('GROW', `${def.name}를 키워 볼까요?`, (math) => {
      const before = plotById(plotId)?.stage;
      // 물이 없으면 아무 일도 일어나지 않는다.
      if (!useGameStore.getState().growPlot(plotId)) {
        toast('물이 없어요. 농장 가게에서 사 오세요', 'warn');
        return;
      }
      const after = plotById(plotId)?.stage;
      // 물뿌리개로 준 물이 나무 위에서 떨어진다 (나무 크기에 맞춰)
      spawnParticles('water', above(plot.index, WATER_HEIGHT[before ?? 'seed']), 14);
      if (before !== after) {
        floatText(above(plot.index, 2.2), STAGE_LABEL[after ?? 'sprout'], PALETTE.leafShade);
        audio.play('harvest');
        // 열매가 맺히면 별만 터뜨린다 (안내 문구는 사용자 요청으로 뺐다)
        if (after === 'fruiting') burstStars(above(plot.index, 2.4), 12);
      } else {
        floatText(above(plot.index, 1.8), '쑥쑥!', PALETTE.leafShade);
      }
      awardExperience('GROW', math);
    });
    return;
  }

  if (actionId === 'harvest') {
    askMath('HARVEST', `${def.fruitName}를 따 볼까요?`, (math) => {
      const result = useGameStore.getState().harvestPlot(plotId, math.wrongAttempts);
      if (!result) return;
      // 다 틀려도 최소 1개는 딴다 (HARVEST_BY_ATTEMPTS) — 빈손으로 끝나는 경우는 없다.
      audio.play('harvest');
      burstStars(above(plot.index, 2.4), 6 + result.count * 3);
      floatText(above(plot.index, 3), `${def.fruitName} +${result.count}`, PALETTE.goldShade);
      if (result.finished) {
        // 다 딴 나무는 밭에서 사라진다. (요청 3)
        toast(`${def.name}가 열매를 다 맺었어요. 밭이 비었으니 새로 심어 보세요`, 'info');
      } else {
        toast(`${def.fruitName} ${result.count}개를 얻었어요`, 'reward');
      }
      awardExperience('HARVEST', math);
    });
  }
}

/* --------------------------------- 그리기 --------------------------------- */

/**
 * 밭 여섯 칸의 흙과 나무 테두리. 칸마다 그리면 12번이라, 흙끼리 · 테두리끼리 모양 하나로 합쳐 2번에 그린다.
 * 움직이지 않아 그림자를 미리 그려 두고(rendering/bakedShadows), 나무 그림자는 흙 위에 지도록 그림자를 받는다.
 */
export function PlotBeds(): React.ReactElement {
  const { soil, border } = useMemo(() => {
    const size = YARD.farm.plotSize;
    const y = PLOT_HEIGHT / 2 + 0.04;
    const h = PLOT_HEIGHT + 0.08;
    const soilBoxes: BoxSpec[] = [];
    const borderBoxes: BoxSpec[] = [];
    for (let i = 0; i < PLOT_COUNT; i += 1) {
      const { x, z } = plotPosition(i);
      soilBoxes.push({ x, y: PLOT_HEIGHT / 2, z, w: size, h: PLOT_HEIGHT, d: size });
      borderBoxes.push(
        { x, y, z: z + size / 2, w: size + 0.16, h, d: 0.16 },
        { x, y, z: z - size / 2, w: size + 0.16, h, d: 0.16 },
        { x: x + size / 2, y, z, w: 0.16, h, d: size },
        { x: x - size / 2, y, z, w: 0.16, h, d: size },
      );
    }
    return { soil: mergedBoxGeometry(soilBoxes), border: mergedBoxGeometry(borderBoxes) };
  }, []);
  useEffect(
    () => () => {
      soil.dispose();
      border.dispose();
    },
    [soil, border],
  );

  return (
    <StaticShadow receive>
      <mesh geometry={soil} receiveShadow castShadow>
        <ArtTexture assetKey={ASSETS.textures.soil} repeat={[1, 1]}>
          {(map) => <meshStandardMaterial map={map} color={map ? '#ffffff' : PALETTE.soil} roughness={1} />}
        </ArtTexture>
      </mesh>
      <mesh geometry={border} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
    </StaticShadow>
  );
}

export function FarmPlot({ index }: { index: number }): React.ReactElement {
  const plotId = `plot_${index}`;
  const plot = useGameStore((s) => s.plots.find((p) => p.id === plotId));
  const { x, z } = plotPosition(index);
  const size = YARD.farm.plotSize;

  useInteractable({
    id: plotId,
    position: () => ({ x, z }),
    range: size / 2 + 0.9,
    prompts: () => plotPrompts(plotId),
    onAction: (actionId) => handlePlotAction(plotId, actionId),
  });

  // 수확하면 나무에서 열매가 사라지는 대신 캐릭터에게 날아간다.
  // 마지막 수확이면 나무도 사라지므로, 날아가는 열매는 나무가 아니라 밭이 그린다.
  const crown = useRef<Crown | null>(null);
  const onCrown = useCallback((measured: Crown | null) => {
    if (measured) crown.current = measured;
  }, []);
  const [flying, setFlying] = useState<{ species: TreeSpeciesId; startedAt: number } | null>(null);
  const previous = useRef(plot);
  useEffect(() => {
    const before = previous.current;
    previous.current = plot;
    const wasFruiting = !!before?.species && before.stage === 'fruiting';
    const stillFruiting = plot?.species === before?.species && plot?.stage === 'fruiting';
    if (!wasFruiting || stillFruiting || !before?.species) return;
    const startedAt = performance.now();
    setFlying({ species: before.species, startedAt });
    window.setTimeout(() => setFlying((f) => (f?.startedAt === startedAt ? null : f)), FLY_SECONDS * 1000 + 600);
  }, [plot]);

  // 흙 위에 올라선다 (나무 테두리까지)
  useEffect(() => {
    const key = `plot_${plotId}`;
    const half = size / 2 + 0.08;
    raisedAreas.set(key, { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half, height: PLOT_HEIGHT });
    return () => {
      raisedAreas.delete(key);
    };
  }, [plotId, size, x, z]);

  // 묘목부터는 나무에 부딪힌다
  const blocking = !!plot?.species && (plot.stage === 'sapling' || plot.stage === 'mature' || plot.stage === 'fruiting');
  useEffect(() => {
    if (!blocking) return;
    const key = `tree_${plotId}`;
    obstacles.set(key, { kind: 'circle', x, z, radius: TREE_RADIUS });
    return () => {
      obstacles.delete(key);
    };
  }, [blocking, plotId, x, z]);

  return (
    <>
      <group position={[x, 0, z]}>
        {/* 흙과 나무 테두리는 밭 여섯 칸을 한 번에 그린다 (PlotBeds) */}
        {plot?.species && <Tree species={plot.species} stage={plot.stage} onCrown={onCrown} />}
        {flying && (
          <FlyingFruits
            key={flying.startedAt}
            species={flying.species}
            crown={crown.current ?? FALLBACK_CROWN}
            plot={{ x, z }}
            startedAt={flying.startedAt}
          />
        )}
      </group>
    </>
  );
}

/** 어린나무는 다 자란 나무 모델을 이만큼 줄여 쓴다 */
const SAPLING_SCALE = 0.55;

/** 나무 잎 덩어리(수관)의 대략적인 타원체. 열매를 그 겉면에 단다 */
interface Crown {
  center: [number, number, number];
  radius: [number, number, number];
}

/** 불러온 나무 모델의 크기를 재서 수관 타원체를 정한다 (나무 그룹 기준 좌표) */
function measureCrown(object: Object3D): Crown {
  object.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(object.parent?.matrixWorld ?? new Matrix4()).invert();
  const box = new Box3();
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const part = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toLocal);
    box.union(part);
  });
  const height = box.max.y - box.min.y;
  // 아래 40% 는 줄기. 그 위가 잎 덩어리
  const bottom = box.min.y + height * 0.4;
  return {
    center: [(box.min.x + box.max.x) / 2, (bottom + box.max.y) / 2, (box.min.z + box.max.z) / 2],
    radius: [((box.max.x - box.min.x) / 2) * 0.92, (box.max.y - bottom) / 2, ((box.max.z - box.min.z) / 2) * 0.92],
  };
}

/**
 * 단계별 나무. 단계가 바뀌어도 나무 자체는 그대로 둔다 (사라졌다 나타나 보이지 않게).
 * 움직임은 바람에 살랑이는 것과 열매가 돋아나는 것뿐이다.
 */
function Tree({
  species,
  stage,
  onCrown,
}: {
  species: TreeSpeciesId;
  stage: TreeStage;
  onCrown: (crown: Crown | null) => void;
}): React.ReactElement {
  const group = useRef<Group>(null);
  const [crown, setCrown] = useState<Crown | null>(null);
  const onTreeLoaded = useCallback(
    (object: Object3D | null) => {
      const measured = object ? measureCrown(object) : null;
      setCrown(measured);
      onCrown(measured);
    },
    [onCrown],
  );

  useFrame(() => {
    if (!group.current) return;
    // 잎이 바람에 살랑. 흔들림 각도는 아주 작게 (ART_DIRECTION 8)
    group.current.rotation.z = Math.sin((performance.now() / 1000 / 2.6) * Math.PI) * 0.015;
  });

  return (
    <group ref={group} position-y={PLOT_HEIGHT}>
      {stage === 'seed' && (
        <mesh position-y={0.05} castShadow>
          <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={PALETTE.soilShade} roughness={1} />
        </mesh>
      )}
      {stage === 'sprout' && <GltfModel modelKey={MODELS.sprout} fallback={<Sprout />} />}
      {stage === 'sapling' && (
        <group scale={SAPLING_SCALE}>
          <GltfModel modelKey={MODELS.trees[species]} fallback={<Trunk height={1.4} radius={0.13} crown={0.95} />} />
        </group>
      )}
      {(stage === 'mature' || stage === 'fruiting') && (
        <GltfModel
          modelKey={MODELS.trees[species]}
          fallback={<Trunk height={1.4} radius={0.13} crown={0.95} />}
          onLoaded={onTreeLoaded}
        />
      )}
      {stage === 'fruiting' && <Fruits species={species} crown={crown} />}
    </group>
  );
}

function Sprout(): React.ReactElement {
  return (
    <group>
      <mesh position-y={0.18} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.36, 8]} />
        <meshStandardMaterial color={PALETTE.leafShade} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.11, 0.36, 0]} rotation-z={side * -0.6} scale={[1, 0.45, 0.7]} castShadow>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color={PALETTE.leafLight} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Trunk({ height, radius, crown }: { height: number; radius: number; crown: number }): React.ReactElement {
  return (
    <group>
      <mesh position-y={height / 2} castShadow>
        <cylinderGeometry args={[radius * 0.8, radius, height, 10]} />
        <meshStandardMaterial color={PALETTE.trunk} roughness={0.9} />
      </mesh>
      {/* 수관: 덩어리 세 개를 겹쳐 둥실한 모양으로 */}
      {[
        [0, height + crown * 0.55, 0, crown],
        [-crown * 0.55, height + crown * 0.3, crown * 0.15, crown * 0.7],
        [crown * 0.55, height + crown * 0.35, -crown * 0.1, crown * 0.72],
      ].map(([cx, cy, cz, r], i) => (
        <mesh key={i} position={[cx, cy, cz]} castShadow receiveShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i === 0 ? PALETTE.leaf : PALETTE.leafLight} flatShading roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

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
const FALLBACK_CROWN: Crown = { center: [0, 2.2, 0], radius: [1, 0.75, 0.85] };

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
const FLY_SECONDS = 0.7;

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
function Fruits({ species, crown }: { species: TreeSpeciesId; crown: Crown | null }): React.ReactElement {
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
function FlyingFruits({
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
