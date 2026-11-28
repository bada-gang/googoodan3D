/**
 * 꾸미기 물건 목록: 가구 · 마당 장식(FURNITURE)과 벽지 · 바닥재(WALLPAPERS · FLOORS).
 * catalog.ts 가 그대로 다시 내보낸다 (예전처럼 '@/config/catalog' 에서 가져와도 된다).
 *
 * 2026-11 사용자 요청으로:
 *  - 레벨 해금 없음 — 모든 꾸미기 물건은 레벨 1부터 살 수 있다 (씨앗 · 가축은 해금 그대로, catalog.ts)
 *  - 세트(테마) 대신 종류(category)로 묶는다. 가게 칸은 집 안(가구 + 벽지 · 바닥재) · 마당 · 잡화
 *  - 값을 크게 올렸다 (농사 · 가축으로 수업 한 번에 3,000원 안팎을 번다):
 *      작은 소품 300~800 · 가구 1,000~3,000 · 벽지 · 바닥재 1,000~3,000 · 마당 장식 200~4,000 · 놀이터 5,000~15,000
 * 3D 크기는 furniture3d.ts, 모델은 models.ts (furnitureModelKey).
 */
import type { FurnitureId, PlacementArea } from '@/types/game';

/** 가게 · 꾸미기 목록에서 묶는 종류. 이 순서대로 보인다 */
export type FurnitureCategory =
  // 집 안
  | 'rest'
  | 'study'
  | 'storage'
  | 'light'
  | 'deco'
  | 'wall'
  | 'rug'
  // 마당
  | 'play'
  | 'garden'
  | 'yardRest'
  | 'fence'
  | 'water';

export const CATEGORY_NAME: Record<FurnitureCategory, string> = {
  rest: '침대 · 소파',
  study: '책상 · 의자 · 탁자',
  storage: '수납',
  light: '조명',
  deco: '소품',
  wall: '벽 장식',
  rug: '카펫',
  play: '놀이터',
  garden: '꽃 · 정원',
  yardRest: '벤치 · 조명',
  fence: '울타리 · 길',
  water: '물',
};

export const CATEGORY_ORDER: FurnitureCategory[] = [
  'rest',
  'study',
  'storage',
  'light',
  'deco',
  'wall',
  'rug',
  'play',
  'garden',
  'yardRest',
  'fence',
  'water',
];

/** 3D 모델을 어떤 형태로 만들지 정하는 키 */
export type FurnitureShape =
  | 'bed'
  | 'desk'
  | 'chair'
  | 'sofa'
  | 'bookshelf'
  | 'table'
  | 'lamp'
  | 'drawer'
  | 'plant'
  | 'frame'
  | 'doll'
  | 'clock'
  | 'carpet'
  | 'cushion'
  | 'fence'
  | 'bench'
  | 'flower'
  | 'streetlamp'
  | 'stonepath'
  | 'fountain';

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  category: FurnitureCategory;
  shape: FurnitureShape;
  area: PlacementArea;
  price: number;
  width: number;
  height: number;
  /** 주 색상 (3D 모델 채색용) */
  tint: string;
}

