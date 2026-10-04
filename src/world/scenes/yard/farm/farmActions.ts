/**
 * 밭 행동 규칙: 씨앗 심기 → 물 주기(5단계 성장) → 수확. 행동마다 곱셈 문제를 하나 푼다. (명세 78)
 * 규칙은 2D 판 YardScene 과 같다. 무엇을 할 수 있는지(안내 버튼)와 했을 때 일어나는 일을 여기서 정한다.
 */
import { PALETTE } from '@/config/artTokens';
import { MAX_HARVESTS_PER_TREE, STAGE_LABEL } from '@/config/balance';
import { TREE_SPECIES, seedIdOf } from '@/config/catalog';
import { plotPosition } from '@/config/layout';
import { gameEvents } from '@/bridge/eventBus';
import type { InteractionPrompt } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { FarmPlot as FarmPlotData, TreeSpeciesId, TreeStage } from '@/types/game';
import { audio } from '@/audio/sfx';
import { burstStars, floatText } from '../../../effects/effects';
import { spawnParticles } from '../../../effects/particles';
import { askMath, awardExperience, toast } from '../../../gameplay/gameplay';

/** 물방울이 떨어지기 시작하는 높이 (물 주기 전 단계의 나무 크기) */
const WATER_HEIGHT: Record<TreeStage, number> = { seed: 0.9, sprout: 1.1, sapling: 2.0, mature: 3.1, fruiting: 3.1 };

/* ------------------------------- 행동 규칙 ------------------------------- */

function plotById(plotId: string): FarmPlotData | undefined {
  return useGameStore.getState().plots.find((p) => p.id === plotId);
}

function ownedSeeds(): TreeSpeciesId[] {
  const inventory = useGameStore.getState().inventory;
  return (Object.keys(TREE_SPECIES) as TreeSpeciesId[]).filter(
    (species) => (inventory[seedIdOf(species)] ?? 0) > 0,
  );
}

export function plotPrompts(plotId: string): InteractionPrompt[] {
  const plot = plotById(plotId);
  if (!plot) return [];

  if (!plot.species) {
    const seeds = ownedSeeds();
    return [
      {
        id: 'plant',
        label: '씨앗 심기',
        enabled: seeds.length > 0,
        hint: seeds.length === 0 ? '농장 가게에서 씨앗을 사 오세요' : undefined,
      },
    ];
  }

  if (plot.stage === 'fruiting') {
    const left = MAX_HARVESTS_PER_TREE - plot.harvestCount;
    return [
      {
        id: 'harvest',
        // 밭이 여러 칸이라 어떤 나무 앞인지 버튼에서 바로 보여 준다
        label: `${TREE_SPECIES[plot.species].name} 수확하기`,
        enabled: true,
        highlight: true,
        // 나무가 곧 사라진다는 걸 미리 알려 준다. (요청 3)
        hint: left <= 1 ? '이번이 마지막 수확이에요' : `앞으로 ${left}번 딸 수 있어요`,
      },
    ];
  }

  const water = useGameStore.getState().itemCount('water');
  return [
    {
      id: 'grow',
      label: `${TREE_SPECIES[plot.species].name} 물 주기`,
      enabled: water > 0,
      hint: water > 0 ? `${STAGE_LABEL[plot.stage]} · 물 ${water}개` : '물이 없어요. 농장 가게에서 사 오세요',
    },
  ];
}

/** 연출 위치 (밭 가운데 위) */
function above(plotIndex: number, height: number): { x: number; y: number; z: number } {
  const { x, z } = plotPosition(plotIndex);
  return { x, y: height, z };
}

export function plantWithMath(plotId: string, species: TreeSpeciesId): void {
  const plot = plotById(plotId);
  if (!plot || plot.species) return;
  const def = TREE_SPECIES[species];
  askMath('PLANT', `${def.seedName}을 심어 볼까요?`, (math) => {
    if (!useGameStore.getState().plantSeed(plotId, species)) return;
    burstStars(above(plot.index, 0.4), 6);
    audio.play('place');
    floatText(above(plot.index, 1.2), `${def.name} 심기`, PALETTE.leafShade);
    awardExperience('PLANT', math);
  });
}

export function handlePlotAction(plotId: string, actionId: string): void {
  const plot = plotById(plotId);
  if (!plot) return;

  if (actionId === 'plant') {
    const seeds = ownedSeeds();
    if (seeds.length === 0) return;
    if (seeds.length === 1) {
      plantWithMath(plotId, seeds[0]);
      return;
    }
    gameEvents.emit('seedpicker:open', { plotId });
    return;
  }

  const species = plot.species;
  if (!species) return;
  const def = TREE_SPECIES[species];

  if (actionId === 'grow') {
    askMath('GROW', `${def.name}를 키워 볼까요?`, (math) => {
      const before = plotById(plotId)?.stage;
      // 물이 없으면 아무 일도 일어나지 않는다.
      if (!useGameStore.getState().growPlot(plotId)) {
        toast('물이 없어요. 농장 가게에서 사 오세요', 'warn');
        return;
      }
      const after = plotById(plotId)?.stage;
      // 물뿌리개로 준 물이 나무 위에서 떨어진다 (나무 크기에 맞춰)
      spawnParticles('water', above(plot.index, WATER_HEIGHT[before ?? 'seed']), 14);
      if (before !== after) {
        audio.play('harvest');
        // 열매가 맺히면 글자 없이 별만 터뜨린다 (안내 문구 · "열매 맺음" 글자는 사용자 요청으로 뺐다)
        if (after === 'fruiting') burstStars(above(plot.index, 2.4), 12);
        else floatText(above(plot.index, 2.2), STAGE_LABEL[after ?? 'sprout'], PALETTE.leafShade);
      } else {
        floatText(above(plot.index, 1.8), '쑥쑥!', PALETTE.leafShade);
      }
      awardExperience('GROW', math);
    });
    return;
  }

  if (actionId === 'harvest') {
    askMath('HARVEST', `${def.fruitName}를 따 볼까요?`, (math) => {
      const result = useGameStore.getState().harvestPlot(plotId, math.wrongAttempts);
      if (!result) return;
      // 다 틀려도 최소 1개는 딴다 (HARVEST_BY_ATTEMPTS) — 빈손으로 끝나는 경우는 없다.
      audio.play('harvest');
      burstStars(above(plot.index, 2.4), 6 + result.count * 3);
      floatText(above(plot.index, 3), `${def.fruitName} +${result.count}`, PALETTE.goldShade);
      if (result.finished) {
        // 다 딴 나무는 밭에서 사라진다. (요청 3)
        toast(`${def.name}가 열매를 다 맺었어요. 밭이 비었으니 새로 심어 보세요`, 'info');
      } else {
        toast(`${def.fruitName} ${result.count}개를 얻었어요`, 'reward');
      }
      awardExperience('HARVEST', math);
    });
  }
}
