/**
 * 게임 콘텐츠 카탈로그 (나무 · 동물 · 판매 값 · 물과 먹이). 가격/해금 레벨 등 밸런스 수치는 balance.ts 와 함께 조정한다.
 * 가구 · 마당 장식 · 벽지 · 바닥재는 decor.ts (여기서 다시 내보낸다).
 */
import { FISH, FISH_ORDER } from './fishing';
import type {
  AnimalSpeciesId,
  FishId,
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
    seedPrice: 20,
    fruitId: 'apple',
    fruitName: '사과',
    fruitPrice: 11,
    yield: 4,
    unlockLevel: 1,
    growthPerStage: 1,
    regrowWater: 1,
  },
  orange: {
    id: 'orange',
    name: '오렌지나무',
    seedName: '오렌지 씨앗',
    seedPrice: 40,
    fruitId: 'orange',
    fruitName: '오렌지',
    fruitPrice: 16,
    yield: 4,
    unlockLevel: 2,
    growthPerStage: 1,
    regrowWater: 1,
  },
  peach: {
    id: 'peach',
    name: '복숭아나무',
    seedName: '복숭아 씨앗',
    seedPrice: 60,
    fruitId: 'peach',
    fruitName: '복숭아',
    // 열매 값은 "문제당 벌이"가 레벨 따라 고르게 오르도록 잡았다 (2026-11 성장 횟수를 모두 1로 바꾼 뒤로는 값만으로 차이가 난다)
    fruitPrice: 19,
    yield: 4,
    unlockLevel: 3,
    growthPerStage: 1,
    regrowWater: 1,
  },
  cherry: {
    id: 'cherry',
    name: '체리나무',
    seedName: '체리 씨앗',
    seedPrice: 80,
    fruitId: 'cherry',
    fruitName: '체리',
    fruitPrice: 22,
    yield: 4,
    unlockLevel: 4,
    growthPerStage: 1,
    regrowWater: 1,
  },
  grape: {
    id: 'grape',
    name: '포도나무',
    seedName: '포도 씨앗',
    seedPrice: 100,
    fruitId: 'grape',
    fruitName: '포도',
    fruitPrice: 29,
    yield: 4,
    unlockLevel: 5,
    growthPerStage: 1,
    regrowWater: 1,
  },
  persimmon: {
    id: 'persimmon',
    name: '감나무',
    seedName: '감 씨앗',
    seedPrice: 150,
    fruitId: 'persimmon',
    fruitName: '감',
    fruitPrice: 33,
    yield: 4,
    unlockLevel: 6,
    growthPerStage: 1,
    regrowWater: 1,
  },
  banana: {
    id: 'banana',
    name: '바나나나무',
    seedName: '바나나 씨앗',
    seedPrice: 180,
    fruitId: 'banana',
    fruitName: '바나나',
    fruitPrice: 37,
    yield: 4,
    unlockLevel: 7,
    growthPerStage: 1,
    regrowWater: 1,
  },
  blueberry: {
    id: 'blueberry',
    name: '블루베리나무',
    seedName: '블루베리 씨앗',
    seedPrice: 210,
    fruitId: 'blueberry',
    fruitName: '블루베리',
    fruitPrice: 42,
    yield: 4,
    unlockLevel: 8,
    growthPerStage: 1,
    regrowWater: 1,
  },
  // 2026-11 추가. 문제당 벌이 귤 약 68 · 키위 약 75 (씨앗 값 2배 반영, 레벨 따라 고르게 오르게)
  tangerine: {
    id: 'tangerine',
    name: '귤나무',
    seedName: '귤 씨앗',
    seedPrice: 240,
    fruitId: 'tangerine',
    fruitName: '귤',
    fruitPrice: 47,
    yield: 4,
    unlockLevel: 9,
    growthPerStage: 1,
    regrowWater: 1,
  },
  kiwi: {
    id: 'kiwi',
    name: '키위나무',
    seedName: '키위 씨앗',
    seedPrice: 280,
    fruitId: 'kiwi',
    fruitName: '키위',
    fruitPrice: 52,
    yield: 4,
    unlockLevel: 10,
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
  /** 돌보기 버튼 · 문제 문구를 바꿀 때 (꿀벌: '아카시아꽃 주기'). 없으면 '○○ 먹이 주기' */
  careLabel?: string;
  careQuestion?: string;
  /** 돌봤을 때 떠오르는 글자. 없으면 '냠냠' */
  careText?: string;
  /** 세는 단위 · 사는 곳 (가게 문구). 없으면 '마리' · '우리' */
  countUnit?: string;
  homeName?: string;
}

