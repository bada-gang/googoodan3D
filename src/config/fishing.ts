/**
 * 낚시: 낚을 수 있는 것 목록(물고기 12종 + 물속 보물 4종: 이름 · 값 · 얼마나 자주 걸리는지 · 잡기 어려움)과 낚시 규칙 숫자.
 *
 * 한 번 낚기: 낚시터에서 곱셈 문제를 맞히면 찌를 달아 던진다 → 입질이 오면 좌우로 움직이는 막대를
 * 알맞은 칸에서 멈춘다 → 칸 안이면 잡는다. 하루에 던질 수 있는 횟수는 정해져 있다.
 * 잡은 것은 가방에 들어가고(팔 수 있다) 도감에 자동으로 오른다.
 */
import type { FishId } from '@/types/game';

/** 물고기냐, 물속에 가라앉은 물건(보물)이냐 */
export type CatchKind = 'fish' | 'treasure';

/**
 * 입질 때 보여 주는 크기. "작은 물고기가 물었어요" 처럼 (무엇인지는 잡아야 안다).
 * thing 은 물고기가 아닌 묵직한 물건, legend 는 가장 드문 것 (전설의 연어 · 용왕의 왕관)
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
 * 걸리는 정도(weight)는 합이 100 이라 그대로 % 다. 크기 · 드묾에 따라 값과 막대 난이도를 올린다.
 *  - 흔한 작은 물고기는 사과(6원)보다 싸고, 아주 큰 물고기는 체리 · 달걀(15~26원) 쯤
 *  - 드문 것(금붕어)은 염소젖 값, 보물 지도 · 대왕 진주 조개 · 전설(연어 · 왕관)은 큰 대박
 *  - 한 번 던질 때 평균 약 17.5원 (막대를 놓치는 것까지 치면 그보다 적다). 하루 20번뿐이라 밭일보다 적게 번다
 * 금붕어는 작지만 드물다 (입질 때 '작은 물고기'로 보여 깜짝 놀라게)
 */
export const FISH: Record<FishId, FishDef> = {
  minnow: fish({ id: 'minnow', name: '송사리', price: 3, weight: 15.5, size: 'small', speed: 1, zone: 0.27, color: '#b9c9d6' }),
  loach: fish({ id: 'loach', name: '미꾸라지', price: 4, weight: 14, size: 'small', speed: 1, zone: 0.26, color: '#a08a5c' }),
  crucian: fish({ id: 'crucian', name: '붕어', price: 7, weight: 12, size: 'medium', speed: 1.1, zone: 0.25, color: '#b8a36a' }),
  // 고등어 · 오징어 · 장어 · 문어는 바다 낚시에서도 잡힌다 (나중에 바다 낚시터를 만들면 같이 쓴다)
  mackerel: fish({ id: 'mackerel', name: '고등어', price: 9, weight: 11, size: 'medium', speed: 1.1, zone: 0.24, color: '#5f8fae' }),
  squid: fish({ id: 'squid', name: '오징어', price: 11, weight: 8, size: 'medium', speed: 1.2, zone: 0.23, color: '#f0c9b8' }),
  catfish: fish({ id: 'catfish', name: '메기', price: 13, weight: 7, size: 'medium', speed: 1.2, zone: 0.22, color: '#6f6a5e' }),
  trout: fish({ id: 'trout', name: '무지개송어', price: 16, weight: 6, size: 'big', speed: 1.3, zone: 0.21, color: '#e59a9a' }),
  carp: fish({ id: 'carp', name: '잉어', price: 18, weight: 5, size: 'big', speed: 1.3, zone: 0.2, color: '#d9a14a' }),
  eel: fish({ id: 'eel', name: '장어', price: 22, weight: 4, size: 'big', speed: 1.4, zone: 0.19, color: '#5f6b4e' }),
  octopus: fish({ id: 'octopus', name: '문어', price: 26, weight: 3.5, size: 'big', speed: 1.4, zone: 0.18, color: '#d9775f' }),
  goldfish: fish({ id: 'goldfish', name: '금붕어', price: 35, weight: 2.5, size: 'small', speed: 1.5, zone: 0.17, color: '#f08a3c' }),
  salmon: fish({ id: 'salmon', name: '전설의 연어', price: 120, weight: 1.5, size: 'legend', speed: 1.5, zone: 0.16, color: '#f2785a' }),
  bottle: treasure({ id: 'bottle', name: '유리병 편지', price: 15, weight: 6, size: 'thing', speed: 1.3, zone: 0.23, color: '#9fd3c7' }),
  treasureMap: treasure({ id: 'treasureMap', name: '보물 지도', price: 100, weight: 2, size: 'thing', speed: 1.6, zone: 0.2, color: '#d9b77a' }),
  pearl: treasure({ id: 'pearl', name: '대왕 진주 조개', price: 140, weight: 1.5, size: 'thing', speed: 1.6, zone: 0.17, color: '#f3d9e2' }),
  crown: treasure({ id: 'crown', name: '간이 필요한 용왕의 왕관', price: 300, weight: 0.5, size: 'legend', speed: 1.8, zone: 0.16, color: '#f6c453' }),
};

/** 도감 · 가게에 보이는 순서: 물고기(흔하고 싼 것부터) → 보물 */
export const FISH_ORDER: FishId[] = [
  'minnow',
  'loach',
  'crucian',
  'mackerel',
  'squid',
  'catfish',
  'trout',
  'carp',
  'eel',
  'octopus',
  'goldfish',
  'salmon',
  'bottle',
  'treasureMap',
  'pearl',
  'crown',
];

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
  const last = name.charCodeAt(name.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${name}${hasFinal ? '을' : '를'} ${kind === 'fish' ? '잡았어요' : '건졌어요'}!`;
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
