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
  yardRest: '쉼터 · 조명',
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
  | 'fountain'
  // 2026-11 추가
  | 'beanbag'
  | 'rockingChair'
  | 'piano'
  | 'fishTank'
  | 'bear'
  | 'toyBox'
  | 'cactus'
  | 'chalkboard'
  | 'slide'
  | 'seesaw'
  | 'jungleGym'
  | 'swing'
  | 'sandbox'
  | 'merryGoRound'
  | 'scarecrow'
  | 'birdhouse'
  | 'mailbox'
  | 'tent';

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
  /**
   * 3D 모델 대신 코드로 만든다 (정글짐 · 그네: 가는 막대가 많아 3D 변환에서 부러진다).
   * 가게 그림은 따로 그린다 (icon). 모양은 world/props/CodeFurniture.tsx
   */
  codeBuilt?: boolean;
}

export const FURNITURE: FurnitureDef[] = [
  /* ---- 집 안 ---- */
  { id: 'bed_basic', name: '나무 침대', category: 'rest', shape: 'bed', area: 'home', price: 1500, width: 210, height: 120, tint: '#c08a52' },
  { id: 'bed_starlight', name: '별빛 침대', category: 'rest', shape: 'bed', area: 'home', price: 3000, width: 215, height: 124, tint: '#b8a0e0' },
  { id: 'sofa_cozy', name: '포근한 소파', category: 'rest', shape: 'sofa', area: 'home', price: 2200, width: 220, height: 128, tint: '#f0a6a0' },
  { id: 'beanbag', name: '빈백', category: 'rest', shape: 'beanbag', area: 'home', price: 1800, width: 120, height: 90, tint: '#f6c453' },
  { id: 'rocking_chair', name: '흔들의자', category: 'rest', shape: 'rockingChair', area: 'home', price: 1500, width: 110, height: 120, tint: '#b57f4a' },

  { id: 'desk_basic', name: '나무 책상', category: 'study', shape: 'desk', area: 'home', price: 1200, width: 160, height: 112, tint: '#c08a52' },
  { id: 'chair_basic', name: '나무 의자', category: 'study', shape: 'chair', area: 'home', price: 600, width: 84, height: 116, tint: '#b57f4a' },
  { id: 'table_basic', name: '둥근 탁자', category: 'study', shape: 'table', area: 'home', price: 1000, width: 150, height: 100, tint: '#c9955f' },

  { id: 'drawer_basic', name: '서랍장', category: 'storage', shape: 'drawer', area: 'home', price: 1300, width: 130, height: 130, tint: '#b8834f' },
  { id: 'bookshelf_nature', name: '숲 책장', category: 'storage', shape: 'bookshelf', area: 'home', price: 2000, width: 150, height: 210, tint: '#8aa86a' },
  { id: 'toy_box', name: '장난감 상자', category: 'storage', shape: 'toyBox', area: 'home', price: 1100, width: 120, height: 80, tint: '#7fb8e6' },

  { id: 'lamp_cozy', name: '포근한 조명', category: 'light', shape: 'lamp', area: 'home', price: 1000, width: 92, height: 190, tint: '#f6d78a' },
  { id: 'lamp_starlight', name: '별빛 조명', category: 'light', shape: 'lamp', area: 'home', price: 1800, width: 92, height: 190, tint: '#cbb6ef' },

  { id: 'plant_nature', name: '큰 화분', category: 'deco', shape: 'plant', area: 'home', price: 500, width: 96, height: 150, tint: '#6fbf6a' },
  { id: 'cushion_cozy', name: '포근한 쿠션', category: 'deco', shape: 'cushion', area: 'home', price: 400, width: 84, height: 70, tint: '#f6c453' },
  { id: 'doll_colorful', name: '토끼 인형', category: 'deco', shape: 'doll', area: 'home', price: 700, width: 76, height: 100, tint: '#f6a8bd' },
  { id: 'cactus_pot', name: '선인장 화분', category: 'deco', shape: 'cactus', area: 'home', price: 400, width: 70, height: 100, tint: '#7cbf6a' },
  { id: 'big_bear', name: '큰 곰 인형', category: 'deco', shape: 'bear', area: 'home', price: 1000, width: 100, height: 110, tint: '#c99a6a' },
  { id: 'fish_tank', name: '어항', category: 'deco', shape: 'fishTank', area: 'home', price: 1200, width: 110, height: 110, tint: '#8fd3e8' },
  { id: 'piano', name: '작은 피아노', category: 'deco', shape: 'piano', area: 'home', price: 3000, width: 150, height: 130, tint: '#5a4a6a' },

  { id: 'frame_nature', name: '숲 액자', category: 'wall', shape: 'frame', area: 'home', price: 500, width: 104, height: 92, tint: '#a3714a' },
  { id: 'clock_colorful', name: '알록달록 시계', category: 'wall', shape: 'clock', area: 'home', price: 600, width: 84, height: 84, tint: '#7fb8e6' },
  { id: 'chalkboard', name: '칠판', category: 'wall', shape: 'chalkboard', area: 'home', price: 800, width: 130, height: 96, tint: '#3f6b55' },

  { id: 'carpet_cozy', name: '포근한 카펫', category: 'rug', shape: 'carpet', area: 'home', price: 900, width: 240, height: 62, tint: '#e8998f' },
  { id: 'carpet_colorful', name: '알록달록 카펫', category: 'rug', shape: 'carpet', area: 'home', price: 1000, width: 240, height: 62, tint: '#8fd8c4' },

  /* ---- 마당 ---- */
  // 놀이터: 큰 기구 (정글짐 · 그네는 코드로 만든다)
  { id: 'sandbox', name: '모래 놀이터', category: 'play', shape: 'sandbox', area: 'yard', price: 5000, width: 210, height: 70, tint: '#e9cf8f' },
  { id: 'seesaw', name: '시소', category: 'play', shape: 'seesaw', area: 'yard', price: 6000, width: 260, height: 90, tint: '#f6d24a' },
  { id: 'swing', name: '그네', category: 'play', shape: 'swing', area: 'yard', price: 8000, width: 230, height: 220, tint: '#7fb8e6', codeBuilt: true },
  { id: 'slide', name: '미끄럼틀', category: 'play', shape: 'slide', area: 'yard', price: 9000, width: 220, height: 200, tint: '#8fc8ea' },
  { id: 'jungle_gym', name: '정글짐', category: 'play', shape: 'jungleGym', area: 'yard', price: 10000, width: 200, height: 190, tint: '#e8524a', codeBuilt: true },
  { id: 'merry_go_round', name: '회전 놀이기구', category: 'play', shape: 'merryGoRound', area: 'yard', price: 12000, width: 230, height: 130, tint: '#8fd8c4' },

  { id: 'flower_bed', name: '꽃밭', category: 'garden', shape: 'flower', area: 'yard', price: 300, width: 110, height: 76, tint: '#f6a8bd' },
  { id: 'flower_bed_long', name: '긴 꽃밭', category: 'garden', shape: 'flower', area: 'yard', price: 500, width: 180, height: 60, tint: '#f6a8bd' },
  { id: 'birdhouse', name: '새집', category: 'garden', shape: 'birdhouse', area: 'yard', price: 900, width: 70, height: 160, tint: '#f2a65a' },
  { id: 'scarecrow', name: '허수아비', category: 'garden', shape: 'scarecrow', area: 'yard', price: 1200, width: 110, height: 180, tint: '#e3bf68' },

  { id: 'bench_wood', name: '마당 벤치', category: 'yardRest', shape: 'bench', area: 'yard', price: 1200, width: 170, height: 104, tint: '#b57f4a' },
  { id: 'streetlamp', name: '가로등', category: 'yardRest', shape: 'streetlamp', area: 'yard', price: 1500, width: 80, height: 230, tint: '#6a5445' },
  { id: 'mailbox', name: '나무 우체통', category: 'yardRest', shape: 'mailbox', area: 'yard', price: 1000, width: 70, height: 120, tint: '#d65f4f' },
  { id: 'tent', name: '텐트', category: 'yardRest', shape: 'tent', area: 'yard', price: 3500, width: 210, height: 160, tint: '#8fd8c4' },

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
  pattern?: SurfacePattern;
}

