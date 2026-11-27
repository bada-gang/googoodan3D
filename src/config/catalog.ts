/**
 * 게임 콘텐츠 카탈로그. 가격/해금 레벨 등 밸런스 수치는 balance.ts 와 함께 조정한다.
 */
import { FISH, FISH_ORDER } from './fishing';
import type {
  AnimalSpeciesId,
  FishId,
  FurnitureId,
  PlacementArea,
  ProduceId,
  SellableId,
  SupplyId,
  TreeSpeciesId,
} from '@/types/game';

/* ---------------------------------- 나무 ---------------------------------- */

export interface TreeSpecies {
  id: TreeSpeciesId;
  name: string;
  seedName: string;
  seedPrice: number;
  fruitId: SellableId;
  fruitName: string;
  fruitPrice: number;
  /** 열매 맺을 때 한 번에 달리는 개수. HARVEST_BY_ATTEMPTS[0] 과 같아야 무실수 수확이 온전히 들어온다. */
  yield: number;
  unlockLevel: number;
  /**
   * 단계 하나를 올리는 데 필요한 정답 수 (처음 키울 때).
   * 지금은 모든 나무가 1: 물 한 번에 한 번 자란다 (2026-11 사용자 요청. 예전엔 비싼 나무일수록 2~3)
   */
  growthPerStage: number;
  /** 수확한 뒤 큰 나무에서 다시 열매가 열리기까지 줄 물 (정답 수). 지금은 모든 나무가 1 */
  regrowWater: number;
}

export const TREE_SPECIES: Record<TreeSpeciesId, TreeSpecies> = {
  apple: {
    id: 'apple',
    name: '사과나무',
    seedName: '사과 씨앗',
    seedPrice: 10,
    fruitId: 'apple',
    fruitName: '사과',
    fruitPrice: 6,
    yield: 4,
    unlockLevel: 1,
    growthPerStage: 1,
    regrowWater: 1,
  },
  orange: {
    id: 'orange',
    name: '오렌지나무',
    seedName: '오렌지 씨앗',
    seedPrice: 20,
    fruitId: 'orange',
    fruitName: '오렌지',
    fruitPrice: 11,
    yield: 4,
    unlockLevel: 2,
    growthPerStage: 1,
    regrowWater: 1,
  },
  peach: {
    id: 'peach',
    name: '복숭아나무',
    seedName: '복숭아 씨앗',
    seedPrice: 30,
    fruitId: 'peach',
    fruitName: '복숭아',
    // 열매 값은 "문제당 벌이"가 레벨 따라 고르게 오르도록 잡았다 (2026-11 성장 횟수를 모두 1로 바꾼 뒤로는 값만으로 차이가 난다)
    fruitPrice: 13,
    yield: 4,
    unlockLevel: 3,
    growthPerStage: 1,
    regrowWater: 1,
  },
  cherry: {
    id: 'cherry',
    name: '체리나무',
    seedName: '체리 씨앗',
    seedPrice: 40,
    fruitId: 'cherry',
    fruitName: '체리',
    fruitPrice: 15,
    yield: 4,
    unlockLevel: 4,
    growthPerStage: 1,
    regrowWater: 1,
  },
  grape: {
    id: 'grape',
    name: '포도나무',
    seedName: '포도 씨앗',
    seedPrice: 50,
    fruitId: 'grape',
    fruitName: '포도',
    fruitPrice: 27,
    yield: 4,
    unlockLevel: 5,
    growthPerStage: 1,
    regrowWater: 1,
  },
  persimmon: {
    id: 'persimmon',
    name: '감나무',
    seedName: '감 씨앗',
    seedPrice: 75,
    fruitId: 'persimmon',
    fruitName: '감',
    fruitPrice: 30,
    yield: 4,
    unlockLevel: 6,
    growthPerStage: 1,
    regrowWater: 1,
  },
  banana: {
    id: 'banana',
    name: '바나나나무',
    seedName: '바나나 씨앗',
    seedPrice: 90,
    fruitId: 'banana',
    fruitName: '바나나',
    fruitPrice: 34,
    yield: 4,
    unlockLevel: 7,
    growthPerStage: 1,
    regrowWater: 1,
  },
  blueberry: {
    id: 'blueberry',
    name: '블루베리나무',
    seedName: '블루베리 씨앗',
    seedPrice: 105,
    fruitId: 'blueberry',
    fruitName: '블루베리',
    fruitPrice: 40,
    yield: 4,
    unlockLevel: 8,
    growthPerStage: 1,
    regrowWater: 1,
  },
};

export const TREE_LIST = Object.values(TREE_SPECIES);

export function seedIdOf(species: TreeSpeciesId) {
  return `seed_${species}` as const;
}