export const FURNITURE: FurnitureDef[] = [
  /* ---- 집 안 ---- */
  { id: 'bed_basic', name: '나무 침대', category: 'rest', shape: 'bed', area: 'home', price: 1500, width: 210, height: 120, tint: '#c08a52' },
  { id: 'bed_starlight', name: '별빛 침대', category: 'rest', shape: 'bed', area: 'home', price: 3000, width: 215, height: 124, tint: '#b8a0e0' },
  { id: 'sofa_cozy', name: '포근한 소파', category: 'rest', shape: 'sofa', area: 'home', price: 2200, width: 220, height: 128, tint: '#f0a6a0' },

  { id: 'desk_basic', name: '나무 책상', category: 'study', shape: 'desk', area: 'home', price: 1200, width: 160, height: 112, tint: '#c08a52' },
  { id: 'chair_basic', name: '나무 의자', category: 'study', shape: 'chair', area: 'home', price: 600, width: 84, height: 116, tint: '#b57f4a' },
  { id: 'table_basic', name: '둥근 탁자', category: 'study', shape: 'table', area: 'home', price: 1000, width: 150, height: 100, tint: '#c9955f' },

  { id: 'drawer_basic', name: '서랍장', category: 'storage', shape: 'drawer', area: 'home', price: 1300, width: 130, height: 130, tint: '#b8834f' },
  { id: 'bookshelf_nature', name: '숲 책장', category: 'storage', shape: 'bookshelf', area: 'home', price: 2000, width: 150, height: 210, tint: '#8aa86a' },

  { id: 'lamp_cozy', name: '포근한 조명', category: 'light', shape: 'lamp', area: 'home', price: 1000, width: 92, height: 190, tint: '#f6d78a' },
  { id: 'lamp_starlight', name: '별빛 조명', category: 'light', shape: 'lamp', area: 'home', price: 1800, width: 92, height: 190, tint: '#cbb6ef' },

  { id: 'plant_nature', name: '큰 화분', category: 'deco', shape: 'plant', area: 'home', price: 500, width: 96, height: 150, tint: '#6fbf6a' },
  { id: 'cushion_cozy', name: '포근한 쿠션', category: 'deco', shape: 'cushion', area: 'home', price: 400, width: 84, height: 70, tint: '#f6c453' },
  { id: 'doll_colorful', name: '토끼 인형', category: 'deco', shape: 'doll', area: 'home', price: 700, width: 76, height: 100, tint: '#f6a8bd' },

  { id: 'frame_nature', name: '숲 액자', category: 'wall', shape: 'frame', area: 'home', price: 500, width: 104, height: 92, tint: '#a3714a' },
  { id: 'clock_colorful', name: '알록달록 시계', category: 'wall', shape: 'clock', area: 'home', price: 600, width: 84, height: 84, tint: '#7fb8e6' },

  { id: 'carpet_cozy', name: '포근한 카펫', category: 'rug', shape: 'carpet', area: 'home', price: 900, width: 240, height: 62, tint: '#e8998f' },
  { id: 'carpet_colorful', name: '알록달록 카펫', category: 'rug', shape: 'carpet', area: 'home', price: 1000, width: 240, height: 62, tint: '#8fd8c4' },

  /* ---- 마당 ---- */
  { id: 'flower_bed', name: '꽃밭', category: 'garden', shape: 'flower', area: 'yard', price: 300, width: 110, height: 76, tint: '#f6a8bd' },
  { id: 'flower_bed_long', name: '긴 꽃밭', category: 'garden', shape: 'flower', area: 'yard', price: 500, width: 180, height: 60, tint: '#f6a8bd' },

  { id: 'bench_wood', name: '마당 벤치', category: 'yardRest', shape: 'bench', area: 'yard', price: 1200, width: 170, height: 104, tint: '#b57f4a' },
  { id: 'streetlamp', name: '가로등', category: 'yardRest', shape: 'streetlamp', area: 'yard', price: 1500, width: 80, height: 230, tint: '#6a5445' },

  { id: 'fence_wood', name: '나무 울타리', category: 'fence', shape: 'fence', area: 'yard', price: 200, width: 130, height: 92, tint: '#c08a52' },
  { id: 'stonepath', name: '돌길', category: 'fence', shape: 'stonepath', area: 'yard', price: 200, width: 140, height: 44, tint: '#cfc6b4' },

  { id: 'fountain', name: '작은 분수', category: 'water', shape: 'fountain', area: 'yard', price: 4000, width: 200, height: 150, tint: '#9ed4ea' },
];

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

/** 이 칸(집 안 · 마당)의 물건을 종류별로 묶는다 (CATEGORY_ORDER 순서, 빈 종류는 빼고) */
export function furnitureByCategory(area: PlacementArea): { category: FurnitureCategory; items: FurnitureDef[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: FURNITURE.filter((f) => f.area === area && f.category === category),
  })).filter((group) => group.items.length > 0);
}

/* ------------------------------- 벽지 / 바닥재 ------------------------------- */

export interface SurfaceDef {
  id: string;
  name: string;
  price: number;
  color: string;
  accent: string;
  /**
   * 색만 바꾸면 이름이 약속한 무늬가 안 보인다("체크 바닥"이 나무 무늬로 나온다).
   * 무늬가 있는 벽지·바닥은 타일 그림 자체를 따로 쓴다.
   */
  pattern?: 'star' | 'check' | 'carpet';
}

export const WALLPAPERS: SurfaceDef[] = [
  { id: 'wall_cream', name: '크림 벽지', price: 0, color: '#f7e6cd', accent: '#ecd7b6' },
  { id: 'wall_mint', name: '민트 벽지', price: 1000, color: '#dff1e6', accent: '#c6e3d2' },
  { id: 'wall_sky', name: '하늘 벽지', price: 1000, color: '#deeefb', accent: '#c4dff3' },
  { id: 'wall_star', name: '별빛 벽지', price: 2500, color: '#e4dcf6', accent: '#cdc0ec', pattern: 'star' },
];

export const FLOORS: SurfaceDef[] = [
  { id: 'floor_wood', name: '나무 바닥', price: 0, color: '#d8a973', accent: '#c08a52' },
  { id: 'floor_tile', name: '체크 바닥', price: 1200, color: '#f0e0c4', accent: '#dcc7a2', pattern: 'check' },
  { id: 'floor_carpet', name: '융단 바닥', price: 2000, color: '#e6b3a6', accent: '#d0968a', pattern: 'carpet' },
];

export const SURFACE_BY_ID: Record<string, SurfaceDef> = Object.fromEntries([...WALLPAPERS, ...FLOORS].map((s) => [s.id, s]));
