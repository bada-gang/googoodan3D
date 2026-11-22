/**
 * 집 앞 마당 + 농장 + 동물 우리. 게임의 중심 무대다.
 *
 * 걸어 다니기, 밭(심기·물 주기·수확), 동물 우리(먹이 주기·생산물 받기), 집 문과 시장 표지판.
 * 집 안(HomeWorld) · 시장(TownWorld)은 문 · 표지판으로 오간다.
 */
import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { PALETTE } from '@/config/artTokens';
import { PLOT_COUNT, YARD, YARD_TOWN_PORTAL, farmFieldRect, plotPosition } from '@/config/layout';
import { MODELS } from '@/config/models';
import { SHOW_AREA_SIGNS } from '@/config/features';
import { AREA_NAME } from '@/config/strings';
import { gameEvents } from '@/bridge/eventBus';
import type { TreeSpeciesId } from '@/types/game';
import { GltfModel } from '../../rendering/assets';
import { BakedShadows, StaticShadow } from '../../rendering/bakedShadows';
import { NightGlow } from '../../rendering/dayNight';
import { useInteractable } from '../../systems/interaction';
import { DecorateSystem, PlacedFurnitureLayer, decorateFloorHover, decorateFloorTap, type DecorateRules } from '../../gameplay/decorate';
import { placePlayer } from '../../systems/movement';
import { goToScene, useWorldScene, type Spawn } from '../../state/scenes';
import { input, obstacles, walkBounds } from '../../state/runtime';
import { GROUND_MARGIN, GrassGround, PathNetwork } from '../../props/Ground';
import { ForestWall } from '../../props/ForestWall';
import { SignBoard } from '../../props/SignBoard';
import { AnimalPen } from './pen/AnimalPen';
import { plantWithMath } from './farm/farmActions';
import { FarmPlot } from './farm/FarmPlot';
import { PlotBeds } from './farm/PlotBeds';

/** 미리 그리는 그림자를 까는 범위: 걸어 다니는 범위 + 외곽 덤불과 그 그림자 (그림자는 +x · -z 쪽으로 진다) */
const YARD_SHADOW_BOUNDS = {
  minX: YARD.bounds.minX - 3,
  maxX: YARD.bounds.maxX + 5,
  minZ: YARD.bounds.minZ - 5,
  maxZ: YARD.bounds.maxZ + 3,
};

const FARM_RECTS = [farmFieldRect('north'), farmFieldRect('south')];
/** 큰길에서 아래쪽 밭으로 들어가는 오솔길의 x (가운데 칸 사이) */
const SOUTH_PATH_X =
  YARD.farm.fields.south.origin.x + (YARD.farm.fields.south.gap * (YARD.farm.fields.south.columns - 1)) / 2;

/** 마당 꾸미기: 걸어 다니는 범위 안 어디든, 밭과 집 문 앞만 빼고 */
const YARD_DECORATE_RULES: DecorateRules = {
  area: 'yard',
  bounds: { minX: YARD.bounds.minX + 0.5, maxX: YARD.bounds.maxX - 0.5, minZ: YARD.bounds.minZ + 0.5, maxZ: YARD.bounds.maxZ - 0.3 },
  blocked: (x, z, radius) => {
    // 밭 두 곳 전체 (밭 사이 길까지)
    const inFarm = FARM_RECTS.some(
      (r) => x + radius > r.minX && x - radius < r.maxX && z + radius > r.minZ && z - radius < r.maxZ,
    );
    // 집 문 앞은 비워 둔다 (집에 못 들어가게 막히지 않게)
    const atDoor = Math.hypot(x - YARD.house.door.x, z - YARD.house.door.z) < radius + 1.2;
    return inFarm || atDoor;
  },
};

