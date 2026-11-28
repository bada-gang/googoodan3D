/**
 * 가구 · 장식의 3D 크기와 놓는 방식.
 *
 * catalog.ts 의 width/height 는 2D 판 그림 크기(px)라 3D 에는 맞지 않는다
 * (카펫이 2D 에서는 앞에서 본 그림이라 높이 62px, 3D 에서는 바닥에 깔린 얇은 판).
 * 그래서 3D 크기는 여기서 m 단위로 따로 정한다. 캐릭터 키가 1.2m.
 *
 * 가구는 2학년이 고르고 놓기 쉽게 실제보다 약간 크게 잡는다 (ART_DIRECTION 10).
 */
import { FURNITURE } from './catalog';

/** 벽 장식(액자 · 시계)의 앞뒤 두께 상한 (m) */
export const WALL_ITEM_DEPTH = 0.08;

export interface Furniture3D {
  /** 모델 높이 (m). 납작한 것(카펫·돌길)은 대신 width 로 맞춘다 */
  height?: number;
  /** 모델 가로 폭 (m). 있으면 높이 대신 이것으로 크기를 맞춘다 */
  width?: number;
  /** 바닥에서 차지하는 둥근 자리 반지름 (m). 놓을 때 서로 겹치지 않게, 캐릭터가 부딪히게 */
  radius: number;
  /** 벽에 거는 물건 (액자 · 시계). 뒷벽에 붙는다 */
  wall?: boolean;
  /** 밤에 빛나는 등불 자리: 바닥에서 높이(m)와 빛 번짐 크기(m) */
  glow?: { y: number; size: number };
  /** 위로 걸어 다닐 수 있는 물건 (카펫 · 돌길 · 꽃밭) */
  walkable?: boolean;
  /** 모델 예산 (config/models MODEL_BUDGET). 없으면 medium. 태블릿 프레임을 위해 새 물건은 대부분 small */
  budget?: 'small' | 'medium';
  /** 가로(x)로만 늘리는 배율. 모델 크기는 그대로 두고 길이만 늘린다 (긴 꽃밭) */
  stretch?: number;
}

// 2026-11 태블릿 점검: 모양이 단순해 줄여도 티가 안 나는 예전 가구는 small (비교해서 고름).
// 책장 · 분수 · 액자 · 화분 · 토끼 인형 · 꽃밭은 줄이면 모양이 뭉개져 그대로 둔다
export const FURNITURE_3D: Record<string, Furniture3D> = {
  // --- 집 ---
  bed_basic: { height: 1.0, radius: 1.0, budget: 'small' },
  desk_basic: { height: 0.9, radius: 0.7, budget: 'small' },
  chair_basic: { height: 1.0, radius: 0.4, budget: 'small' },
  table_basic: { height: 0.75, radius: 0.65, budget: 'small' },
  drawer_basic: { height: 1.05, radius: 0.55, budget: 'small' },
  sofa_cozy: { height: 1.0, radius: 1.0, budget: 'small' },
  cushion_cozy: { height: 0.35, radius: 0.35, walkable: true, budget: 'small' },
  carpet_cozy: { width: 2.2, radius: 1.1, walkable: true },
  lamp_cozy: { height: 1.6, radius: 0.35, glow: { y: 1.38, size: 1.3 }, budget: 'small' },
  bookshelf_nature: { height: 1.8, radius: 0.7 },
  plant_nature: { height: 1.3, radius: 0.4 },
  frame_nature: { height: 0.8, radius: 0.5, wall: true },
  doll_colorful: { height: 0.7, radius: 0.35 },
  clock_colorful: { height: 0.7, radius: 0.4, wall: true, budget: 'small' },
  carpet_colorful: { width: 2.2, radius: 1.1, walkable: true },
  bed_starlight: { height: 1.05, radius: 1.0, budget: 'small' },
  lamp_starlight: { height: 1.6, radius: 0.35, glow: { y: 1.4, size: 1.2 } },
  // 2026-11 추가 (small 예산)
  beanbag: { height: 0.8, radius: 0.6, budget: 'small' },
  rocking_chair: { height: 1.1, radius: 0.55, budget: 'small' },
  toy_box: { height: 0.6, radius: 0.5, budget: 'small' },
  cactus_pot: { height: 0.9, radius: 0.3, budget: 'small' },
  big_bear: { height: 1.0, radius: 0.5, budget: 'small' },
  fish_tank: { height: 1.0, radius: 0.55, budget: 'small' },
  piano: { height: 1.2, radius: 0.8, budget: 'small' },
  chalkboard: { height: 0.9, radius: 0.7, wall: true, budget: 'small' },

  // --- 마당 ---
  fence_wood: { height: 0.9, radius: 0.7, budget: 'small' },
  flower_bed: { width: 1.2, radius: 0.6, walkable: true },
  // 가로로 긴 꽃밭. 모델은 2.2m 로 맞추고 가로로만 1.25배 늘린다 (2.75m, 사용자 요청).
  // 놓을 때 막는 범위는 원이라, 길이의 반쯤으로 잡는다
  flower_bed_long: { width: 2.2, stretch: 1.25, radius: 1.1, walkable: true },
  bench_wood: { height: 0.95, radius: 0.85, budget: 'small' },
  stonepath: { width: 1.3, radius: 0.65, walkable: true },
  streetlamp: { height: 2.4, radius: 0.3, glow: { y: 2.08, size: 1.8 } },
  fountain: { height: 1.4, radius: 1.0 },
  // 2026-11 추가: 놀이터 (정글짐 · 그네는 코드로 만든다 — 모델 없음) · 정원 · 쉼터
  // 정사각형 2.4m × 2.4m (높이 대신 가로로 맞춘다)
  sandbox: { width: 2.4, radius: 1.5, budget: 'small' },
  seesaw: { height: 0.8, radius: 1.5, budget: 'small' },
  swing: { height: 2.2, radius: 1.3 },
  slide: { height: 2.0, radius: 1.4 },
  jungle_gym: { height: 1.5, radius: 1.4 },
  merry_go_round: { height: 1.2, radius: 1.3 },
  birdhouse: { height: 1.6, radius: 0.35, budget: 'small' },
  scarecrow: { height: 1.8, radius: 0.5, budget: 'small' },
  mailbox: { height: 1.2, radius: 0.35, budget: 'small' },
  tent: { height: 1.6, radius: 1.2, budget: 'small' },
};

// catalog 에 가구를 추가하고 여기를 빠뜨리면 바로 알 수 있게 한다
for (const item of FURNITURE) {
  if (!FURNITURE_3D[item.id]) throw new Error(`furniture3d.ts 에 ${item.id} 의 3D 크기가 없다`);
}
