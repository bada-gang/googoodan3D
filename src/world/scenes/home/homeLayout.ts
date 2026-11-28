/**
 * 집 안 방의 크기 · 자리 숫자. 방 모양은 HomeStructure, 장면(걷기 · 꾸미기 · 문)은 HomeWorld.
 */
import { Color } from 'three';

/** 방 크기 (m). 가로 10, 깊이 7, 벽 높이 3 */
export const ROOM = { width: 10, depth: 7, wallHeight: 3 } as const;
export const HALF_W = ROOM.width / 2;
export const HALF_D = ROOM.depth / 2;
export const BACK_Z = -HALF_D;
export const WALL_THICKNESS = 0.2;
/** 보이는 벽 높이. 방(ROOM.wallHeight)보다 높여 벽 위로 바깥이 보이지 않게 한다 */
export const VISIBLE_WALL_HEIGHT = 6.5;
/** 바닥 · 옆벽을 카메라 쪽으로 더 늘리는 길이 (화면 아래 끝까지 바닥이 차게) */
export const FRONT_EXTENSION = 2.5;

/**
 * 고정 카메라: 방 가운데 앞쪽 위에서 비스듬히 내려다본다.
 * 2026-11 낮추고 가까이 (사용자 요청: 너무 높다) — 방이 화면을 더 크게 채운다. 가구를 놓는 바닥(앞쪽 끝 · 귀퉁이 포함)은 다 보이게 둔다
 */
export const HOME_VIEW = { position: [0, 6.6, 9.0], target: [0, 0.1, 0.3] } as {
  position: [number, number, number];
  target: [number, number, number];
};

/** 나가는 문 (왼쪽 벽 앞쪽) */
export const DOOR = { z: 1.6, width: 1.3, height: 2.2 };
/** 처음 서는 자리: 문 안쪽 */
export const SPAWN = { x: -HALF_W + 1.2, z: DOOR.z, facing: Math.PI / 2 };
/** 창문 (뒷벽) */
export const WINDOW = { x: 1.8, y: 1.75, width: 2, height: 1.3 };

/**
 * 걷고 가구를 놓는 앞쪽 끝. 앞벽이 없어 바닥이 화면 아래까지 이어지므로, 보이는 마루(화면 아래 끝 근처)까지 쓸 수 있게 한다.
 * (예전에는 방 깊이 끝 3.5m 까지만이라 화면 아래쪽 마루에 아무것도 못 놓았다. 넓히기만 해서 이미 놓은 가구는 그대로다)
 */
export const USABLE_FRONT_Z = HALF_D + 0.9;
/** 가구를 놓을 수 있는 바닥 (벽에서 조금 띄운다) */
export const PLACE_BOUNDS = { minX: -HALF_W + 0.25, maxX: HALF_W - 0.25, minZ: BACK_Z + 0.25, maxZ: USABLE_FRONT_Z };

/** 가구 · 창틀 그림자를 굽는 바닥 범위와 색 (나무 바닥 위 따뜻한 갈색) */
export const HOME_SHADOW_BOUNDS = { minX: -HALF_W - 1, maxX: HALF_W + 1, minZ: BACK_Z - 1, maxZ: HALF_D + FRONT_EXTENSION + 1 };
export const HOME_SHADOW = { color: new Color('#2a1a10'), opacity: 0.42 };