export function speciesOfSeed(seedId: string): TreeSpeciesId | null {
  const raw = seedId.replace('seed_', '');
  return raw in TREE_SPECIES ? (raw as TreeSpeciesId) : null;
}

/* ---------------------------------- 동물 ---------------------------------- */

export interface AnimalSpecies {
  id: AnimalSpeciesId;
  name: string;
  price: number;
  produceId: ProduceId;
  produceName: string;
  producePrice: number;
  /** 생산물이 나오기까지 필요한 먹이 주기 횟수. 지금은 모든 동물이 1 (먹이 한 번 → 받기, 2026-11 사용자 요청) */
  careGoal: number;
  unlockLevel: number;
  /** 우리에 둘 수 있는 최대 마릿수 (목장 넓이 · 화면 혼잡을 보고 정함) */
  maxCount: number;
}

/**
 * 생산물 가격은 "같은 레벨(해금 레벨)의 가장 좋은 나무보다 문제당 벌이가 10~15% 높게" 잡았다 (2026-10-05).
 * 동물은 데려오는 값이 크고(112~468원) 종류마다 마릿수 제한이 있어서, 그만큼 조금 더 번다.
 * 2026-11 부터 모든 동물이 먹이 1번 + 받기 1번 = 2문제다 (나무도 물 한 번에 한 번 자란다).
 * 값은 그대로 두어서, 지금 문제당 벌이는 아래와 같다 (나무는 심기부터 10번 수확까지 24문제 기준).
 *
 *   문제당 벌이 = (생산물값 × 3 − 먹이값 2원 × 돌봄횟수) / (돌봄횟수 + 1)   (한 번에 맞히면 3개)
 *   닭 38 (Lv2 오렌지 17) · 염소 50 (Lv4 체리 22.8) · 양 66.5 (Lv6 감 46.3) · 젖소 92 (Lv8 블루베리 61.8)
 */
export const ANIMAL_SPECIES: Record<AnimalSpeciesId, AnimalSpecies> = {
  chicken: {
    id: 'chicken',
    name: '닭',
    price: 112,
    produceId: 'egg',
    produceName: '달걀',
    producePrice: 26,
    careGoal: 1,
    unlockLevel: 2,
    maxCount: 2,
  },
  goat: {
    id: 'goat',
    name: '염소',
    price: 168,
    produceId: 'goatMilk',
    produceName: '치즈',
    producePrice: 34,
    careGoal: 1,
    unlockLevel: 4,
    maxCount: 2,
  },
  sheep: {
    id: 'sheep',
    name: '양',
    price: 288,
    produceId: 'wool',
    produceName: '양털',
    producePrice: 45,
    careGoal: 1,
    unlockLevel: 6,
    maxCount: 2,
  },
  cow: {
    id: 'cow',
    name: '젖소',
    price: 468,
    produceId: 'milk',
    produceName: '우유',
    producePrice: 62,
    careGoal: 1,
    unlockLevel: 8,
    maxCount: 2,
  },
};

export const ANIMAL_LIST = Object.values(ANIMAL_SPECIES);

/* -------------------------------- 판매 가격 -------------------------------- */

export const SELL_PRICE: Record<SellableId, number> = {
  apple: TREE_SPECIES.apple.fruitPrice,
  orange: TREE_SPECIES.orange.fruitPrice,
  peach: TREE_SPECIES.peach.fruitPrice,
  cherry: TREE_SPECIES.cherry.fruitPrice,
  grape: TREE_SPECIES.grape.fruitPrice,
  persimmon: TREE_SPECIES.persimmon.fruitPrice,
  banana: TREE_SPECIES.banana.fruitPrice,
  blueberry: TREE_SPECIES.blueberry.fruitPrice,
  egg: ANIMAL_SPECIES.chicken.producePrice,
  goatMilk: ANIMAL_SPECIES.goat.producePrice,
  wool: ANIMAL_SPECIES.sheep.producePrice,
  milk: ANIMAL_SPECIES.cow.producePrice,
  ...fishRecord((fish) => FISH[fish].price),
};

export const SELLABLE_NAME: Record<SellableId, string> = {
  apple: '사과',
  orange: '오렌지',
  peach: '복숭아',
  cherry: '체리',
  grape: '포도',
  persimmon: '감',
  banana: '바나나',
  blueberry: '블루베리',
  egg: '달걀',
  goatMilk: '치즈',
  wool: '양털',
  milk: '우유',
  ...fishRecord((fish) => FISH[fish].name),
};

export const SELLABLE_ORDER: SellableId[] = [
  'apple',
  'orange',
  'peach',
  'cherry',
  'grape',
  'persimmon',
  'banana',
  'blueberry',
  'egg',
  'goatMilk',
  'wool',
  'milk',
  ...FISH_ORDER,
];