export function YardWorld(): React.ReactElement {
  useEffect(() => {
    Object.assign(walkBounds, YARD.bounds);
    // 집에서 나왔으면 집 문 앞에, 처음이면 길 위에
    const spawn: Spawn = useWorldScene.getState().spawn ?? YARD.spawn;
    placePlayer(spawn.x, spawn.z, spawn.facing ?? 0);

    const { house } = YARD;
    obstacles.set('house', { kind: 'circle', x: house.position.x, z: house.position.z, radius: house.radius });

    // 씨앗을 두 종류 이상 가졌을 때는 React 쪽에서 고르고 돌려준다
    const offSeed = gameEvents.on('seedpicker:choose', ({ plotId, species }) =>
      plantWithMath(plotId, species as TreeSpeciesId),
    );

    return () => {
      obstacles.delete('house');
      offSeed();
    };
  }, []);

  // 땅을 톡 치면 그 자리로 걸어간다. 끌다가 뗀 것(카메라 보기 등)은 무시한다.
  // 꾸미기 중이면 들고 있는 물건을 놓는다
  const onTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 10) return;
    if (decorateFloorTap(event.point.x, event.point.z)) return;
    input.tapTarget = { x: event.point.x, z: event.point.z };
  };

  const width = YARD.bounds.maxX - YARD.bounds.minX + GROUND_MARGIN * 2;
  const depth = YARD.bounds.maxZ - YARD.bounds.minZ + GROUND_MARGIN * 2;
  const centerX = (YARD.bounds.minX + YARD.bounds.maxX) / 2;
  const centerZ = (YARD.bounds.minZ + YARD.bounds.maxZ) / 2;
  const { door } = YARD.house;
  const pathZ = YARD.mainPathZ;
  const firstPlot = plotPosition(0);
  const northRect = FARM_RECTS[0];

  return (
    <group onClick={onTap} onPointerMove={(event) => decorateFloorHover(event.point.x, event.point.z)}>
      <DecorateSystem rules={YARD_DECORATE_RULES} />
      <PlacedFurnitureLayer area="yard" />
      <group position={[centerX, 0, centerZ]}>
        <GrassGround width={width} depth={depth} />
      </group>
      {/* 움직이지 않는 것의 그림자는 미리 그려 둔다 (rendering/bakedShadows) */}
      <BakedShadows bounds={YARD_SHADOW_BOUNDS} />
      <StaticShadow>
        {/* 시장 가는 큰길이 나가는 자리는 숲을 튼다 */}
        <ForestWall bounds={YARD.bounds} openings={[{ side: 'east', z: YARD.mainPathZ, width: YARD.mainPathWidth + 1 }]} />
      </StaticShadow>

      {/* 길: 집 문 → 큰길 → 시장 표지판, 큰길에서 위쪽 밭 사이 · 아래쪽 밭 사이로 한 줄씩 */}
      <PathNetwork
        segments={[
          { from: door, to: { x: door.x, z: pathZ } },
          // 큰길은 오른쪽 끝(시장 쪽)을 지나 숲 틈 밖으로 이어진다
          { from: { x: door.x, z: pathZ }, to: { x: YARD.bounds.maxX + 12, z: pathZ }, width: YARD.mainPathWidth },
          {
            from: { x: (firstPlot.x + plotPosition(1).x) / 2, z: pathZ },
            to: { x: (firstPlot.x + plotPosition(1).x) / 2, z: firstPlot.z - 0.6 },
            width: 0.9,
          },
          { from: { x: SOUTH_PATH_X, z: pathZ }, to: { x: SOUTH_PATH_X, z: FARM_RECTS[1].maxZ + 0.2 }, width: 0.9 },
        ]}
      />

      <StaticShadow>
        <House />
      </StaticShadow>

      <PlotBeds />
      {Array.from({ length: PLOT_COUNT }, (_, index) => (
        <FarmPlot key={index} index={index} />
      ))}
      {SHOW_AREA_SIGNS.farm && (
        <StaticShadow>
          <group position={[northRect.minX - 1, 0, northRect.maxZ + 0.4]} rotation-y={0.25}>
            <SignBoard text={AREA_NAME.farm} width={1.4} />
          </group>
        </StaticShadow>
      )}

      <AnimalPen />
      <StaticShadow>
        <TownGate />
      </StaticShadow>
    </group>
  );
}

/* ---------------------------------- 집 ---------------------------------- */

/** 집 모델의 앞 창문 자리 (집 중심 기준) */
const HOUSE_WINDOWS: [number, number, number][] = [
  [-1.15, 1.62, 1.8],
  [1.15, 1.62, 1.8],
];

function House(): React.ReactElement {
  const { position, door } = YARD.house;

  useInteractable({
    id: 'house_door',
    position: () => door,
    range: 1.7,
    prompts: () => [{ id: 'enter_home', label: '집에 들어가기', enabled: true }],
    onAction: () => goToScene('HomeScene'),
  });

  return (
    <group position={[position.x, 0, position.z]}>
      <GltfModel modelKey={MODELS.buildings.house} fallback={<FallbackHouse />} />
      {/* 밤에 켜지는 창문 불빛 (둥근 창 두 개, 모델을 보고 맞춘 자리) */}
      {HOUSE_WINDOWS.map(([x, y, z]) => (
        <group key={x} position={[x, 0, z]}>
          <NightGlow y={y} size={1.1} />
        </group>
      ))}
      <group position={[-3.2, 0, 2.4]} rotation-y={0.3}>
        <SignBoard text={AREA_NAME.home} width={1.5} />
      </group>
    </group>
  );
}

/** 모델이 아직 없을 때의 임시 집 */
function FallbackHouse(): React.ReactElement {
  return (
    <group>
      <mesh position-y={1.3} castShadow receiveShadow>
        <boxGeometry args={[4.4, 2.6, 3.6]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.9} />
      </mesh>
      <mesh position-y={3.45} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[3.6, 1.7, 4]} />
        <meshStandardMaterial color={PALETTE.roof} flatShading roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.85, 1.81]}>
        <boxGeometry args={[1, 1.7, 0.06]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
    </group>
  );
}

/* -------------------------------- 시장 입구 -------------------------------- */

function TownGate(): React.ReactElement {
  const gate = YARD.townGate;

  useInteractable({
    id: 'town_gate',
    position: () => gate,
    // 표지판 둘레가 아니라 큰길 끝에 닿으면
    area: YARD_TOWN_PORTAL,
    prompts: () => [{ id: 'go_town', label: `${AREA_NAME.market} 가기`, enabled: true }],
    onAction: () => goToScene('TownScene'),
  });

  return (
    <group position={[gate.x, 0, gate.z]} rotation-y={-0.2}>
      <SignBoard text={`${AREA_NAME.market} →`} width={1.6} />
    </group>
  );
}
