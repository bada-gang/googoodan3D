/**
 * 화면 논리 해상도와 3D 월드 배치. 실제 태블릿 해상도와 분리한다. (명세 67)
 */

/* ------------------------------ 화면 (React UI) ------------------------------ */

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 800;

/** 4:3 아이패드에서도 잘리면 안 되는 안전 영역 (가로 기준) */
export const SAFE_WIDTH = 1066; // 800 * 4/3
export const SAFE_INSET_X = (GAME_WIDTH - SAFE_WIDTH) / 2;

/** HUD가 덮는 상단·하단 높이 */
export const HUD_TOP = 92;
export const HUD_BOTTOM = 132;

/* --------------------------------- 3D 월드 --------------------------------- */
/*
 * 단위는 m. 바닥은 y = 0, 위에서 내려다볼 때 x 는 오른쪽, z 는 화면 아래쪽(카메라 쪽)이다.
 * 카메라는 항상 같은 방향(남쪽 위)에서 보므로 조이스틱 위 = -z 로 걷는다.
 */

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * 장면 이동(시장 가기 · 마을 가기) 범위: 큰길 끝에서 안쪽으로 이만큼, 길 폭에서 위아래로 이만큼 더.
 * 표지판 둘레가 아니라 길 끝에 닿으면 버튼이 뜬다.
 */
const PORTAL_LENGTH = 2;
const PORTAL_MARGIN = 0.4;

function pathEndPortal(endX: number, inward: 1 | -1, pathZ: number, pathWidth: number) {
  const x2 = endX + inward * PORTAL_LENGTH;
  const half = pathWidth / 2 + PORTAL_MARGIN;
  return { minX: Math.min(endX, x2), maxX: Math.max(endX, x2), minZ: pathZ - half, maxZ: pathZ + half };
}


export const YARD = {
  /** 걸어 다닐 수 있는 범위 */
  bounds: { minX: -15, maxX: 19, minZ: -11, maxZ: 11.5 },
  /** 처음 서는 자리 (집 앞 길) */
  spawn: { x: -8, z: 0.4 } as Vec2,
  house: {
    position: { x: -8, z: -6.2 } as Vec2,
    /** 문 앞 (상호작용 자리) */
    door: { x: -8, z: -3.4 } as Vec2,
    /** 부딪히는 반지름 */
    radius: 2.6,
  },
  farm: {
    /** 밭 한 칸 크기 (정사각형 한 변) */
    plotSize: 2.4,
    fields: {
      /** 집 옆, 큰길 위쪽: 2칸 × 2줄. 옆 칸 사이 0.9m 길, 위아래 줄 사이 1.35m 길 (위쪽 줄을 조금 더 띄웠다) */
      north: { origin: { x: -2, z: -6.25 } as Vec2, columns: 2, rows: 2, gap: 3.3, rowGap: 3.75 },
      /** 큰길 건너편: 2칸 × 2줄. 위쪽 밭과 같은 x 에 서서 큰길을 사이에 두고 대칭이다 (처음엔 4칸 × 2줄이었다) */
      south: { origin: { x: -2, z: 5.25 } as Vec2, columns: 2, rows: 2, gap: 3.3, rowGap: 3.75 },
    },
  },
  /**
   * 동물 우리. 위쪽 밭 오른쪽 줄을 없앤 자리까지 왼쪽으로 넓혔다 (가로 8m → 12m).
   * 왼쪽 울타리(x 4.5)와 위쪽 밭(오른쪽 끝 x 2.5) 사이를 2m 띄웠다.
   */
  pen: { center: { x: 10.5, z: -4.5 } as Vec2, width: 12, depth: 6 },
  /** 마을을 가로지르는 큰길 (z 고정) */
  mainPathZ: 1.2,
  /** 시장 가는 표지판. 큰길이 오른쪽 끝까지 곧게 가고, 끝머리 위쪽(길 건너, 목장 쪽)에 선다 */
  townGate: { x: 17.6, z: -0.4 } as Vec2,
  /** 큰길 폭 (m) */
  mainPathWidth: 1.9,
} as const;

