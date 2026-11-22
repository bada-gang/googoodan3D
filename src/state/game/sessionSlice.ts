/** 세션: 학생이 들어오고 나가기, 저장본 불러오기, 저장할 데이터 만들기. */
import type { GameSaveData, PlayerProfile } from '@/types/game';
import { createEmptyLearningStats } from '@/types/learning';
import { repositories } from '@/data';
import { SCHEMA_VERSION, createInitialSave, migrate } from './saveData';
import type { GameSlice } from './types';

export interface SessionSlice {
  status: 'empty' | 'loading' | 'ready';
  profile: PlayerProfile | null;
  selectedTables: number[];

  beginSession: (profile: PlayerProfile, tables: number[]) => Promise<void>;
  leaveSession: () => void;
  toSaveData: () => GameSaveData | null;
}

/**
 * 이번 세션에서 자동 저장을 막을지. 저장본을 못 읽은 채로 시작한 판이 여기 해당한다.
 * 그대로 저장하면 학생의 기존 진행도를 새 게임으로 덮어쓰게 된다.
 */
let savingBlocked = false;

export function isSavingBlocked(): boolean {
  return savingBlocked;
}

export const createSessionSlice: GameSlice<SessionSlice> = (set, get) => ({
  status: 'empty',
  profile: null,
  selectedTables: [],

  beginSession: async (profile, tables) => {
    set({ status: 'loading' });
    const repos = repositories();

    // 저장본을 못 읽었을 때 시작 화면에 학생을 가둬 두지 않는다.
    // 대신 그 세션은 저장하지 않는다 — 새 게임으로 기존 진행도를 덮어쓰면 안 되니까.
    let loadFailed = false;
    const [saved, savedStats] = await Promise.all([
      repos.gameState.load(profile.id).catch((error) => {
        loadFailed = true;
        console.error('[gameStore] 저장본을 불러오지 못해 이번 판은 저장하지 않습니다.', error);
        return null;
      }),
      repos.learning.loadStats(profile.id).catch(() => null),
    ]);
    savingBlocked = loadFailed;

    const save = saved ? migrate(saved, profile) : createInitialSave(profile);
    await repos.player.touchLastPlayed(profile.id).catch(() => undefined);

    set({
      status: 'ready',
      profile,
      selectedTables: [...tables].sort((a, b) => a - b),
      money: save.money,
      experience: save.experience,
      level: save.level,
      unlocked: save.unlocked,
      plots: save.farm.plots,
      animals: save.animals,
      inventory: save.inventory,
      home: save.home,
      yard: save.yard,
      records: save.records,
      chests: save.chests,
      miniGameScores: save.miniGameScores,
      lastMiniGameRewardDate: save.lastMiniGameRewardDate,
      fishDex: save.fishDex,
      fishingDay: save.fishingDay,
      stats: savedStats ?? createEmptyLearningStats(),
      recentQuestions: [],
      questionCounter: 0,
    });
  },

  leaveSession: () => {
    set({ status: 'empty', profile: null, selectedTables: [] });
  },

  toSaveData: () => {
    const s = get();
    if (!s.profile) return null;
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: s.profile,
      money: s.money,
      experience: s.experience,
      level: s.level,
      unlocked: s.unlocked,
      farm: { plots: s.plots },
      animals: s.animals,
      inventory: s.inventory,
      home: s.home,
      yard: s.yard,
      records: s.records,
      chests: s.chests,
      miniGameScores: s.miniGameScores,
      lastMiniGameRewardDate: s.lastMiniGameRewardDate,
      fishDex: s.fishDex,
      fishingDay: s.fishingDay,
    };
  },
});
