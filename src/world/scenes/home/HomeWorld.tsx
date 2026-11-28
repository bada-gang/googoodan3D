/**
 * 집 안. 가구를 놓아 꾸미는 방이다. (명세 29)
 *
 * 앞(카메라 쪽) 벽은 없다 — 인형의 집처럼 들여다본다.
 * 카메라는 방 가운데에 고정한다 (HOME_VIEW). 방 밖이 보이지 않게 벽은 높게, 바닥 · 옆벽은 카메라 쪽으로 더 늘렸다 —
 * 늘린 부분은 보이기만 하고, 걷거나 가구를 놓는 범위(ROOM)는 그대로다.
 * 숫자는 homeLayout, 방 모양(바닥 · 벽 · 창 · 문)은 HomeStructure.
 */
import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { surfaceTextureKey } from '@/config/assets';
import { SURFACE_BY_ID } from '@/config/catalog';
import { YARD } from '@/config/layout';
import { useGameStore } from '@/state/gameStore';
import { BakedShadows } from '../../rendering/bakedShadows';
import { DecorateSystem, PlacedFurnitureLayer, decorateFloorHover, decorateFloorTap, type DecorateRules } from '../../gameplay/decorate';
import { useInteractable } from '../../systems/interaction';
import { placePlayer } from '../../systems/movement';
import { input, walkBounds } from '../../state/runtime';
import { goToScene, useWorldScene } from '../../state/scenes';
import { Floor, Walls, WindowGlass, Woodwork } from './HomeStructure';
import {
  BACK_Z,
  DOOR,
  HALF_W,
  HOME_SHADOW,
  HOME_SHADOW_BOUNDS,
  PLACE_BOUNDS,
  SPAWN,
  USABLE_FRONT_Z,
  WALL_THICKNESS,
} from './homeLayout';

export { HOME_VIEW, ROOM } from './homeLayout';

const RULES: DecorateRules = {
  area: 'home',
  // 가구 그림자는 바닥에 미리 굽는다 (가구 하나당 그리기 1번 절약, 헛간과 같은 방식)
  bakeShadows: true,
  bounds: PLACE_BOUNDS,
  // 액자 · 시계는 뒷벽에 건다. 창문 자리는 피한다.
  // 거는 높이 1.0m: 카메라를 낮춘 뒤 1.35m 는 화면 위쪽 레벨 막대에 윗부분이 가렸다 (이미 건 것도 같이 내려온다)
  wall: { z: BACK_Z + WALL_THICKNESS / 2 + 0.05, y: 1.0, minX: -HALF_W + 0.3, maxX: HALF_W - 0.3 },
  blocked: (x, z, radius) => {
    // 나가는 문 앞은 비워 둔다 (갇히지 않게)
    return x - radius < -HALF_W + 1.6 && Math.abs(z - DOOR.z) < DOOR.width / 2 + radius;
  },
};

export function HomeWorld(): React.ReactElement {
  const wallpaperId = useGameStore((s) => s.home.wallpaperId);
  const floorId = useGameStore((s) => s.home.floorId);
  const wallpaper = SURFACE_BY_ID[wallpaperId] ?? SURFACE_BY_ID.wall_cream;
  const floor = SURFACE_BY_ID[floorId] ?? SURFACE_BY_ID.floor_wood;

  useEffect(() => {
    Object.assign(walkBounds, { minX: -HALF_W + 0.4, maxX: HALF_W - 0.4, minZ: BACK_Z + 0.4, maxZ: USABLE_FRONT_Z - 0.2 });
    const spawn = useWorldScene.getState().spawn ?? SPAWN;
    placePlayer(spawn.x, spawn.z, spawn.facing ?? SPAWN.facing);
  }, []);

  useInteractable({
    id: 'home_exit',
    // 문 소리만 (버튼 딸깍과 겹치지 않게)
    silentTap: true,
    position: () => ({ x: -HALF_W + 0.5, z: DOOR.z }),
    range: 1.5,
    prompts: () => [{ id: 'exit_home', label: '밖으로 나가기', enabled: true }],
    onAction: () =>
      // 집 문 앞, 마당 쪽을 보고 선다
      goToScene('YardScene', { x: YARD.house.door.x, z: YARD.house.door.z + 1.2, facing: 0 }),
  });

  const onTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 10) return;
    if (decorateFloorTap(event.point.x, event.point.z)) return;
    input.tapTarget = { x: event.point.x, z: event.point.z };
  };
  const onHover = (event: ThreeEvent<PointerEvent>) => decorateFloorHover(event.point.x, event.point.z);

  // 뒷벽을 눌러도 된다: 시계 · 액자는 누른 가로 자리에 걸린다 (예전에는 바닥만 받아서 벽을 누르면 아무 일도 없었다).
  // 바닥 물건을 들고 있으면 벽 바로 앞 바닥에, 꾸미기 중이 아니면 벽 앞까지 걸어간다
  const wallFrontZ = BACK_Z + 0.6;
  const onWallTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 10) return;
    if (decorateFloorTap(event.point.x, wallFrontZ)) return;
    input.tapTarget = { x: event.point.x, z: wallFrontZ };
  };
  const onWallHover = (event: ThreeEvent<PointerEvent>) => decorateFloorHover(event.point.x, wallFrontZ);

  return (
    <group>
      <DecorateSystem rules={RULES} />
      <Floor textureKey={surfaceTextureKey(floor, 'floor')} color={floor.color} onClick={onTap} onPointerMove={onHover} />
      <BakedShadows bounds={HOME_SHADOW_BOUNDS} color={HOME_SHADOW.color} opacity={HOME_SHADOW.opacity} />
      <Walls
        textureKey={surfaceTextureKey(wallpaper, 'wall')}
        color={wallpaper.color}
        onBackWallClick={onWallTap}
        onBackWallMove={onWallHover}
      />
      <WindowGlass />
      {/* 창틀 · 문 · 굽도리 (그림자 없음) */}
      <Woodwork />
      <PlacedFurnitureLayer rules={RULES} />
    </group>
  );
}
