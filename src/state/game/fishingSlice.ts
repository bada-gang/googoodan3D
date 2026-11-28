/** 낚시 (저장되는 것): 오늘 던진 횟수, 물고기 도감, 쓰는 낚싯대. 잡은 물고기는 가방에 들어간다. */
import { FISHING } from '@/config/fishing';
import { ROD_BY_ID, rodUnlockKey } from '@/config/rods';
import type { FishDexEntry, FishId, FishingDay, RodId } from '@/types/game';
import { todayKey } from './saveData';
import type { GameSlice } from './types';

export interface FishingSlice {
  fishDex: Partial<Record<FishId, FishDexEntry>>;
  fishingDay: FishingDay;
  equippedRod: RodId | null;

  /** 오늘 더 던질 수 있는 횟수 */
  fishingCastsLeft: () => number;
  /** 한 번 던진다 (오늘 횟수를 쓴다). 다 썼으면 false */
  spendFishingCast: () => boolean;
  /** 오늘 낚시 티켓을 이미 샀는지 */
  boughtFishingTicket: () => boolean;
  /** 낚시 티켓을 산다 (돈을 낸다, 하루 한 번). 오늘 던질 횟수가 FISHING.ticket.casts 만큼 늘어난다 */
  buyFishingTicket: () => boolean;
  /** 잡은 물고기를 가방에 넣고 도감에 올린다. 처음 잡은 물고기면 true */
  catchFish: (fish: FishId) => boolean;
  /** 잡화 낚싯대를 산다 (돈을 낸다). 이미 있으면 true */
  buyRod: (rod: RodId) => boolean;
  hasRod: (rod: RodId) => boolean;
  /** 가진 낚싯대 중 하나를 쓴다. null 이면 기본 낚싯대 */
  equipRod: (rod: RodId | null) => void;
}

export const createFishingSlice: GameSlice<FishingSlice> = (set, get) => ({
  fishDex: {},
  fishingDay: { date: null, casts: 0 },
  equippedRod: null,

  fishingCastsLeft: () => {
    const { date, casts, extra } = get().fishingDay;
    const today = date === todayKey();
    return Math.max(0, FISHING.castsPerDay + (today ? (extra ?? 0) : 0) - (today ? casts : 0));
  },

  boughtFishingTicket: () => {
    const { date, extra } = get().fishingDay;
    return date === todayKey() && (extra ?? 0) > 0;
  },

  buyFishingTicket: () => {
    if (get().boughtFishingTicket()) return false;
    if (!get().spendMoney(FISHING.ticket.price)) return false;
    const today = todayKey();
    set((s) => ({
      fishingDay: {
        date: today,
        casts: s.fishingDay.date === today ? s.fishingDay.casts : 0,
        extra: FISHING.ticket.casts,
      },
    }));
    return true;
  },

  spendFishingCast: () => {
    if (get().fishingCastsLeft() <= 0) return false;
    const today = todayKey();
    set((s) => ({
      fishingDay:
        s.fishingDay.date === today
          ? { ...s.fishingDay, casts: s.fishingDay.casts + 1 }
          : // 새 날: 어제 산 티켓 횟수는 넘어오지 않는다
            { date: today, casts: 1 },
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

  hasRod: (rod) => get().unlocked.includes(rodUnlockKey(rod)),

  buyRod: (rod) => {
    if (get().hasRod(rod)) return true;
    if (!get().spendMoney(ROD_BY_ID[rod].price)) return false;
    set((s) => ({ unlocked: [...new Set([...s.unlocked, rodUnlockKey(rod)])] }));
    return true;
  },

  equipRod: (rod) => {
    if (rod && !get().hasRod(rod)) return;
    set({ equippedRod: rod });
  },
});
