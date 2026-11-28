/**
 * 저장 데이터 모양: 새 게임의 처음 상태, 오래된 저장본 메꾸기(migrate).
 * 저장 자체는 persistence.ts 가 맡는다. 여기는 데이터 모양만 다룬다.
 */
import { START_INVENTORY, START_MONEY } from '@/config/balance';
import { FURNITURE_BY_ID, SELL_PRICE, SUPPLIES, TREE_SPECIES, speciesOfSeed } from '@/config/catalog';
import { isFishId } from '@/config/fishing';
import { isRodId } from '@/config/rods';
import { PLOT_COUNT } from '@/config/layout';
import type { FarmPlot, GameSaveData, PlayerProfile } from '@/types/game';

export const SCHEMA_VERSION = 1;

export function createPlots(): FarmPlot[] {
  return Array.from({ length: PLOT_COUNT }, (_, index) => ({
    id: `plot_${index}`,
    index,
    species: null,
    stage: 'seed' as const,
    growthPoints: 0,
    fruitCount: 0,
    harvestCount: 0,
  }));
}

/** 오늘 날짜 (기기 시간 기준, YYYY-MM-DD) */
export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialSave(profile: PlayerProfile): GameSaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile,
    money: START_MONEY,
    experience: 0,
    level: 1,
    unlocked: [],
    farm: { plots: createPlots() },
    animals: [],
    inventory: { ...START_INVENTORY },
    home: { wallpaperId: 'wall_cream', floorId: 'floor_wood', placed: [] },
    yard: { placed: [] },
    records: {},
    chests: 0,
    miniGameScores: [],
    lastMiniGameRewardDate: null,
    fishDex: {},
    fishingDay: { date: null, casts: 0 },
    equippedRod: null,
  };
}

/**
 * 밭이 12칸(아래쪽 밭 4칸 × 2줄)이던 저장본 → 지금 8칸. 새 번호 i 에는 예전 LEGACY_12_PLOTS[i] 번 밭이 온다.
 * 아래쪽 밭 양 끝 줄(예전 2 · 5 · 6 · 9번)은 없어졌다 — 거기 있던 나무는 사라진다.
 */
const LEGACY_12_PLOTS = [0, 1, 7, 3, 4, 8, 10, 11];

/** 지금 게임에 남아 있는 아이템인지 (없어진 씨앗·열매를 걸러낸다) */
function isKnownItem(itemId: string): boolean {
  if (itemId in SUPPLIES) return true;
  if (itemId in SELL_PRICE) return true;
  if (itemId in FURNITURE_BY_ID) return true;
  if (itemId.startsWith('seed_')) return speciesOfSeed(itemId) !== null;
  return false;
}

/**
 * 저장 데이터가 오래되었거나 손상된 경우를 메꾼다.
 *
 * - 밭 칸 수가 늘면 기존 밭은 두고 빈 밭만 추가한다 (키우던 나무를 잃지 않는다)
 * - 밭이 12칸이던 저장본은 남은 8칸 자리로 옮긴다 (LEGACY_12_PLOTS)
 * - 없어진 나무 종류가 심겨 있으면 그 밭만 비운다
 * - 없어진 아이템은 가방에서 뺀다
 */
export function migrate(save: GameSaveData, profile: PlayerProfile): GameSaveData {
  const base = createInitialSave(profile);
  const raw = Array.isArray(save.farm?.plots) ? save.farm.plots : [];
  const saved = raw.length === 12 ? LEGACY_12_PLOTS.map((old) => raw[old]) : raw;

  const plots = base.farm.plots.map((fresh, index) => {
    const old = saved[index];
    if (!old) return fresh;
    // 더 이상 없는 나무가 심겨 있으면 빈 밭으로 되돌린다.
    if (old.species && !(old.species in TREE_SPECIES)) return fresh;
    // harvestCount 가 없던 시절의 저장 데이터는 0 부터 센다.
    return { ...fresh, ...old, harvestCount: old.harvestCount ?? 0, id: fresh.id, index };
  });

  const inventory = Object.fromEntries(
    Object.entries(save.inventory ?? {}).filter(
      ([itemId, count]) => count > 0 && isKnownItem(itemId),
    ),
  );

  return {
    ...base,
    ...save,
    schemaVersion: SCHEMA_VERSION,
    profile,
    farm: { plots },
    home: { ...base.home, ...(save.home ?? {}) },
    yard: { ...base.yard, ...(save.yard ?? {}) },
    inventory,
    animals: Array.isArray(save.animals) ? save.animals : [],
    records: save.records ?? {},
    chests: save.chests ?? 0,
    miniGameScores: Array.isArray(save.miniGameScores) ? save.miniGameScores : [],
    lastMiniGameRewardDate: save.lastMiniGameRewardDate ?? null,
    // 낚시가 생기기 전 저장본에는 없다. 없어진 물고기 종류는 도감에서 뺀다
    fishDex: Object.fromEntries(Object.entries(save.fishDex ?? {}).filter(([id]) => isFishId(id))),
    fishingDay: save.fishingDay ?? base.fishingDay,
    // 낚싯대가 생기기 전 저장본에는 없다
    equippedRod: isRodId(save.equippedRod) ? save.equippedRod : null,
  };
}
