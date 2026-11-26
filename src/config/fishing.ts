/**
 * 낚시: 낚을 수 있는 것 목록(물고기 20종 + 물속 보물 8종: 이름 · 값 · 얼마나 자주 걸리는지 · 잡기 어려움)과 낚시 규칙 숫자.
 *
 * 한 번 낚기: 낚시터에서 곱셈 문제를 맞히면 찌를 달아 던진다 → 입질이 오면 좌우로 움직이는 막대를
 * 알맞은 칸에서 멈춘다 → 칸 안이면 잡는다. 하루에 던질 수 있는 횟수는 정해져 있다.
 * 잡은 것은 가방에 들어가고(팔 수 있다) 도감에 자동으로 오른다.
 */
import { josa } from '@/config/josa';
import type { FishId } from '@/types/game';

/** 물고기냐, 물속에 가라앉은 물건(보물)이냐 */
export type CatchKind = 'fish' | 'treasure';

/**
 * 입질 때 보여 주는 크기. "작은 물고기가 물었어요" 처럼 (무엇인지는 잡아야 안다).
 * thing 은 물고기가 아닌 묵직한 물건, legend 는 가장 드문 레어템 (전설의 연어 · 고래수염 · 금화 주머니 · 마법 빗 · 용왕의 왕관). 화면에서 빛나는 효과를 준다
 */
export type FishSize = 'small' | 'medium' | 'big' | 'thing' | 'legend';

export interface FishDef {
  id: FishId;
  name: string;
  kind: CatchKind;
  /** 가게에서 팔 때 한 개 값 */
  price: number;
  /** 걸리는 정도 (다른 것들과의 비율). 클수록 자주 걸린다 */
  weight: number;
  size: FishSize;
  /** 막대가 한쪽 끝에서 다른 쪽 끝까지 가는 횟수 (1초에). 클수록 빠르다 */
  speed: number;
  /** 멈춰야 하는 칸의 너비 (막대 전체 대비) */
  zone: number;
  /** 그림이 아직 없을 때 임시 그림 색 */
  color: string;
}

const fish = (def: Omit<FishDef, 'kind'>): FishDef => ({ ...def, kind: 'fish' });
const treasure = (def: Omit<FishDef, 'kind'>): FishDef => ({ ...def, kind: 'treasure' });

/*
 * 걸리는 정도(weight)는 합이 100 이라 그대로 % 다 (물고기 90.3, 보물 9.7). 드물수록 값과 막대 난이도를 올린다.
 *  - 낚시는 돈벌이가 되지 않게 값을 낮게 둔다 (사용자 요청). 흔한 물고기 1~4원, 큰 물고기 10원 안팎
 *  - 보물은 지도 33 · 진주 55 · 고래수염 66 · 금화 77 · 빗 88 · 왕관 99 (같은 숫자 두 번)
 *  - 한 번 던질 때 평균 약 8.7원 (막대를 놓치는 것까지 치면 그보다 적다)
 * 금붕어는 작지만 드물다 (입질 때 '작은 물고기'로 보여 깜짝 놀라게)
 */
