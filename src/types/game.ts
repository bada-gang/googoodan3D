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

/** 학급. 선생님이 만들고, 학생은 게임 첫 화면에서 자기 반을 고른다. */
export interface ClassRoom {
  id: string;
  /** "2학년 3반" 처럼 화면에 보이는 이름 */
  name: string;
  createdAt: string;
  /**
   * 반에 들어갈 때 누르는 숫자 비밀번호 (CLASS_PASSWORD_LENGTH 자리). 없으면 묻지 않는다.
   * ⚠ 잠금장치가 아니라 다른 반 학생이 들어오지 않게 하는 정도다 — 선생님 화면에서 보이도록 그대로 저장한다.
   */
  password?: string | null;
}

/** 학급 비밀번호 자리 수 (숫자만) */
export const CLASS_PASSWORD_LENGTH = 4;

export function isValidClassPassword(value: string): boolean {
  return new RegExp(`^\\d{${CLASS_PASSWORD_LENGTH}}$`).test(value);
}

/** 만들 수 있는 학급 수 (선생님 화면에서 막는다) */
export const MAX_CLASSES = 10;

/** 한 학급에 넣을 수 있는 학생 수 (선생님 화면에서 막는다) */
export const MAX_STUDENTS_PER_CLASS = 20;

/** 학급 · 학생 이름 길이 한도 */
export const MAX_CLASS_NAME_LENGTH = 12;
export const MAX_PLAYER_NAME_LENGTH = 6;

/** 학급 목록 순서: "2학년 2반" 이 "2학년 10반" 보다 앞에 오게 숫자를 숫자로 비교한다 */
export function sortClasses(list: ClassRoom[]): ClassRoom[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
}

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
  /**
   * 어느 반 학생인지 (ClassRoom.id). 학급 기능이 생기기 전에 만든 학생에게는 없다 —
   * 선생님이 첫 학급을 만들 때 그 반으로 옮겨진다.
   */
  classId?: string | null;
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

export type TreeSpeciesId =
  | 'apple'
  | 'orange'
  | 'peach'
  | 'cherry'
  | 'grape'
  | 'persimmon'
  | 'banana'
  | 'blueberry'
  | 'tangerine'
  | 'kiwi';

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

/** bee(꿀벌)는 우리 안을 걷지 않고 양봉장 자리에 통으로 놓인다 (world/scenes/yard/apiary) */
export type AnimalSpeciesId = 'chicken' | 'goat' | 'sheep' | 'cow' | 'bee';
/** 우리 안을 걸어 다니는 동물 (꿀벌 빼고) */
export type PenAnimalId = Exclude<AnimalSpeciesId, 'bee'>;

export interface AnimalInstance {
  id: string;
  species: AnimalSpeciesId;
  /** 돌봄 게이지 (0 ~ species.careGoal) */
  care: number;
  produceReady: boolean;
  /** 우리 안에서의 상대 위치(0~1). 배치 재현용. */
  spot: number;
  /** 지난 휴식 뒤로 생산물을 받은 횟수 (config/balance ANIMAL_REST). 옛 저장에는 없다 */
  collects?: number;
  /** 이 시각(Date.now, ms)까지 쉰다. 옛 저장에는 없다 */
  restUntil?: number;
}

/* -------------------------------- 아이템 --------------------------------- */

export type SeedId = `seed_${TreeSpeciesId}`;
export type FruitId = TreeSpeciesId;
export type ProduceId = 'egg' | 'wool' | 'milk' | 'goatMilk' | 'honey';
/** 시장 연못에서 낚는 것: 물고기 20종 + 물속 보물 8종 (config/fishing) */
export type FishId =
  | 'minnow'
  | 'paleChub'
  | 'loach'
  | 'crab'
  | 'crucian'
  | 'mackerel'
  | 'hairtail'
  | 'squid'
  | 'flounder'
  | 'catfish'
  | 'pufferfish'
  | 'trout'
  | 'carp'
  | 'eel'
  | 'stingray'
  | 'octopus'
  | 'tuna'
  | 'goldfish'
  | 'sturgeon'
  | 'salmon'
  | 'rubberDuck'
  | 'bottle'
  | 'treasureMap'
  | 'pearl'
  | 'baleen'
  | 'coinPouch'
  | 'mermaidComb'
  | 'crown';
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
