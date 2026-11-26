/**
 * 마굿간 안 배치: 방 크기 · 카메라 · 입구 · 창 · 다락 · 칸막이 · 물건 자리 · 부딪힘 · 색.
 * 숫자만 바꿀 때는 이 파일만 고친다. 그리는 것은 BarnStructure(건물) · BarnProps(물건) · BarnLight(빛).
 *
 * 위에서 본 모습 (위가 안쪽 벽, 아래 가운데가 입구):
 *   왼쪽: 칸막이 두 칸 (건초 더미 · 여물통)   가운데: 비운 통로, 쌓인 건초 뭉치   오른쪽: 다락 · 사다리 · 도구 걸이 · 손수레 · 우유 통
 */
import { PALETTE } from '@/config/artTokens';
import type { Obstacle } from '../../state/runtime';

/** 마굿간 크기 (m). 가로 10, 깊이 8, 벽 높이 3 (그 위는 지붕 그늘) */
export const ROOM = { width: 10, depth: 8, wallHeight: 3 } as const;
export const HALF_W = ROOM.width / 2;
export const HALF_D = ROOM.depth / 2;
export const BACK_Z = -HALF_D;
export const FRONT_Z = HALF_D;
export const WALL_THICKNESS = 0.2;
/** 보이는 벽 높이. 벽 위로 바깥이 보이지 않게 높인다 (집 안과 같다) */
export const VISIBLE_WALL_HEIGHT = 6.5;
/** 입구 바깥으로 이어지는 풀밭 길이 (화면 아래 끝까지) */
export const FRONT_EXTENSION = 3;

/**
 * 고정 카메라: 입구 쪽 위에서 비스듬히 내려다본다.
 * 안이 화면을 크게 채우게 가까이 둔다 — 입구 문짝 · 벽 윗부분은 화면 끝에서 조금 잘려도 된다 (사용자 요청)
 */
export const BARN_VIEW = { position: [0, 8.1, 8.9], target: [0, 0.1, -0.7] } as {
  position: [number, number, number];
  target: [number, number, number];
};

/** 출입구: 앞(카메라 쪽) 가운데 (6시 방향) */
export const ENTRANCE = { halfWidth: 1.3, height: 2.6 };
/** 처음 서는 자리: 입구 안쪽, 안(위)을 본다 */
export const SPAWN = { x: 0, z: FRONT_Z - 0.9, facing: Math.PI };
/** 다락 창 (뒷벽 높이) — 여기서 햇빛 줄기가 내려온다 */
export const LOFT_WINDOW = { x: 0.3, y: 2.35, width: 1.3, height: 1.05 };
/** 판자 틈 (뒷벽 왼쪽). 가는 빛 줄기 */
export const SLITS = [-2.75, -2.45];
/** 다락: 오른쪽 안쪽 위, 사다리로 올라가는 듯 (올라가지는 못한다) */
export const LOFT = { minX: 2.0, maxX: HALF_W, minZ: BACK_Z, maxZ: BACK_Z + 1.3, y: 2.9 };
/** 칸막이 (왼쪽 벽에서 통로 쪽으로): 끝 기둥의 x, 칸막이 벽의 z */
export const STALL_FRONT_X = -3.2;
export const STALL_WALLS_Z = [-1.25, 1.35];

/** 색. 벽 · 바닥은 흰 바탕 질감에 곱한다 */
export const COLORS = {
  wall: '#b07a52',
  wallShade: '#6e4a32',
  floor: '#bb9a6c',
  barnRed: '#c4564a',
  trim: '#f3ead9',
  straw: '#e3bf68',
  beam: PALETTE.woodDark,
  /** 햇빛 줄기 · 바닥 빛 */
  sunlight: '#ffdc9c',
  /** 창 · 판자 틈 (낮) */
  window: '#fff1cf',
} as const;

/** 장식 자리 (x, z, 돌림). 부딪힘(BARN_OBSTACLES)과 그림(BarnProps)이 같은 값을 쓴다 */
export const PLACE = {
  hayStack: { x: -1.35, z: BACK_Z + 0.55 },
  looseBale: { x: -0.55, z: BACK_Z + 1.75, rot: 0.45 },
  hayPileStall: { x: -4.15, z: -2.6 },
  troughStall: { x: -4.5, z: 0.05 },
  baleStall: { x: -3.85, z: 0.85, rot: 1.2 },
  bucketFront: { x: -4.2, z: 2.5 },
  toolRack: { x: HALF_W - 0.3, z: -0.75 },
  wheelbarrow: { x: 3.55, z: 1.25, rot: -0.75 },
  milkCans: [
    { x: 4.35, z: 2.75 },
    { x: 4.7, z: 2.25 },
  ],
  appleCrate: { x: 4.3, z: BACK_Z + 0.55 },
  bucketBack: { x: 3.45, z: BACK_Z + 0.5 },
  ladder: { x: 2.7, z: LOFT.maxZ + 0.5 },
} as const;

