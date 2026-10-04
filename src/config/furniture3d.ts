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
}

export const FURNITURE_3D: Record<string, Furniture3D> = {
  // --- 집 ---
  bed_basic: { height: 1.0, radius: 1.0 },
  desk_basic: { height: 0.9, radius: 0.7 },
  chair_basic: { height: 1.0, radius: 0.4 },
  table_basic: { height: 0.75, radius: 0.65 },
  drawer_basic: { height: 1.05, radius: 0.55 },
  sofa_cozy: { height: 1.0, radius: 1.0 },
  cushion_cozy: { height: 0.35, radius: 0.35, walkable: true },
  carpet_cozy: { width: 2.2, radius: 1.1, walkable: true },
  lamp_cozy: { height: 1.6, radius: 0.35, glow: { y: 1.38, size: 1.3 } },
  bookshelf_nature: { height: 1.8, radius: 0.7 },
  plant_nature: { height: 1.3, radius: 0.4 },
  frame_nature: { height: 0.8, radius: 0.5, wall: true },
  doll_colorful: { height: 0.7, radius: 0.35 },
  clock_colorful: { height: 0.7, radius: 0.4, wall: true },
  carpet_colorful: { width: 2.2, radius: 1.1, walkable: true },
  bed_starlight: { height: 1.05, radius: 1.0 },
  lamp_starlight: { height: 1.6, radius: 0.35, glow: { y: 1.4, size: 1.2 } },

  // --- 마당 ---
  fence_wood: { height: 0.9, radius: 0.7 },
  flower_bed: { width: 1.2, radius: 0.6, walkable: true },
  bench_wood: { height: 0.95, radius: 0.85 },
  stonepath: { width: 1.3, radius: 0.65, walkable: true },
  streetlamp: { height: 2.4, radius: 0.3, glow: { y: 2.08, size: 1.8 } },
  fountain: { height: 1.4, radius: 1.0 },
};

// catalog 에 가구를 추가하고 여기를 빠뜨리면 바로 알 수 있게 한다
for (const item of FURNITURE) {
  if (!FURNITURE_3D[item.id]) throw new Error(`furniture3d.ts 에 ${item.id} 의 3D 크기가 없다`);
}