export const FISH: Record<FishId, FishDef> = {
  minnow: fish({ id: 'minnow', name: '송사리', price: 1, weight: 6.7, size: 'small', speed: 0.9, zone: 0.28, color: '#b9c9d6' }),
  paleChub: fish({ id: 'paleChub', name: '피라미', price: 1, weight: 6.7, size: 'small', speed: 0.9, zone: 0.28, color: '#9cc7c0' }),
  loach: fish({ id: 'loach', name: '미꾸라지', price: 2, weight: 6.7, size: 'small', speed: 0.9, zone: 0.27, color: '#a08a5c' }),
  crab: fish({ id: 'crab', name: '꽃게', price: 2, weight: 6.7, size: 'small', speed: 1, zone: 0.27, color: '#e0674a' }),
  crucian: fish({ id: 'crucian', name: '붕어', price: 3, weight: 6.7, size: 'medium', speed: 1, zone: 0.26, color: '#b8a36a' }),
  // 고등어 · 오징어 · 뱀장어 · 문어 등은 바다 낚시에서도 잡힌다 (나중에 바다 낚시터를 만들면 같이 쓴다)
  mackerel: fish({ id: 'mackerel', name: '고등어', price: 3, weight: 6.7, size: 'medium', speed: 1, zone: 0.25, color: '#5f8fae' }),
  hairtail: fish({ id: 'hairtail', name: '갈치', price: 4, weight: 5.7, size: 'medium', speed: 1, zone: 0.25, color: '#d7dde6' }),
  squid: fish({ id: 'squid', name: '오징어', price: 5, weight: 5.2, size: 'medium', speed: 1.1, zone: 0.24, color: '#f0c9b8' }),
  flounder: fish({ id: 'flounder', name: '넙치', price: 6, weight: 5.2, size: 'medium', speed: 1.1, zone: 0.24, color: '#b8996f' }),
  catfish: fish({ id: 'catfish', name: '메기', price: 7, weight: 4.7, size: 'medium', speed: 1.1, zone: 0.23, color: '#6f6a5e' }),
  pufferfish: fish({ id: 'pufferfish', name: '가시 복어', price: 8, weight: 4.7, size: 'medium', speed: 1.1, zone: 0.23, color: '#efd98c' }),
  trout: fish({ id: 'trout', name: '무지개송어', price: 9, weight: 4.2, size: 'big', speed: 1.2, zone: 0.22, color: '#e59a9a' }),
  carp: fish({ id: 'carp', name: '비단잉어', price: 10, weight: 3.7, size: 'big', speed: 1.2, zone: 0.21, color: '#e8743b' }),
  eel: fish({ id: 'eel', name: '뱀장어', price: 11, weight: 3.2, size: 'big', speed: 1.3, zone: 0.2, color: '#3f6f8a' }),
  stingray: fish({ id: 'stingray', name: '가오리', price: 12, weight: 3.2, size: 'big', speed: 1.3, zone: 0.2, color: '#8fa9bd' }),
  octopus: fish({ id: 'octopus', name: '문어', price: 13, weight: 2.8, size: 'big', speed: 1.3, zone: 0.2, color: '#d9775f' }),
  tuna: fish({ id: 'tuna', name: '참치', price: 14, weight: 2.3, size: 'big', speed: 1.3, zone: 0.19, color: '#355c8a' }),
  goldfish: fish({ id: 'goldfish', name: '금붕어', price: 15, weight: 2.1, size: 'small', speed: 1.4, zone: 0.19, color: '#f08a3c' }),
  sturgeon: fish({ id: 'sturgeon', name: '철갑상어', price: 20, weight: 1.8, size: 'big', speed: 1.4, zone: 0.19, color: '#7f8c8e' }),
  salmon: fish({ id: 'salmon', name: '폭포를 거스르는 전설의 연어', price: 25, weight: 1.3, size: 'legend', speed: 1.4, zone: 0.19, color: '#f2785a' }),
  rubberDuck: treasure({ id: 'rubberDuck', name: '노란 오리 장난감', price: 1, weight: 3, size: 'thing', speed: 1, zone: 0.26, color: '#f6d24a' }),
  bottle: treasure({ id: 'bottle', name: '유리병 편지', price: 7, weight: 2, size: 'thing', speed: 1.2, zone: 0.23, color: '#9fd3c7' }),
  treasureMap: treasure({ id: 'treasureMap', name: '보물 지도', price: 33, weight: 1, size: 'thing', speed: 1.3, zone: 0.21, color: '#d9b77a' }),
  pearl: treasure({ id: 'pearl', name: '대왕 진주 조개', price: 55, weight: 1, size: 'thing', speed: 1.3, zone: 0.19, color: '#f3d9e2' }),
  baleen: treasure({ id: 'baleen', name: '흰수염고래의 수염 한 줌', price: 66, weight: 0.7, size: 'legend', speed: 1.3, zone: 0.19, color: '#bfe3f2' }),
  coinPouch: treasure({ id: 'coinPouch', name: '해적왕의 금화 주머니', price: 77, weight: 0.7, size: 'legend', speed: 1.4, zone: 0.19, color: '#c98a4b' }),
  mermaidComb: treasure({ id: 'mermaidComb', name: '인어공주의 마법 빗', price: 88, weight: 0.7, size: 'legend', speed: 1.4, zone: 0.19, color: '#f4b8d0' }),
  crown: treasure({ id: 'crown', name: '간이 필요한 용왕의 왕관', price: 99, weight: 0.6, size: 'legend', speed: 1.4, zone: 0.19, color: '#f6c453' }),
};

