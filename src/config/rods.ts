/**
 * 잡화: 낚싯대. 만물상의 잡화 칸에서 산다. 낚싯대마다 능력이 하나씩 있고, 가진 것 중 하나를 골라 쓴다.
 * 아무것도 고르지 않으면 기본 낚싯대(능력 없음).
 *
 * 가진 낚싯대는 unlocked 에 'rod_<id>' 로, 쓰는 낚싯대는 저장본의 equippedRod 에 둔다.
 * 능력은 낚시 막대 게임(ui/overlays/FishingOverlay)과 걸리는 것 고르기(config/fishing rollFish)가 쓴다.
 * 낚시할 때 손에 든 낚싯대 색은 ROD_LOOK (world/scenes/town/FishingSpot 이 쓴다).
 */
import type { RodId } from '@/types/game';
import { ASSETS } from './assets';

export type { RodId };

export interface RodDef {
  id: RodId;
  name: string;
  price: number;
  /** 가게 · 고르기에서 보이는 능력 설명 */
  ability: string;
  icon: string;
  /** 초록 칸 너비 배율 */
  zoneScale: number;
  /** 막대 빠르기 배율 */
  speedScale: number;
  /** 레어템(전설)이 걸리는 정도 배율 */
  rareScale: number;
}

export const RODS: RodDef[] = [
  {
    id: 'bamboo',
    name: '튼튼한 대나무 낚싯대',
    price: 2000,
    ability: '초록 칸이 넓어져요',
    icon: ASSETS.tools.rodBamboo,
    zoneScale: 1.15,
    speedScale: 1,
    rareScale: 1,
  },
  {
    id: 'star',
    name: '별똥별 낚싯대',
    price: 6000,
    ability: '막대가 천천히 움직여요',
    icon: ASSETS.tools.rodStar,
    zoneScale: 1,
    speedScale: 0.85,
    rareScale: 1,
  },
  {
    id: 'dragon',
    name: '포세이돈의 낚싯대',
    price: 15000,
    ability: '특별한 것들을 더 잘 낚아요',
    icon: ASSETS.tools.rodDragon,
    zoneScale: 1,
    speedScale: 1,
    rareScale: 2,
  },
];

export const ROD_BY_ID: Record<RodId, RodDef> = Object.fromEntries(RODS.map((r) => [r.id, r])) as Record<RodId, RodDef>;

/** 낚싯대 색: 장대 · 손잡이 · 릴, 끝에 다는 작은 구슬(없으면 안 단다) */
export interface RodLook {
  pole: string;
  grip: string;
  reel: string;
  tip?: string;
}

const BASIC_LOOK: RodLook = { pole: '#7a5232', grip: '#3f6fa8', reel: '#d9d4c8' };

export const ROD_LOOK: Record<RodId, RodLook> = {
  bamboo: { pole: '#9cc46a', grip: '#c08a52', reel: '#a3714a' },
  star: { pole: '#a996d8', grip: '#7fb8e6', reel: '#e8e8f0', tip: '#f6c453' },
  dragon: { pole: '#f6c453', grip: '#3f9a8a', reel: '#f6c453', tip: '#fbf7ef' },
};

export function rodLook(id: RodId | null): RodLook {
  return id ? ROD_LOOK[id] : BASIC_LOOK;
}

/** 가진 낚싯대 표시 (unlocked 목록 안) */
export function rodUnlockKey(id: RodId): string {
  return `rod_${id}`;
}

export function isRodId(id: unknown): id is RodId {
  return typeof id === 'string' && id in ROD_BY_ID;
}

/** 쓰는 낚싯대의 능력 (기본 낚싯대면 모두 1) */
export function rodAbility(id: RodId | null): Pick<RodDef, 'zoneScale' | 'speedScale' | 'rareScale'> {
  return id ? ROD_BY_ID[id] : { zoneScale: 1, speedScale: 1, rareScale: 1 };
}
