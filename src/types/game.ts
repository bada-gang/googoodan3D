/**
 * 게임 도메인 타입.
 * 그래픽/저장소 구현과 무관한 순수 데이터 모델만 둔다. (개발원칙 8, 9)
 */

export type MultiplicationTable = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type AvatarId =
  | 'rabbit'
  | 'bear'
  | 'cat'
  | 'fox'
  | 'bird'
  | 'frog';

/** 게임 안에서 움직이는 내 캐릭터. 목록에서 고르는 아바타 아이콘과는 별개다. */
export type CharacterId = 'boy' | 'girl' | 'farmer' | 'dino' | 'bunny' | 'astro';

export interface PlayerProfile {
  /** 내부 식별자. 이름을 DB 키로 쓰지 않는다. (명세 9) */
  id: string;
  displayName: string;
  avatarId: AvatarId;
  /**
   * 캐릭터가 하나뿐이던 시절에 만든 프로필에는 없다.
   * 직접 읽지 말고 characterOf() 를 쓴다.
   */
  characterId?: CharacterId;
  createdAt: string;
  /** 아직 한 번도 게임에 들어가지 않았으면 null. 교사가 미리 만든 이름이 그렇다. (명세 10, 73) */
  lastPlayedAt: string | null;
}

/** characterId 가 없는 프로필(교사가 미리 만든 이름 등)은 남자아이로 시작한다. */
export function characterOf(profile: { characterId?: CharacterId } | null | undefined): CharacterId {
  return profile?.characterId ?? 'boy';
}

/** 현재 접속 세션에만 적용되는 설정. 저장하지 않는다. (명세 12) */
export interface GameSessionSettings {
  selectedMultiplicationTables: number[];
}

/* ---------------------------------- 농장 ---------------------------------- */

export type TreeSpeciesId = 'apple' | 'orange' | 'peach' | 'cherry' | 'grape' | 'persimmon' | 'banana' | 'blueberry';

/** 나무 성장 단계. (명세 20, 46) */
export type TreeStage = 'seed' | 'sprout' | 'sapling' | 'mature' | 'fruiting';

export const TREE_STAGE_ORDER: TreeStage[] = [
  'seed',
  'sprout',
  'sapling',
  'mature',
  'fruiting',
];

export interface FarmPlot {
  id: string;
  /** 마당의 몇 번째 밭인지. 월드 좌표 계산에 사용한다. */
  index: number;
  species: TreeSpeciesId | null;
  stage: TreeStage;
  /** 현재 단계에서 쌓은 성장 포인트 */
  growthPoints: number;
  /** 수확 가능한 열매 수 */
  fruitCount: number;
  /** 이 나무를 지금까지 몇 번 수확했는지. 한계에 닿으면 나무가 사라진다. */
  harvestCount: number;
}

/* ---------------------------------- 동물 ---------------------------------- */

export type AnimalSpeciesId = 'chicken' | 'goat' | 'sheep' | 'cow';

export interface AnimalInstance {
  id: string;
  species: AnimalSpeciesId;
  /** 돌봄 게이지 (0 ~ species.careGoal) */
  care: number;
  produceReady: boolean;
  /** 우리 안에서의 상대 위치(0~1). 배치 재현용. */
  spot: number;
}

/* -------------------------------- 아이템 --------------------------------- */

export type SeedId = `seed_${TreeSpeciesId}`;
export type FruitId = TreeSpeciesId;
export type ProduceId = 'egg' | 'wool' | 'milk' | 'goatMilk';
/** 시장 연못에서 낚는 물고기 (config/fishing) */
export type FishId = 'minnow' | 'loach' | 'crucian' | 'catfish' | 'trout' | 'carp' | 'goldfish' | 'salmon';
export type SellableId = FruitId | ProduceId | FishId;

/** 쓰면 없어지는 소모품. 농장 가게에서 산다. */
export type SupplyId = 'water' | 'feed';

export type FurnitureId = string;
export type ItemId = SeedId | SellableId | SupplyId | FurnitureId;

export type ItemCategory =
  | 'seed'
  | 'fruit'
  | 'produce'
  | 'supply'
  | 'furniture'
  | 'decoration'
  | 'outdoor';

/** 아이템 id -> 개수 */
export type Inventory = Record<string, number>;

/* -------------------------------- 집 꾸미기 -------------------------------- */

export type PlacementArea = 'home' | 'yard';

/** 꾸미기로 놓은 물건. 3D 바닥 좌표(m)와 90° 단위 회전 */
export interface PlacedItem {
  instanceId: string;
  itemId: FurnitureId;
  /** 바닥 위치 (m). 벽에 거는 물건은 x 만 쓴다 */
  x: number;
  z: number;
  /** 90° 를 몇 번 돌렸는지 (0~3). 0 이면 앞면이 카메라 쪽 */
  rotation: number;
}

export interface HomeState {
  wallpaperId: string;
  floorId: string;
  placed: PlacedItem[];
}

export interface YardState {
  placed: PlacedItem[];
}

/* ---------------------------------- 낚시 ---------------------------------- */

/** 도감 한 칸: 처음 잡은 날과 지금까지 잡은 수 */
export interface FishDexEntry {
  caught: number;
  /** 처음 잡은 날 (YYYY-MM-DD) */
  firstCaughtAt: string;
}

/** 오늘 낚시를 몇 번 던졌는지. 날이 바뀌면 다시 0 부터 */
export interface FishingDay {
  /** YYYY-MM-DD. 한 번도 안 던졌으면 null */
  date: string | null;
  casts: number;
}

/* -------------------------------- 저장 데이터 ------------------------------- */

/** 열매 받기 게임 기록 한 판 */
export interface MiniGameScore {
  score: number;
  playedAt: string;
}

export interface GameSaveData {
  schemaVersion: number;
  profile: PlayerProfile;
  money: number;
  experience: number;
  level: number;
  unlocked: string[];
  farm: { plots: FarmPlot[] };
  animals: AnimalInstance[];
  inventory: Inventory;
  home: HomeState;
  yard: YardState;
  /** 미니게임 최고 기록 */
  records: Record<string, number>;
  chests: number;
  /** 열매 받기 게임 기록 (점수 높은 순) */
  miniGameScores: MiniGameScore[];
  /**
   * 미니게임 상자 보상을 마지막으로 받은 날 (YYYY-MM-DD).
   * 게임은 몇 번이든 할 수 있지만 상자는 하루 한 번만 준다.
   */
  lastMiniGameRewardDate: string | null;
  /** 물고기 도감 (물고기 id -> 기록). 잡은 적 없는 물고기는 없다 */
  fishDex: Partial<Record<FishId, FishDexEntry>>;
  fishingDay: FishingDay;
}
