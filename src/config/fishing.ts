/**
 * 낚시: 물고기 목록(이름 · 값 · 얼마나 자주 무는지 · 잡기 어려움)과 낚시 규칙 숫자.
 *
 * 한 번 낚기: 낚시터에서 곱셈 문제를 맞히면 찌를 달아 던진다 → 입질이 오면 좌우로 움직이는 막대를
 * 알맞은 칸에서 멈춘다 → 칸 안이면 잡는다. 하루에 던질 수 있는 횟수는 정해져 있다.
 * 잡은 물고기는 가방에 들어가고(팔 수 있다) 도감에 자동으로 오른다.
 */
import type { FishId } from '@/types/game';

/** 물고기 크기. 입질 때 "작은 물고기가 물었어요" 처럼 보여 준다 (어떤 물고기인지는 잡아야 안다) */
export type FishSize = 'small' | 'medium' | 'big' | 'legend';

export interface FishDef {
  id: FishId;
  name: string;
  /** 가게에서 팔 때 한 마리 값 */
  price: number;
  /** 무는 정도 (다른 물고기와의 비율). 클수록 자주 문다 */
  weight: number;
  size: FishSize;
  /** 막대가 한쪽 끝에서 다른 쪽 끝까지 가는 횟수 (1초에). 클수록 빠르다 */
  speed: number;
  /** 멈춰야 하는 칸의 너비 (막대 전체 대비) */
  zone: number;
  /** 그림이 아직 없을 때 임시 그림 색 */
  color: string;
}

export const FISH: Record<FishId, FishDef> = {
  minnow: { id: 'minnow', name: '송사리', price: 3, weight: 26, size: 'small', speed: 1.1, zone: 0.27, color: '#b9c9d6' },
  loach: { id: 'loach', name: '미꾸라지', price: 4, weight: 22, size: 'small', speed: 1.3, zone: 0.243, color: '#a08a5c' },
  crucian: { id: 'crucian', name: '붕어', price: 6, weight: 18, size: 'medium', speed: 1.4, zone: 0.216, color: '#b8a36a' },
  catfish: { id: 'catfish', name: '메기', price: 10, weight: 12, size: 'medium', speed: 1.7, zone: 0.18, color: '#6f6a5e' },
  trout: { id: 'trout', name: '무지개송어', price: 12, weight: 9, size: 'big', speed: 1.9, zone: 0.162, color: '#e59a9a' },
  carp: { id: 'carp', name: '잉어', price: 15, weight: 7, size: 'big', speed: 2, zone: 0.144, color: '#d9a14a' },
  goldfish: { id: 'goldfish', name: '금붕어', price: 25, weight: 4, size: 'big', speed: 2.2, zone: 0.126, color: '#f08a3c' },
  salmon: { id: 'salmon', name: '전설의 연어', price: 60, weight: 2, size: 'legend', speed: 2.7, zone: 0.099, color: '#f2785a' },
};

/** 도감 · 가게에 보이는 순서 (흔한 것부터) */
export const FISH_ORDER: FishId[] = ['minnow', 'loach', 'crucian', 'catfish', 'trout', 'carp', 'goldfish', 'salmon'];

export const FISH_SIZE_LABEL: Record<FishSize, string> = {
  small: '작은 물고기',
  medium: '제법 큰 물고기',
  big: '아주 큰 물고기',
  legend: '엄청난 무언가',
};

export const FISHING = {
  /** 하루에 던질 수 있는 횟수 */
  castsPerDay: 10,
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

/** 무는 물고기를 무게(weight)에 따라 하나 고른다 */
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
