/**
 * 개발용 ?dev-all: 지금 고른 학생을 "전부 있음"으로 채운다 (새 기능을 한꺼번에 시험할 때).
 *
 *  - 10레벨(귤 · 키위 · 꿀벌까지 해금), 돈 100,000원
 *  - 벽지 · 바닥재 전부, 잡화 낚싯대 3개 전부 (쓰는 것은 기본 낚싯대)
 *  - 모든 동물을 최대 마릿수까지 (꿀벌 3통 포함)
 *  - 밭 8칸에 열매 맺은 나무 (새 나무부터)
 *  - 물 · 먹이 50개, 씨앗 종류마다 2개, 가구 · 장식 하나씩, 물고기 · 보물 하나씩(도감에도)
 *
 * 학급 서버(Firebase)에 저장되는 개발 서버(5173)에서는 하지 않는다 — 진짜 학생 기록을 바꾸면 안 된다.
 * 오프라인 서버(npm run dev:offline, 5174)에서만 채운다.
 */
import { ANIMAL_LIST, FLOORS, FURNITURE, TREE_LIST, WALLPAPERS, seedIdOf } from '@/config/catalog';
import { RODS, rodUnlockKey } from '@/config/rods';
import { FISH_ORDER } from '@/config/fishing';
import { UNLOCKS } from '@/config/balance';
import { storageMode } from '@/data';
import { useGameStore } from '@/state/gameStore';
import { todayKey } from '@/state/game/saveData';
import type { TreeSpeciesId } from '@/types/game';
import { toast } from '../gameplay/gameplay';

/** 밭 8칸에 심을 나무 (새 나무 · 비싼 나무부터) */
const PLOT_TREES: TreeSpeciesId[] = ['tangerine', 'kiwi', 'blueberry', 'banana', 'persimmon', 'grape', 'cherry', 'apple'];

export function fillEverything(): void {
  if (storageMode() !== 'local') {
    console.warn('?dev-all 은 오프라인 서버(5174)에서만 씁니다. 학급 서버에 저장되는 곳에서는 하지 않았습니다.');
    toast('?dev-all 은 오프라인 서버(5174)에서만 돼요', 'warn');
    return;
  }
  const level = 10;
  const today = todayKey();
  useGameStore.setState((s) => ({
    level,
    experience: 0,
    money: 100000,
    unlocked: [
      ...new Set([
        ...s.unlocked,
        ...UNLOCKS.filter((u) => u.level <= level && u.level > 1).map((u) => `level_${u.level}`),
        ...[...WALLPAPERS, ...FLOORS].map((surface) => `surface_${surface.id}`),
        ...RODS.map((rod) => rodUnlockKey(rod.id)),
      ]),
    ],
    plots: s.plots.map((plot, i) => ({
      ...plot,
      species: PLOT_TREES[i % PLOT_TREES.length],
      stage: 'fruiting',
      growthPoints: 0,
      fruitCount: 4,
      harvestCount: 0,
    })),
    fishDex: Object.fromEntries(FISH_ORDER.map((id) => [id, s.fishDex[id] ?? { caught: 1, firstCaughtAt: today }])),
  }));

  const store = useGameStore.getState();
  for (const animal of ANIMAL_LIST) {
    let owned = useGameStore.getState().animals.filter((a) => a.species === animal.id).length;
    while (owned < animal.maxCount) {
      store.addAnimal(animal.id);
      owned += 1;
    }
  }
  const topUp = (id: string, count: number) => {
    const have = useGameStore.getState().itemCount(id);
    if (have < count) useGameStore.getState().addItem(id, count - have);
  };
  topUp('water', 50);
  topUp('feed', 50);
  for (const tree of TREE_LIST) topUp(seedIdOf(tree.id), 2);
  for (const item of FURNITURE) topUp(item.id, 1);
  for (const fish of FISH_ORDER) topUp(fish, 1);
  toast('시험용: 전부 채웠어요', 'reward');
}
