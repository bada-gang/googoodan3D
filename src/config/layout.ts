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

/** 마당 밭 칸 수 */
export const PLOT_COUNT = 6;

export const YARD = {
  /** 걸어 다닐 수 있는 범위 */
  bounds: { minX: -15, maxX: 19, minZ: -11, maxZ: 8 },
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
    /** 3칸씩 2줄. 옆 칸 사이 0.9m 길, 위아래 줄 사이 1.35m 길 (위쪽 줄을 조금 더 띄웠다) */
    origin: { x: -2, z: -5.95 } as Vec2,
    gap: 3.3,
    rowGap: 3.75,
    columns: 3,
  },
  /** 동물 우리 (3단계에서 동물이 들어온다) */
  pen: { center: { x: 12.5, z: -4.5 } as Vec2, width: 8, depth: 6 },
  /** 마을을 가로지르는 큰길 (z 고정) */
  mainPathZ: 1.2,
  /** 시장 가는 표지판 */
  townGate: { x: 17.5, z: 3.6 } as Vec2,
} as const;

/** 밭 칸의 중심 좌표 */
export function plotPosition(index: number): Vec2 {
  const { origin, gap, rowGap, columns } = YARD.farm;
  return { x: origin.x + (index % columns) * gap, z: origin.z + Math.floor(index / columns) * rowGap };
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
  /** 마을로 돌아가는 표지판. 마당에서 오면 이 옆에 선다 */
  gate: { x: -13, z: 3.2 } as Vec2,
  spawn: { x: -11.5, z: 1.4 } as Vec2,
  /** 가게: 건물 중심, 문 앞(상호작용 자리), 바닥에서 차지하는 반 너비 · 반 깊이 (모델을 재서 맞춤) */
  seedShop: { position: { x: -4.5, z: -3.6 } as Vec2, door: { x: -4.5, z: -0.8 } as Vec2, half: { x: 2.1, z: 2.15 } },
  furnitureShop: { position: { x: 4.5, z: -3.6 } as Vec2, door: { x: 4.5, z: -1.3 } as Vec2, half: { x: 2.3, z: 1.6 } },
} as const;
