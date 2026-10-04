/** 밭: 씨앗 심기, 물 주어 키우기, 열매 따기. */
import { MAX_HARVESTS_PER_TREE, NEXT_STAGE, harvestAmount } from '@/config/balance';
import { TREE_SPECIES, seedIdOf } from '@/config/catalog';
import type { FarmPlot, TreeSpeciesId } from '@/types/game';
import { createPlots } from './saveData';
import type { GameSlice } from './types';

export interface HarvestResult {
  species: TreeSpeciesId;
  /** 실제로 딴 개수. 세 번 틀리면 0 일 수 있다. */
  count: number;
  /** 이 나무를 지금까지 딴 횟수 */
  harvestCount: number;
  /** 앞으로 더 딸 수 있는 횟수 */
  remaining: number;
  /** 다 따서 나무가 사라졌는지 */
  finished: boolean;
}

export interface FarmSlice {
  plots: FarmPlot[];

  plantSeed: (plotId: string, species: TreeSpeciesId) => boolean;
  /** 물을 하나 써서 나무를 키운다. 물이 없으면 false. */
  growPlot: (plotId: string) => boolean;
  /** @param wrongAttempts 정답까지 틀린 횟수. 적을수록 많이 딴다. */
  harvestPlot: (plotId: string, wrongAttempts?: number) => HarvestResult | null;
}

export const createFarmSlice: GameSlice<FarmSlice> = (set, get) => ({
  plots: createPlots(),

  plantSeed: (plotId, species) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot || plot.species) return false;
    if (!get().consumeItem(seedIdOf(species))) return false;
    set((s) => ({
      plots: s.plots.map((p) =>
        p.id === plotId
          ? { ...p, species, stage: 'seed', growthPoints: 0, fruitCount: 0 }
          : p,
      ),
    }));
    return true;
  },

  growPlot: (plotId) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot?.species) return false;
    // 물을 하나 쓴다. 없으면 키울 수 없다.
    if (!get().consumeItem('water')) return false;
    const species = TREE_SPECIES[plot.species];
    const needed = species.growthPerStage;
    const nextPoints = plot.growthPoints + 1;

    if (nextPoints < needed) {
      set((s) => ({
        plots: s.plots.map((p) => (p.id === plotId ? { ...p, growthPoints: nextPoints } : p)),
      }));
      return true;
    }

    const nextStage = NEXT_STAGE[plot.stage];
    if (!nextStage) return false;
    set((s) => ({
      plots: s.plots.map((p) =>
        p.id === plotId
          ? {
              ...p,
              stage: nextStage,
              growthPoints: 0,
              fruitCount: nextStage === 'fruiting' ? species.yield : p.fruitCount,
            }
          : p,
      ),
    }));
    return true;
  },

  harvestPlot: (plotId, wrongAttempts = 0) => {
    const plot = get().plots.find((p) => p.id === plotId);
    if (!plot?.species || plot.stage !== 'fruiting' || plot.fruitCount <= 0) return null;
    const species = TREE_SPECIES[plot.species];
    // 한 번에 맞힐수록 많이 딴다. 나무에 달린 것보다 많이 딸 수는 없다.
    const count = Math.min(plot.fruitCount, harvestAmount(wrongAttempts));
    if (count > 0) get().addItem(species.fruitId, count);

    const harvestCount = plot.harvestCount + 1;
    // 다 딴 나무는 밭에서 사라진다. 그 밖에는 큰 나무로 돌아가 다시 열매를 맺는다.
    const finished = harvestCount >= MAX_HARVESTS_PER_TREE;

    set((s) => ({
      plots: s.plots.map((p) =>
        p.id !== plotId
          ? p
          : finished
            ? { ...p, species: null, stage: 'seed', growthPoints: 0, fruitCount: 0, harvestCount: 0 }
            : { ...p, stage: 'mature', growthPoints: 0, fruitCount: 0, harvestCount },
      ),
    }));

    return {
      species: plot.species,
      count,
      harvestCount,
      remaining: finished ? 0 : MAX_HARVESTS_PER_TREE - harvestCount,
      finished,
    };
  },
});