/** 마당 → 시장: 큰길 오른쪽 끝 */
export const YARD_TOWN_PORTAL = pathEndPortal(YARD.bounds.maxX, -1, YARD.mainPathZ, YARD.mainPathWidth);

export type FarmFieldKey = keyof typeof YARD.farm.fields;

/**
 * 밭 칸 번호 → (어느 밭, 몇째 칸, 몇째 줄). 칸 번호는 저장 데이터의 순서라 바꾸면 안 된다.
 *
 * 위쪽 밭 0 · 1 · 3 · 4번은 처음(3칸 × 2줄)부터 같은 번호다. 아래쪽 밭은 2 · 5 · 6 · 7번.
 * 아래쪽 밭이 4칸 × 2줄(12칸)이던 저장본은 saveData 의 migrate 가 남은 칸으로 옮겨 준다 (LEGACY_12_PLOTS).
 */
const PLOT_SLOTS: readonly (readonly [FarmFieldKey, number, number])[] = [
  ['north', 0, 0],
  ['north', 1, 0],
  ['south', 0, 0],
  ['north', 0, 1],
  ['north', 1, 1],
  ['south', 1, 0],
  ['south', 0, 1],
  ['south', 1, 1],
];

/** 마당 밭 칸 수 */
export const PLOT_COUNT = PLOT_SLOTS.length;

/** 밭 칸의 중심 좌표 */
export function plotPosition(index: number): Vec2 {
  const [key, column, row] = PLOT_SLOTS[index];
  const { origin, gap, rowGap } = YARD.farm.fields[key];
  return { x: origin.x + column * gap, z: origin.z + row * rowGap };
}

/** 밭 하나(칸 사이 길까지)가 차지하는 네모 */
export function farmFieldRect(key: FarmFieldKey): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const { origin, columns, rows, gap, rowGap } = YARD.farm.fields[key];
  const half = YARD.farm.plotSize / 2;
  return {
    minX: origin.x - half,
    maxX: origin.x + (columns - 1) * gap + half,
    minZ: origin.z - half,
    maxZ: origin.z + (rows - 1) * rowGap + half,
  };
}

/**
 * 시장. 왼쪽 끝 표지판으로 들어와 큰길을 따라 오른쪽으로 걷는다.
 * 가게 두 채는 길 뒤쪽(북쪽)에 서서 문이 카메라 쪽을 본다. 미니게임 자리는 아직 정하지 않았다.
 */
export const TOWN = {
  /** 걸어 다닐 수 있는 범위 */
  bounds: { minX: -15, maxX: 11, minZ: -7, maxZ: 6 },
  /** 큰길 (z 고정) */
  mainPathZ: 1.4,
  /** 마을로 돌아가는 표지판. 큰길 왼쪽 끝머리 위쪽에 선다 (마당의 시장 표지판과 같은 자리 잡기) */
  gate: { x: -13.6, z: -0.5 } as Vec2,
  spawn: { x: -11.5, z: 1.4 } as Vec2,
  /** 가게: 건물 중심, 문 앞(상호작용 자리), 바닥에서 차지하는 반 너비 · 반 깊이 (모델을 재서 맞춤) */
  seedShop: { position: { x: -4.5, z: -3.6 } as Vec2, door: { x: -4.5, z: -0.8 } as Vec2, half: { x: 2.1, z: 2.15 } },
  furnitureShop: { position: { x: 4.5, z: -3.6 } as Vec2, door: { x: 4.5, z: -1.3 } as Vec2, half: { x: 2.3, z: 1.6 } },
  /** 큰길 폭 (m) */
  mainPathWidth: 2.2,
} as const;

/** 시장 → 마을: 큰길 왼쪽 끝 */
export const TOWN_HOME_PORTAL = pathEndPortal(TOWN.bounds.minX, 1, TOWN.mainPathZ, TOWN.mainPathWidth);