/** 벽 등불 두 개 (뒷벽 왼쪽 · 오른쪽 벽 가운데). 왼쪽 벽 앞쪽은 카메라에서 잘려 안 보여서 뒷벽에 단다 */
export const LANTERNS = [
  { x: -3.75, y: 1.55, z: BACK_Z + WALL_THICKNESS / 2 + 0.02, rot: 0 },
  { x: HALF_W - WALL_THICKNESS / 2 - 0.02, y: 1.55, z: 0.55, rot: -Math.PI / 2 },
];

/** 햇빛 줄기: 창에서 바닥까지. 첫째가 큰 줄기(다락 창) */
export const SHAFTS: { from: [number, number, number]; to: [number, number, number]; width: number; strength: number }[] = [
  {
    from: [LOFT_WINDOW.x, LOFT_WINDOW.y, BACK_Z + 0.15],
    to: [LOFT_WINDOW.x - 0.9, 0, BACK_Z + 3.6],
    width: LOFT_WINDOW.width,
    strength: 0.42,
  },
  ...SLITS.map((x) => ({
    from: [x, 1.95, BACK_Z + 0.15] as [number, number, number],
    to: [x - 0.5, 0, BACK_Z + 2.4] as [number, number, number],
    width: 0.16,
    strength: 0.3,
  })),
];

/* -------------------------------- 부딪힘 -------------------------------- */

const box = (minX: number, maxX: number, minZ: number, maxZ: number): Obstacle => ({ kind: 'box', minX, maxX, minZ, maxZ });
const circle = (x: number, z: number, radius: number): Obstacle => ({ kind: 'circle', x, z, radius });

/** 걸을 수 있는 범위 */
export const WALK_BOUNDS = { minX: -HALF_W + 0.4, maxX: HALF_W - 0.4, minZ: BACK_Z + 0.4, maxZ: FRONT_Z - 0.35 };

export const BARN_OBSTACLES: [string, Obstacle][] = [
  ...STALL_WALLS_Z.map((z, i): [string, Obstacle] => [`barn_stall_${i}`, box(-HALF_W, STALL_FRONT_X + 0.1, z - 0.1, z + 0.1)]),
  ['barn_hay_stack', box(PLACE.hayStack.x - 1.1, PLACE.hayStack.x + 1.1, BACK_Z, PLACE.hayStack.z + 0.4)],
  ['barn_loose_bale', circle(PLACE.looseBale.x, PLACE.looseBale.z, 0.6)],
  ['barn_hay_pile', circle(PLACE.hayPileStall.x, PLACE.hayPileStall.z, 0.9)],
  ['barn_trough', box(PLACE.troughStall.x - 0.35, PLACE.troughStall.x + 0.35, PLACE.troughStall.z - 0.8, PLACE.troughStall.z + 0.8)],
  ['barn_bale_stall', circle(PLACE.baleStall.x, PLACE.baleStall.z, 0.45)],
  ['barn_bucket_front', circle(PLACE.bucketFront.x, PLACE.bucketFront.z, 0.35)],
  ['barn_tool_rack', box(PLACE.toolRack.x - 0.35, HALF_W, PLACE.toolRack.z - 0.75, PLACE.toolRack.z + 0.75)],
  ['barn_wheelbarrow', circle(PLACE.wheelbarrow.x, PLACE.wheelbarrow.z, 0.8)],
  ['barn_milk_cans', circle(4.5, 2.5, 0.6)],
  ['barn_under_loft', box(LOFT.minX + 0.6, HALF_W, BACK_Z, LOFT.maxZ - 0.3)],
  ['barn_ladder', box(PLACE.ladder.x - 0.4, PLACE.ladder.x + 0.4, LOFT.maxZ - 0.1, PLACE.ladder.z + 0.2)],
  ['barn_loft_post', circle(LOFT.minX, LOFT.maxZ, 0.2)],
  // 입구 양옆 낮은 앞벽
  ['barn_front_l', box(-HALF_W, -ENTRANCE.halfWidth, FRONT_Z - 0.15, FRONT_Z + 0.15)],
  ['barn_front_r', box(ENTRANCE.halfWidth, HALF_W, FRONT_Z - 0.15, FRONT_Z + 0.15)],
];
