/** 낚시 (저장되는 것): 오늘 던진 횟수, 물고기 도감. 잡은 물고기는 가방에 들어간다. */
import { FISHING } from '@/config/fishing';
import type { FishDexEntry, FishId, FishingDay } from '@/types/game';
import { todayKey } from './saveData';
import type { GameSlice } from './types';

export interface FishingSlice {
  fishDex: Partial<Record<FishId, FishDexEntry>>;
  fishingDay: FishingDay;

  /** 오늘 더 던질 수 있는 횟수 */
  fishingCastsLeft: () => number;
  /** 한 번 던진다 (오늘 횟수를 쓴다). 다 썼으면 false */
  spendFishingCast: () => boolean;
  /** 잡은 물고기를 가방에 넣고 도감에 올린다. 처음 잡은 물고기면 true */
  catchFish: (fish: FishId) => boolean;
}

export const createFishingSlice: GameSlice<FishingSlice> = (set, get) => ({
  fishDex: {},
  fishingDay: { date: null, casts: 0 },

  fishingCastsLeft: () => {
    const { date, casts } = get().fishingDay;
    const used = date === todayKey() ? casts : 0;
    return Math.max(0, FISHING.castsPerDay - used);
  },

  spendFishingCast: () => {
    if (get().fishingCastsLeft() <= 0) return false;
    const today = todayKey();
    set((s) => ({
      fishingDay: { date: today, casts: (s.fishingDay.date === today ? s.fishingDay.casts : 0) + 1 },
    }));
    return true;
  },

  catchFish: (fish) => {
    const before = get().fishDex[fish];
    get().addItem(fish);
    set((s) => ({
      fishDex: {
        ...s.fishDex,
        [fish]: { caught: (before?.caught ?? 0) + 1, firstCaughtAt: before?.firstCaughtAt ?? todayKey() },
      },
    }));
    return !before;
  },
});