/** 물고기마다 값 하나씩 (SELL_PRICE · SELLABLE_NAME 에 물고기를 채운다) */
function fishRecord<T>(value: (fish: FishId) => T): Record<FishId, T> {
  return Object.fromEntries(FISH_ORDER.map((fish) => [fish, value(fish)])) as Record<FishId, T>;
}

/* -------------------------------- 물 · 먹이 -------------------------------- */

/**
 * 소모품. 나무에 물을 주거나 동물에게 먹이를 줄 때 하나씩 쓴다.
 * 가격은 한 묶음 기준이며, 한 번 사면 packSize 개가 들어온다.
 */
export interface SupplyDef {
  id: SupplyId;
  name: string;
  /** 한 묶음 이름. 예: "물 10개" */
  packName: string;
  packSize: number;
  price: number;
  /** 무엇에 쓰는지 설명 */
  usage: string;
}

export const SUPPLIES: Record<SupplyId, SupplyDef> = {
  water: {
    id: 'water',
    name: '물',
    packName: '물 10개',
    packSize: 10,
    price: 10,
    usage: '나무에 물을 줄 때 하나씩 써요',
  },
  feed: {
    id: 'feed',
    name: '먹이',
    packName: '먹이 10개',
    packSize: 10,
    price: 20,
    usage: '동물에게 먹이를 줄 때 하나씩 써요',
  },
};

export const SUPPLY_LIST = Object.values(SUPPLIES);

/* -------------------------------- 가구/장식 -------------------------------- */

/** 희귀도 대신 테마 컬렉션으로 묶는다. (명세 52) */
export type FurnitureTheme = 'basic' | 'cozy' | 'nature' | 'colorful' | 'starlight';

export const THEME_NAME: Record<FurnitureTheme, string> = {
  basic: '기본 세트',
  cozy: '포근한 방 세트',
  nature: '자연 숲 세트',
  colorful: '알록달록 세트',
  starlight: '별빛 세트',
};

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
  theme: FurnitureTheme;
  shape: FurnitureShape;
  area: PlacementArea;
  price: number;
  unlockLevel: number;
  width: number;
  height: number;
  /** 주 색상 (3D 모델 채색용) */
  tint: string;
}

