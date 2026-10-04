/**
 * 시장. 마당 오른쪽 끝 표지판으로 들어온다. (2D 판 TownScene)
 *
 * 농장 가게 · 가구 가게 두 곳이 길 뒤쪽에 서 있고, 가운데 분수 광장이 있다.
 * 가게에 들어가는 것 자체는 자유이고, 실제로 사고팔 때 문제를 낸다 (명세 78 — React 가게 화면이 맡는다).
 * 꾸미기는 집 · 마당에서만 한다.
 */
import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { PALETTE } from '@/config/artTokens';
import { TOWN, YARD, type Vec2 } from '@/config/layout';
import { MODELS, furnitureModelKey } from '@/config/models';
import { AREA_NAME } from '@/config/strings';
import { gameEvents } from '@/bridge/eventBus';
import { FURNITURE_3D } from '@/config/furniture3d';
import { GltfModel } from '../assets3d';
import { BakedShadows, StaticShadow } from '../core/bakedShadows';
import { NightGlow } from '../core/dayNight';
import { useInteractable } from '../core/interaction';
import { placePlayer } from '../core/movement';
import { input, obstacles, walkBounds, type Obstacle } from '../core/runtime';
import { goToScene, useWorldScene, type Spawn } from '../core/scenes';
import { GrassGround, PathStrip, Surroundings } from '../props/Ground';
import { SignBoard } from '../props/SignBoard';

/** 장식: 마당 꾸미기에 쓰는 것과 같은 모델. 광장 분수는 마당 것보다 크게 */
const DECOR: { id: string; x: number; z: number; rotation?: number; scale?: number; radius: number }[] = [
  { id: 'fountain', x: 0, z: -3.4, scale: 1.5, radius: 1.6 },
  { id: 'streetlamp', x: -9, z: -0.2, radius: 0.3 },
  { id: 'streetlamp', x: 8.6, z: -0.2, radius: 0.3 },
  { id: 'bench_wood', x: -9.4, z: -2.9, radius: 0.7 },
  { id: 'bench_wood', x: 9.2, z: -2.9, radius: 0.7 },
  // 꽃밭은 위로 걸어 다닌다 (부딪히지 않는다)
  { id: 'flower_bed', x: -6, z: 3.9, radius: 0 },
  { id: 'flower_bed', x: 0, z: 4.1, radius: 0 },
  { id: 'flower_bed', x: 6, z: 3.9, radius: 0 },
];

/** 밤에 켜지는 가게 불빛 (건물 중심 기준 [x, 높이, z, 크기]). 모델을 보고 맞춘 자리 */
const SHOP_LIGHTS: Record<'seed' | 'furniture', [number, number, number, number][]> = {
  // 차양 아래 계산대 안쪽
  seed: [[0, 1.35, 1.5, 2.2]],
  // 양쪽 진열창, 벽 등불 두 개
  furniture: [
    [-1.35, 1.35, 1.5, 1.3],
    [1.35, 1.35, 1.5, 1.3],
    [-2.15, 2.05, 1.35, 0.9],
    [2.15, 2.05, 1.35, 0.9],
  ],
};

/** 미리 그리는 그림자를 까는 범위 (그림자는 +x · -z 쪽으로 진다) */
const TOWN_SHADOW_BOUNDS = {
  minX: TOWN.bounds.minX - 3,
  maxX: TOWN.bounds.maxX + 5,
  minZ: TOWN.bounds.minZ - 5,
  maxZ: TOWN.bounds.maxZ + 3,
};

/** 뒤쪽 구석의 나무 (열매 없는 사과나무 모델) */
const TREES: Vec2[] = [
  { x: -12, z: -5 },
  { x: -10.6, z: -6.2 },
  { x: 10.2, z: -5.4 },
];