/** 도감 · 가게에 보이는 순서: 물고기 → 보물, 각각 자주 걸리는 것부터 (같으면 싼 것부터) */
export const FISH_ORDER: FishId[] = [
  'minnow',
  'paleChub',
  'loach',
  'crab',
  'crucian',
  'mackerel',
  'hairtail',
  'squid',
  'flounder',
  'catfish',
  'pufferfish',
  'trout',
  'carp',
  'eel',
  'stingray',
  'octopus',
  'tuna',
  'goldfish',
  'sturgeon',
  'salmon',
  'rubberDuck',
  'bottle',
  'treasureMap',
  'pearl',
  'baleen',
  'coinPouch',
  'mermaidComb',
  'crown',
];

/**
 * 잡았을 때 팡파레가 나는 것과 그 소리 (src/audio/sfx 'fanfare:salmon' · 'fanfare:crown').
 * 여기 없는 것은 보통 수확 소리.
 */
export const FANFARE: Partial<Record<FishId, 'salmon' | 'crown'>> = {
  salmon: 'salmon',
  pearl: 'salmon',
  baleen: 'crown',
  coinPouch: 'crown',
  mermaidComb: 'crown',
  crown: 'crown',
};

/** 도감에서 아직 못 잡은 칸에 적는 말 */
export const FISH_SIZE_LABEL: Record<FishSize, string> = {
  small: '작은 물고기',
  medium: '제법 큰 물고기',
  big: '아주 큰 물고기',
  thing: '물속의 무언가',
  legend: '엄청난 무언가',
};

/** 입질 때 보여 주는 말 */
export const BITE_MESSAGE: Record<FishSize, string> = {
  small: '작은 물고기가 물었어요!',
  medium: '제법 큰 물고기가 물었어요!',
  big: '아주 큰 물고기가 물었어요!',
  thing: '묵직한 무언가가 걸렸어요!',
  legend: '엄청난 무언가가 물었어요!',
};

/** "송사리를 잡았어요!" / "용왕의 왕관을 건졌어요!" — 받침에 따라 을/를, 물고기는 잡고 보물은 건진다 */
export function caughtMessage(id: FishId): string {
  const { name, kind } = FISH[id];
  return `${josa(name, '을/를')} ${kind === 'fish' ? '잡았어요' : '건졌어요'}!`;
}

export const FISHING = {
  /** 하루에 던질 수 있는 횟수 */
  castsPerDay: 20,
  /** 찌를 던지는 동작 (초) */
  castSeconds: 0.8,
  /** 찌가 물에 떨어진 뒤 입질까지 (초) */
  biteMinSeconds: 2,
  biteMaxSeconds: 5,
  /** 끌어올리는 동작 (초) */
  reelSeconds: 0.9,
  /** 놓쳤을 때 안내를 보여 주는 시간 (초) */
  escapeSeconds: 1.6,
} as const;

/** 걸리는 것을 무게(weight)에 따라 하나 고른다 */
export function rollFish(random: () => number = Math.random): FishId {
  const total = FISH_ORDER.reduce((sum, id) => sum + FISH[id].weight, 0);
  let pick = random() * total;
  for (const id of FISH_ORDER) {
    pick -= FISH[id].weight;
    if (pick < 0) return id;
  }
  return FISH_ORDER[0];
}

export function isFishId(id: string): id is FishId {
  return id in FISH;
}

/** 레어템: 도감 · 가방 · 가게 · 잡은 카드에서 빛나는 효과를 준다 (ui/common/RareIcon) */
export function isRare(id: string): boolean {
  return isFishId(id) && FISH[id].size === 'legend';
}