export const FURNITURE: FurnitureDef[] = [
  // --- 기본 세트 (집) ---
  { id: 'bed_basic', name: '나무 침대', theme: 'basic', shape: 'bed', area: 'home', price: 60, unlockLevel: 1, width: 210, height: 120, tint: '#c08a52' },
  { id: 'desk_basic', name: '나무 책상', theme: 'basic', shape: 'desk', area: 'home', price: 45, unlockLevel: 1, width: 160, height: 112, tint: '#c08a52' },
  { id: 'chair_basic', name: '나무 의자', theme: 'basic', shape: 'chair', area: 'home', price: 25, unlockLevel: 1, width: 84, height: 116, tint: '#b57f4a' },
  { id: 'table_basic', name: '둥근 탁자', theme: 'basic', shape: 'table', area: 'home', price: 40, unlockLevel: 1, width: 150, height: 100, tint: '#c9955f' },
  { id: 'drawer_basic', name: '서랍장', theme: 'basic', shape: 'drawer', area: 'home', price: 55, unlockLevel: 1, width: 130, height: 130, tint: '#b8834f' },

  // --- 포근한 방 세트 ---
  { id: 'sofa_cozy', name: '포근한 소파', theme: 'cozy', shape: 'sofa', area: 'home', price: 95, unlockLevel: 2, width: 220, height: 128, tint: '#f0a6a0' },
  { id: 'cushion_cozy', name: '포근한 쿠션', theme: 'cozy', shape: 'cushion', area: 'home', price: 20, unlockLevel: 2, width: 84, height: 70, tint: '#f6c453' },
  { id: 'carpet_cozy', name: '포근한 카펫', theme: 'cozy', shape: 'carpet', area: 'home', price: 50, unlockLevel: 2, width: 240, height: 62, tint: '#e8998f' },
  { id: 'lamp_cozy', name: '포근한 조명', theme: 'cozy', shape: 'lamp', area: 'home', price: 65, unlockLevel: 3, width: 92, height: 190, tint: '#f6d78a' },

  // --- 자연 숲 세트 ---
  { id: 'bookshelf_nature', name: '숲 책장', theme: 'nature', shape: 'bookshelf', area: 'home', price: 110, unlockLevel: 3, width: 150, height: 210, tint: '#8aa86a' },
  { id: 'plant_nature', name: '큰 화분', theme: 'nature', shape: 'plant', area: 'home', price: 35, unlockLevel: 1, width: 96, height: 150, tint: '#6fbf6a' },
  { id: 'frame_nature', name: '숲 액자', theme: 'nature', shape: 'frame', area: 'home', price: 30, unlockLevel: 2, width: 104, height: 92, tint: '#a3714a' },

  // --- 알록달록 세트 ---
  { id: 'doll_colorful', name: '토끼 인형', theme: 'colorful', shape: 'doll', area: 'home', price: 40, unlockLevel: 2, width: 76, height: 100, tint: '#f6a8bd' },
  { id: 'clock_colorful', name: '알록달록 시계', theme: 'colorful', shape: 'clock', area: 'home', price: 45, unlockLevel: 3, width: 84, height: 84, tint: '#7fb8e6' },
  { id: 'carpet_colorful', name: '알록달록 카펫', theme: 'colorful', shape: 'carpet', area: 'home', price: 60, unlockLevel: 3, width: 240, height: 62, tint: '#8fd8c4' },

  // --- 별빛 세트 ---
  { id: 'bed_starlight', name: '별빛 침대', theme: 'starlight', shape: 'bed', area: 'home', price: 180, unlockLevel: 7, width: 215, height: 124, tint: '#b8a0e0' },
  { id: 'lamp_starlight', name: '별빛 조명', theme: 'starlight', shape: 'lamp', area: 'home', price: 130, unlockLevel: 7, width: 92, height: 190, tint: '#cbb6ef' },

  // --- 야외 ---
  { id: 'fence_wood', name: '나무 울타리', theme: 'basic', shape: 'fence', area: 'yard', price: 18, unlockLevel: 1, width: 130, height: 92, tint: '#c08a52' },
  { id: 'flower_bed', name: '꽃밭', theme: 'nature', shape: 'flower', area: 'yard', price: 22, unlockLevel: 1, width: 110, height: 76, tint: '#f6a8bd' },
  { id: 'flower_bed_long', name: '긴 꽃밭', theme: 'nature', shape: 'flower', area: 'yard', price: 35, unlockLevel: 1, width: 180, height: 60, tint: '#f6a8bd' },
  { id: 'bench_wood', name: '마당 벤치', theme: 'basic', shape: 'bench', area: 'yard', price: 55, unlockLevel: 2, width: 170, height: 104, tint: '#b57f4a' },
  { id: 'stonepath', name: '돌길', theme: 'nature', shape: 'stonepath', area: 'yard', price: 15, unlockLevel: 1, width: 140, height: 44, tint: '#cfc6b4' },
  { id: 'streetlamp', name: '가로등', theme: 'basic', shape: 'streetlamp', area: 'yard', price: 90, unlockLevel: 3, width: 80, height: 230, tint: '#6a5445' },
  { id: 'fountain', name: '작은 분수', theme: 'starlight', shape: 'fountain', area: 'yard', price: 220, unlockLevel: 7, width: 200, height: 150, tint: '#9ed4ea' },
];

export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(
  FURNITURE.map((f) => [f.id, f]),
);

/* ------------------------------- 벽지 / 바닥 ------------------------------- */

export interface SurfaceDef {
  id: string;
  name: string;
  price: number;
  unlockLevel: number;
  color: string;
  accent: string;
  /**
   * 색만 바꾸면 이름이 약속한 무늬가 안 보인다("체크 바닥"이 나무 무늬로 나온다).
   * 무늬가 있는 벽지·바닥은 타일 그림 자체를 따로 쓴다.
   */
  pattern?: 'star' | 'check' | 'carpet';
}

export const WALLPAPERS: SurfaceDef[] = [
  { id: 'wall_cream', name: '크림 벽지', price: 0, unlockLevel: 1, color: '#f7e6cd', accent: '#ecd7b6' },
  { id: 'wall_mint', name: '민트 벽지', price: 70, unlockLevel: 2, color: '#dff1e6', accent: '#c6e3d2' },
  { id: 'wall_sky', name: '하늘 벽지', price: 70, unlockLevel: 3, color: '#deeefb', accent: '#c4dff3' },
  { id: 'wall_star', name: '별빛 벽지', price: 150, unlockLevel: 7, color: '#e4dcf6', accent: '#cdc0ec', pattern: 'star' },
];

export const FLOORS: SurfaceDef[] = [
  { id: 'floor_wood', name: '나무 바닥', price: 0, unlockLevel: 1, color: '#d8a973', accent: '#c08a52' },
  { id: 'floor_tile', name: '체크 바닥', price: 70, unlockLevel: 2, color: '#f0e0c4', accent: '#dcc7a2', pattern: 'check' },
  { id: 'floor_carpet', name: '융단 바닥', price: 120, unlockLevel: 5, color: '#e6b3a6', accent: '#d0968a', pattern: 'carpet' },
];

export const SURFACE_BY_ID: Record<string, SurfaceDef> = Object.fromEntries(
  [...WALLPAPERS, ...FLOORS].map((s) => [s.id, s]),
);