/**
 * 생산물 가격은 "같은 레벨(해금 레벨)의 가장 좋은 나무보다 문제당 벌이가 10~15% 높게" 잡았다 (2026-10-05).
 * 동물은 데려오는 값이 크다 (500~2,300원: 본전까지 생산물을 6~10번 받아야 한다 — 3번 받으면 쉬므로 휴식 2~3번, 2026-11 사용자 요청). 종류마다 마릿수 제한도 있어서, 그만큼 조금 더 번다.
 * 2026-11 부터 모든 동물이 먹이 1번 + 받기 1번 = 2문제다 (나무도 물 한 번에 한 번 자란다).
 * 값은 그 뒤 다시 올렸고, 지금 문제당 벌이는 아래와 같다 (나무는 심기부터 10번 수확까지 24문제 기준).
 *
 *   문제당 벌이 = (생산물값 × 3 − 먹이값 2원 × 돌봄횟수) / (돌봄횟수 + 1)   (한 번에 맞히면 3개)
 *   닭 44 (Lv2 오렌지 25) · 염소 59 (Lv4 체리 35) · 양 77 (Lv6 감 51) · 젖소 107 (Lv8 블루베리 65). 낚시는 약 9 (2026-11 사용자: 농사 · 가축이 낚시보다 확실히 매력 있게)
 */
export const ANIMAL_SPECIES: Record<AnimalSpeciesId, AnimalSpecies> = {
  chicken: {
    id: 'chicken',
    name: '닭',
    price: 500,
    produceId: 'egg',
    produceName: '달걀',
    producePrice: 30,
    careGoal: 1,
    unlockLevel: 2,
    maxCount: 2,
  },
  goat: {
    id: 'goat',
    name: '염소',
    price: 820,
    produceId: 'goatMilk',
    produceName: '치즈',
    producePrice: 40,
    careGoal: 1,
    unlockLevel: 4,
    maxCount: 2,
  },
  sheep: {
    id: 'sheep',
    name: '양',
    price: 1150,
    produceId: 'wool',
    produceName: '양털',
    producePrice: 52,
    careGoal: 1,
    unlockLevel: 6,
    maxCount: 2,
  },
  cow: {
    id: 'cow',
    name: '젖소',
    price: 1900,
    produceId: 'milk',
    produceName: '우유',
    producePrice: 72,
    careGoal: 1,
    unlockLevel: 8,
    maxCount: 2,
  },
  // 꿀벌: 양봉장 자리에 통으로 놓는다 (우리 안을 걷지 않는다). 사는 단위는 통 하나. 벌꿀 90원(3개 270원)은 사용자가 정함 (문제당 벌이 약 134)
  bee: {
    id: 'bee',
    name: '꿀벌',
    price: 2300,
    produceId: 'honey',
    produceName: '벌꿀',
    producePrice: 90,
    careGoal: 1,
    unlockLevel: 10,
    maxCount: 2,
    careLabel: '아카시아꽃 주기',
    careQuestion: '꿀벌에게 아카시아꽃을 줄까요?',
    careText: '윙윙',
    countUnit: '통',
    homeName: '양봉장',
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
  tangerine: TREE_SPECIES.tangerine.fruitPrice,
  kiwi: TREE_SPECIES.kiwi.fruitPrice,
  egg: ANIMAL_SPECIES.chicken.producePrice,
  goatMilk: ANIMAL_SPECIES.goat.producePrice,
  wool: ANIMAL_SPECIES.sheep.producePrice,
  milk: ANIMAL_SPECIES.cow.producePrice,
  honey: ANIMAL_SPECIES.bee.producePrice,
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
  tangerine: '귤',
  kiwi: '키위',
  egg: '달걀',
  goatMilk: '치즈',
  wool: '양털',
  milk: '우유',
  honey: '벌꿀',
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
  'tangerine',
  'kiwi',
  'egg',
  'goatMilk',
  'wool',
  'milk',
  'honey',
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

/* ----------------------- 가구 · 마당 장식 · 벽지 · 바닥재 ----------------------- */

// 꾸미기 물건은 decor.ts 로 옮겼다 (분류 · 값). 예전처럼 여기서 가져와도 되게 다시 내보낸다
export * from './decor';
