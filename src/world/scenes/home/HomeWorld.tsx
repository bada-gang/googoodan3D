/**
 * 집 안. 가구를 놓아 꾸미는 방이다. (명세 29)
 *
 * 앞(카메라 쪽) 벽은 없다 — 인형의 집처럼 들여다본다.
 * 카메라는 방 가운데에 고정한다 (HOME_VIEW). 방 밖이 보이지 않게 벽은 높게, 바닥 · 옆벽은 카메라 쪽으로 더 늘렸다 —
 * 늘린 부분은 보이기만 하고, 걷거나 가구를 놓는 범위(ROOM)는 그대로다.
 * 벽지 · 바닥은 흰 바탕 무늬 질감에 고른 색을 곱해 칠한다 (상점 미리보기와 같은 계산 — icons.ts surfaceStyle).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, type MeshStandardMaterial } from 'three';
import { PALETTE } from '@/config/artTokens';
import { surfaceTextureKey } from '@/config/assets';
import { SURFACE_BY_ID } from '@/config/catalog';
import { YARD } from '@/config/layout';
import { useGameStore } from '@/state/gameStore';
import { ArtTexture } from '../../rendering/assets';
import { daylight } from '../../rendering/dayNight';
import { DecorateSystem, PlacedFurnitureLayer, decorateFloorHover, decorateFloorTap, type DecorateRules } from '../../gameplay/decorate';
import { useInteractable } from '../../systems/interaction';
import { placePlayer } from '../../systems/movement';
import { input, walkBounds } from '../../state/runtime';
import { goToScene, useWorldScene } from '../../state/scenes';

/** 방 크기 (m). 가로 10, 깊이 7, 벽 높이 3 */
export const ROOM = { width: 10, depth: 7, wallHeight: 3 } as const;
const HALF_W = ROOM.width / 2;
const HALF_D = ROOM.depth / 2;
const BACK_Z = -HALF_D;
const WALL_THICKNESS = 0.2;
/** 보이는 벽 높이. 방(ROOM.wallHeight)보다 높여 벽 위로 바깥이 보이지 않게 한다 */
const VISIBLE_WALL_HEIGHT = 6.5;
/** 바닥 · 옆벽을 카메라 쪽으로 더 늘리는 길이 (화면 아래 끝까지 바닥이 차게) */
const FRONT_EXTENSION = 2.5;
/**
 * 고정 카메라: 방 가운데 앞쪽 위에서 비스듬히 내려다본다.
 * 2026-11 낮추고 가까이 (사용자 요청: 너무 높다) — 방이 화면을 더 크게 채운다. 가구를 놓는 바닥(앞쪽 끝 · 귀퉁이 포함)은 다 보이게 둔다
 */
export const HOME_VIEW = { position: [0, 6.6, 9.0], target: [0, 0.1, 0.3] } as {
  position: [number, number, number];
  target: [number, number, number];
};

/** 나가는 문 (왼쪽 벽 앞쪽) */
const DOOR = { z: 1.6, width: 1.3, height: 2.2 };
/** 처음 서는 자리: 문 안쪽 */
const SPAWN = { x: -HALF_W + 1.2, z: DOOR.z, facing: Math.PI / 2 };
/** 창문 (뒷벽) */
const WINDOW = { x: 1.8, y: 1.75, width: 2, height: 1.3 };
const GLASS_DAY = new Color(PALETTE.windowLight);
const GLASS_GLOW = new Color(PALETTE.window);

/** 가구를 놓을 수 있는 바닥 (벽에서 조금 띄운다) */
const PLACE_BOUNDS = { minX: -HALF_W + 0.25, maxX: HALF_W - 0.25, minZ: BACK_Z + 0.25, maxZ: HALF_D - 0.3 };

const RULES: DecorateRules = {
  area: 'home',
  bounds: PLACE_BOUNDS,
  // 액자 · 시계는 뒷벽에 건다. 창문 자리는 피한다
  wall: { z: BACK_Z + WALL_THICKNESS / 2 + 0.05, y: 1.35, minX: -HALF_W + 0.3, maxX: HALF_W - 0.3 },
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
    Object.assign(walkBounds, { minX: -HALF_W + 0.4, maxX: HALF_W - 0.4, minZ: BACK_Z + 0.4, maxZ: HALF_D - 0.2 });
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

  return (
    <group>
      <DecorateSystem rules={RULES} />

      {/* 바닥 */}
      <mesh position-z={FRONT_EXTENSION / 2} rotation-x={-Math.PI / 2} receiveShadow onClick={onTap} onPointerMove={onHover}>
        <planeGeometry args={[ROOM.width, ROOM.depth + FRONT_EXTENSION]} />
        <SurfaceMaterial
          textureKey={surfaceTextureKey(floor, 'floor')}
          color={floor.color}
          repeat={[ROOM.width / 2, (ROOM.depth + FRONT_EXTENSION) / 2]}
        />
      </mesh>

      {/* 벽: 뒤 · 왼쪽 · 오른쪽 */}
      <Wall position={[0, VISIBLE_WALL_HEIGHT / 2, BACK_Z]} length={ROOM.width + WALL_THICKNESS} color={wallpaper.color} textureKey={surfaceTextureKey(wallpaper, 'wall')} />
      <Wall position={[-HALF_W, VISIBLE_WALL_HEIGHT / 2, FRONT_EXTENSION / 2]} length={ROOM.depth + FRONT_EXTENSION} rotation={Math.PI / 2} color={wallpaper.color} textureKey={surfaceTextureKey(wallpaper, 'wall')} />
      <Wall position={[HALF_W, VISIBLE_WALL_HEIGHT / 2, FRONT_EXTENSION / 2]} length={ROOM.depth + FRONT_EXTENSION} rotation={-Math.PI / 2} color={wallpaper.color} textureKey={surfaceTextureKey(wallpaper, 'wall')} />
      <Baseboards />

      <Window />
      <Door />

      <PlacedFurnitureLayer area="home" />
    </group>
  );
}