/** 무늬 질감 이름 (config/assets 의 surfaceTextureKey 가 질감 키로 바꾼다) */
export type SurfacePattern = 'star' | 'check' | 'carpet' | 'cloud' | 'stripe' | 'heart' | 'leaf' | 'strawberry' | 'marble' | 'grass';

export const WALLPAPERS: SurfaceDef[] = [
  { id: 'wall_cream', name: '크림 벽지', price: 0, color: '#f7e6cd', accent: '#ecd7b6' },
  { id: 'wall_mint', name: '민트 벽지', price: 1000, color: '#dff1e6', accent: '#c6e3d2' },
  { id: 'wall_sky', name: '하늘 벽지', price: 1000, color: '#deeefb', accent: '#c4dff3' },
  { id: 'wall_star', name: '별빛 벽지', price: 2500, color: '#e4dcf6', accent: '#cdc0ec', pattern: 'star' },
  // 2026-11 추가. 무늬 질감에 색이 그려져 있어 color 는 흰색(그대로)
  { id: 'wall_stripe', name: '줄무늬 벽지', price: 1200, color: '#ffffff', accent: '#f3c9c4', pattern: 'stripe' },
  { id: 'wall_cloud', name: '구름 벽지', price: 1500, color: '#ffffff', accent: '#c4dff3', pattern: 'cloud' },
  { id: 'wall_heart', name: '하트 벽지', price: 1500, color: '#ffffff', accent: '#f6b8c8', pattern: 'heart' },
  { id: 'wall_leaf', name: '나뭇잎 벽지', price: 1500, color: '#ffffff', accent: '#b9dcb0', pattern: 'leaf' },
  { id: 'wall_strawberry', name: '딸기 벽지', price: 1800, color: '#ffffff', accent: '#f6b0b0', pattern: 'strawberry' },
];

export const FLOORS: SurfaceDef[] = [
  { id: 'floor_wood', name: '나무 바닥', price: 0, color: '#d8a973', accent: '#c08a52' },
  { id: 'floor_tile', name: '체크 바닥', price: 1200, color: '#f0e0c4', accent: '#dcc7a2', pattern: 'check' },
  { id: 'floor_carpet', name: '융단 바닥', price: 2000, color: '#e6b3a6', accent: '#d0968a', pattern: 'carpet' },
  // 2026-11 추가. 하늘 체크 · 별빛은 있는 무늬에 색만 바꾸고, 잔디는 마당 잔디 질감, 대리석만 새 질감
  { id: 'floor_sky_check', name: '하늘 체크 바닥', price: 1200, color: '#cfe6fa', accent: '#a9cdee', pattern: 'check' },
  { id: 'floor_grass', name: '잔디 카펫', price: 1800, color: '#ffffff', accent: '#a8d66f', pattern: 'grass' },
  { id: 'floor_marble', name: '대리석 바닥', price: 2500, color: '#ffffff', accent: '#dcdcdc', pattern: 'marble' },
  { id: 'floor_star', name: '별빛 바닥', price: 2500, color: '#c9bbea', accent: '#a996d8', pattern: 'star' },
];

export const SURFACE_BY_ID: Record<string, SurfaceDef> = Object.fromEntries([...WALLPAPERS, ...FLOORS].map((s) => [s.id, s]));