export function TownWorld(): React.ReactElement {
  useEffect(() => {
    Object.assign(walkBounds, TOWN.bounds);
    const spawn: Spawn = useWorldScene.getState().spawn ?? { ...TOWN.spawn, facing: Math.PI / 2 };
    placePlayer(spawn.x, spawn.z, spawn.facing ?? Math.PI / 2);

    const list: [string, Obstacle][] = [
      ...[TOWN.seedShop, TOWN.furnitureShop].map(
        ({ position, half }, i): [string, Obstacle] => [
          `town_shop_${i}`,
          {
            kind: 'box',
            minX: position.x - half.x,
            maxX: position.x + half.x,
            minZ: position.z - half.z,
            maxZ: position.z + half.z,
          },
        ],
      ),
      ...DECOR.filter((item) => item.radius > 0).map(
        (item, i): [string, Obstacle] => [`town_decor_${i}`, { kind: 'circle', x: item.x, z: item.z, radius: item.radius }],
      ),
      ...TREES.map((tree, i): [string, Obstacle] => [`town_tree_${i}`, { kind: 'circle', x: tree.x, z: tree.z, radius: 0.6 }]),
    ];
    for (const [key, obstacle] of list) obstacles.set(key, obstacle);
    return () => {
      for (const [key] of list) obstacles.delete(key);
    };
  }, []);

  const onTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 10) return;
    input.tapTarget = { x: event.point.x, z: event.point.z };
  };

  const { bounds, mainPathZ } = TOWN;
  const width = bounds.maxX - bounds.minX + 40;
  const depth = bounds.maxZ - bounds.minZ + 40;

  return (
    <group onClick={onTap}>
      <group position={[(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]}>
        <GrassGround width={width} depth={depth} />
      </group>
      {/* 시장은 움직이는 것이 캐릭터뿐이라, 건물 · 장식 · 나무 그림자를 모두 미리 그려 둔다 (core/bakedShadows) */}
      <BakedShadows bounds={TOWN_SHADOW_BOUNDS} />
      <StaticShadow>
        <Surroundings bounds={bounds} />
      </StaticShadow>

      {/* 큰길, 가게 문 앞으로 가는 길, 분수 광장 */}
      <PathStrip from={{ x: TOWN.gate.x + 0.4, z: TOWN.gate.z - 0.6 }} to={{ x: TOWN.gate.x + 1.5, z: mainPathZ }} />
      <PathStrip from={{ x: TOWN.gate.x + 1.5, z: mainPathZ }} to={{ x: bounds.maxX - 1.5, z: mainPathZ }} width={2.2} />
      {[TOWN.seedShop.door, TOWN.furnitureShop.door].map((door) => (
        <PathStrip key={door.x} from={{ x: door.x, z: mainPathZ }} to={door} width={1.6} />
      ))}
      <Plaza />

      <StaticShadow>
        <Gate />
        <Shop
          id="seed"
          label="농장 가게"
          modelKey={MODELS.buildings.seedShop}
          position={TOWN.seedShop.position}
          door={TOWN.seedShop.door}
          half={TOWN.seedShop.half}
          color={PALETTE.leaf}
        />
        <Shop
          id="furniture"
          label="가구 가게"
          modelKey={MODELS.buildings.furnitureShop}
          position={TOWN.furnitureShop.position}
          door={TOWN.furnitureShop.door}
          half={TOWN.furnitureShop.half}
          color="#f6b98a"
        />

        {DECOR.map((item, i) => (
          <group key={i} position={[item.x, 0, item.z]} rotation-y={item.rotation ?? 0} scale={item.scale ?? 1}>
            <GltfModel modelKey={furnitureModelKey(item.id)} fallback={<FallbackDecor />} />
            {FURNITURE_3D[item.id]?.glow && <NightGlow y={FURNITURE_3D[item.id].glow!.y} size={FURNITURE_3D[item.id].glow!.size} />}
          </group>
        ))}
        {TREES.map((tree, i) => (
          <group key={i} position={[tree.x, 0, tree.z]} rotation-y={i * 1.7}>
            <GltfModel modelKey={MODELS.trees.apple} fallback={<FallbackDecor />} />
          </group>
        ))}
      </StaticShadow>
    </group>
  );
}

/* --------------------------------- 표지판 --------------------------------- */

/** 마을로 돌아가는 표지판 */
function Gate(): React.ReactElement {
  const gate = TOWN.gate;

  useInteractable({
    id: 'town_gate_home',
    position: () => gate,
    range: 1.9,
    prompts: () => [{ id: 'go_home', label: `${AREA_NAME.village} 가기`, enabled: true }],
    // 마당의 시장 표지판 옆, 큰길 위에 마을 쪽(왼쪽)을 보고 선다
    onAction: () => goToScene('YardScene', { x: YARD.townGate.x - 1.5, z: YARD.mainPathZ, facing: -Math.PI / 2 }),
  });

  return (
    <group position={[gate.x, 0, gate.z]} rotation-y={0.35}>
      <SignBoard text={`← ${AREA_NAME.village}`} width={1.9} />
    </group>
  );
}

/* ---------------------------------- 가게 ---------------------------------- */

function Shop({
  id,
  label,
  modelKey,
  position,
  door,
  half,
  color,
}: {
  id: 'seed' | 'furniture';
  label: string;
  modelKey: string;
  position: Vec2;
  door: Vec2;
  half: { x: number; z: number };
  color: string;
}): React.ReactElement {
  useInteractable({
    id: `shop_${id}`,
    position: () => door,
    range: 1.8,
    prompts: () => [{ id: 'open', label: `${label} 열기`, enabled: true }],
    onAction: () => gameEvents.emit('shop:open', { shop: id }),
  });

  return (
    <group>
      <group position={[position.x, 0, position.z]}>
        <GltfModel modelKey={modelKey} fallback={<FallbackShop color={color} half={half} />} />
        {SHOP_LIGHTS[id].map(([x, y, z, size]) => (
          <group key={`${x}_${y}`} position={[x, 0, z]}>
            <NightGlow y={y} size={size} />
          </group>
        ))}
      </group>
      {/* 가게 이름 표지판은 문 옆, 길 쪽에 */}
      <group position={[door.x - 1.9, 0, door.z + 0.5]} rotation-y={0.2}>
        <SignBoard text={label} width={1.6} />
      </group>
    </group>
  );
}

/** 분수 둘레의 둥근 돌바닥 */
function Plaza(): React.ReactElement {
  return (
    <PathStrip from={{ x: 0, z: -3.6 }} to={{ x: 0, z: TOWN.mainPathZ - 0.4 }} width={4.2} />
  );
}

/* ------------------------------- 임시 모양 ------------------------------- */

function FallbackShop({ color, half }: { color: string; half: { x: number; z: number } }): React.ReactElement {
  return (
    <group>
      <mesh position-y={1.3} castShadow receiveShadow>
        <boxGeometry args={[half.x * 2, 2.6, half.z * 2]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position-y={3.2} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[3.1, 1.3, 4]} />
        <meshStandardMaterial color={PALETTE.roof} flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}

function FallbackDecor(): React.ReactElement {
  return (
    <mesh position-y={0.4} castShadow>
      <cylinderGeometry args={[0.3, 0.35, 0.8, 10]} />
      <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
    </mesh>
  );
}
