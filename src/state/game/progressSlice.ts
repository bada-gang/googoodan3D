/** 진행: 돈 · 경험치와 레벨 · 상자와 기록 · 열매 받기 게임 점수. */
import {
  EXP_BONUS,
  EXP_PER_CORRECT,
  MAX_LEVEL,
  MINIGAME_SCORE_KEEP,
  expToNextLevel,
  rollChest,
} from '@/config/balance';
import type { MiniGameScore } from '@/types/game';
import type { MathContext } from '@/types/learning';
import { todayKey } from './saveData';
import type { GameSlice } from './types';

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
}

/** 열매 받기 게임 한 판을 기록한 결과 */
export interface MiniGameRecordResult {
  /** 보관 중인 기록 안에서의 등수 (1부터). 기록에 못 들면 null */
  rank: number | null;
  scores: MiniGameScore[];
}

export interface ProgressSlice {
  money: number;
  experience: number;
  level: number;
  unlocked: string[];
  records: Record<string, number>;
  chests: number;
  /** 열매 받기 게임 기록 (점수 높은 순) */
  miniGameScores: MiniGameScore[];
  /** 상자 보상을 마지막으로 받은 날 (YYYY-MM-DD) */
  lastMiniGameRewardDate: string | null;

  /* ---- 재화 ---- */
  addMoney: (amount: number) => void;
  spendMoney: (amount: number) => boolean;
  gainExperience: (context: MathContext) => LevelUpResult;

  /* ---- 보상 ---- */
  addChest: (count?: number) => void;
  openChest: () => number | null;
  setRecord: (key: string, value: number) => void;

  /* ---- 열매 받기 게임 ---- */
  /** 오늘 상자를 아직 안 받았는지. 게임 자체는 몇 번이든 할 수 있다. */
  canClaimMiniGameReward: () => boolean;
  /** 상자를 받았다고 표시한다 (오늘 하루 소진) */
  claimMiniGameReward: () => void;
  /** 한 판 결과를 기록하고 등수를 돌려준다 */
  recordMiniGameScore: (score: number) => MiniGameRecordResult;
}

export const createProgressSlice: GameSlice<ProgressSlice> = (set, get) => ({
  money: 0,
  experience: 0,
  level: 1,
  unlocked: [],
  records: {},
  chests: 0,
  miniGameScores: [],
  lastMiniGameRewardDate: null,

  /* -------------------------------- 재화 -------------------------------- */

  addMoney: (amount) => set((s) => ({ money: Math.max(0, s.money + amount) })),

  spendMoney: (amount) => {
    if (get().money < amount) return false;
    set((s) => ({ money: s.money - amount }));
    return true;
  },

  gainExperience: (context) => {
    const gain = EXP_PER_CORRECT + (EXP_BONUS[context] ?? 0);
    let { level, experience } = get();
    experience += gain;
    let leveledUp = false;
    const gained: string[] = [];
    while (level < MAX_LEVEL && experience >= expToNextLevel(level)) {
      experience -= expToNextLevel(level);
      level += 1;
      leveledUp = true;
      gained.push(`level_${level}`);
    }
    set((s) => ({
      level,
      experience,
      unlocked: gained.length ? [...new Set([...s.unlocked, ...gained])] : s.unlocked,
    }));
    return { leveledUp, newLevel: level };
  },

  /* -------------------------------- 보상 -------------------------------- */

  addChest: (count = 1) => set((s) => ({ chests: s.chests + count })),

  openChest: () => {
    if (get().chests <= 0) return null;
    const reward = rollChest();
    set((s) => ({ chests: s.chests - 1, money: s.money + reward }));
    return reward;
  },

  setRecord: (key, value) =>
    set((s) => ({
      records: { ...s.records, [key]: Math.max(s.records[key] ?? 0, value) },
    })),

  /* ---------------------------- 열매 받기 게임 ---------------------------- */

  canClaimMiniGameReward: () => get().lastMiniGameRewardDate !== todayKey(),

  claimMiniGameReward: () => set({ lastMiniGameRewardDate: todayKey() }),

  recordMiniGameScore: (score) => {
    const entry: MiniGameScore = { score, playedAt: new Date().toISOString() };
    const kept = [...get().miniGameScores, entry]
      .sort((a, b) => b.score - a.score || a.playedAt.localeCompare(b.playedAt))
      .slice(0, MINIGAME_SCORE_KEEP);
    set({ miniGameScores: kept });

    const index = kept.findIndex((s) => s.playedAt === entry.playedAt && s.score === entry.score);
    return { rank: index >= 0 ? index + 1 : null, scores: kept };
  },
});