/* --------------------------------- 벽 · 바닥 --------------------------------- */

/** 흰 바탕 무늬 질감 × 고른 색 */
function SurfaceMaterial({
  textureKey,
  color,
  repeat,
}: {
  textureKey: string;
  color: string;
  repeat: [number, number];
}): React.ReactElement {
  return (
    <ArtTexture assetKey={textureKey} repeat={repeat}>
      {(map) => <meshStandardMaterial map={map} color={color} roughness={0.95} />}
    </ArtTexture>
  );
}

function Wall({
  position,
  length,
  rotation = 0,
  color,
  textureKey,
}: {
  position: [number, number, number];
  length: number;
  rotation?: number;
  color: string;
  textureKey: string;
}): React.ReactElement {
  return (
    // 벽은 그림자를 드리우지 않는다. 해가 왼쪽 위에 있어 왼쪽 벽 그림자가 바닥을 반이나 덮는다
    <mesh position={position} rotation-y={rotation} receiveShadow>
      <boxGeometry args={[length, VISIBLE_WALL_HEIGHT, WALL_THICKNESS]} />
      <SurfaceMaterial textureKey={textureKey} color={color} repeat={[length / 2, VISIBLE_WALL_HEIGHT / 2]} />
    </mesh>
  );
}

/** 벽 아래 나무 굽도리 */
function Baseboards(): React.ReactElement {
  const pieces = useMemo(
    () =>
      [
        { position: [0, 0.08, BACK_Z + WALL_THICKNESS / 2 + 0.02], size: [ROOM.width, 0.16, 0.04] },
        { position: [-HALF_W + WALL_THICKNESS / 2 + 0.02, 0.08, FRONT_EXTENSION / 2], size: [0.04, 0.16, ROOM.depth + FRONT_EXTENSION] },
        { position: [HALF_W - WALL_THICKNESS / 2 - 0.02, 0.08, FRONT_EXTENSION / 2], size: [0.04, 0.16, ROOM.depth + FRONT_EXTENSION] },
      ] as { position: [number, number, number]; size: [number, number, number] }[],
    [],
  );
  return (
    <group>
      {pieces.map((piece, i) => (
        <mesh key={i} position={piece.position}>
          <boxGeometry args={piece.size} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

/** 뒷벽 창문: 나무 틀 + 밝은 하늘색 유리 (빛이 들어오는 느낌). 유리는 바깥 하늘색을 따라 노을 · 밤이 된다 */
function Window(): React.ReactElement {
  const z = BACK_Z + WALL_THICKNESS / 2 + 0.01;
  const glass = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    if (!glass.current) return;
    const k = Math.min(1, daylight.darkness * 1.2);
    glass.current.color.copy(GLASS_DAY).lerp(daylight.sky, k);
    glass.current.emissive.copy(GLASS_GLOW).lerp(daylight.sky, k);
  });
  return (
    <group position={[WINDOW.x, WINDOW.y, z]}>
      <mesh position-z={0.02}>
        <planeGeometry args={[WINDOW.width, WINDOW.height]} />
        <meshStandardMaterial ref={glass} color={PALETTE.windowLight} emissive={PALETTE.window} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {/* 틀 */}
      {[
        [0, WINDOW.height / 2, WINDOW.width + 0.16, 0.12],
        [0, -WINDOW.height / 2, WINDOW.width + 0.16, 0.12],
        [-WINDOW.width / 2, 0, 0.12, WINDOW.height],
        [WINDOW.width / 2, 0, 0.12, WINDOW.height],
        [0, 0, 0.08, WINDOW.height],
        [0, 0, WINDOW.width, 0.08],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.05]} castShadow>
          <boxGeometry args={[w, h, 0.08]} />
          <meshStandardMaterial color={PALETTE.wood} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** 왼쪽 벽의 나가는 문 */
function Door(): React.ReactElement {
  const x = -HALF_W + WALL_THICKNESS / 2 + 0.02;
  return (
    <group position={[x, DOOR.height / 2, DOOR.z]} rotation-y={Math.PI / 2}>
      <mesh>
        <boxGeometry args={[DOOR.width, DOOR.height, 0.06]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.85} />
      </mesh>
      <mesh position={[DOOR.width * 0.32, 0, 0.06]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color={PALETTE.gold} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* 문틀 */}
      <mesh position-z={-0.02}>
        <boxGeometry args={[DOOR.width + 0.2, DOOR.height + 0.12, 0.04]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.85} />
      </mesh>
    </group>
  );
}
