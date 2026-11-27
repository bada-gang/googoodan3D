/**
 * 개발 중(또는 배포본에서 ?debug) 쓰는 콘솔 손잡이와 개발용 주소 옵션. WorldRoot 가 처음 뜰 때 한 번 부른다.
 *   ?dev-furniture  가구 · 장식을 하나씩 가방에
 *   ?dev-animals    동물을 한 마리씩
 *   ?dev-ready      밭마다 열매, 동물 생산물 준비 (저장된 상태를 실제로 바꾼다 — 시험 학생으로만)
 */
import { gameEvents } from '@/bridge/eventBus';
import { FURNITURE } from '@/config/catalog';
import { useGameStore } from '@/state/gameStore';
import { decorateFloorHover, decorateFloorTap, useDecorate } from '../gameplay/decorate';
import { input, obstacles, player } from '../state/runtime';
import { useWorldScene } from '../state/scenes';

/** 배포본에서도 주소에 ?debug 를 붙이면 콘솔 손잡이(__googooWorld · __googooR3f)를 열어 둔다 (태블릿 성능 점검용) */
export const DEBUG_HANDLES = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

export function setupDevTools(): void {
  // 개발 중(또는 배포본에서 ?debug) 콘솔에서 캐릭터 위치·입력을 들여다볼 수 있게 해 둔다. 성능 측정에도 쓴다
  if (import.meta.env.DEV || DEBUG_HANDLES) {
    (window as unknown as { __googooWorld?: unknown }).__googooWorld = {
      player,
      input,
      obstacles,
      // 게임이 실제로 쓰는 것과 같은 것 (콘솔에서 import 하면 개발 서버가 다른 사본을 줄 수 있다)
      store: useGameStore,
      scene: useWorldScene,
      decorate: { tap: decorateFloorTap, hover: decorateFloorHover, state: useDecorate },
      events: gameEvents,
    };
  }
  if (import.meta.env.DEV) {
    // 주소에 ?dev-animals 를 붙이면 동물을 한 마리씩 넣어 준다 (시장이 생기기 전 시험용)
    // ?dev-furniture 면 가구 · 장식을 하나씩 가방에 넣어 준다 (시장이 생기기 전 꾸미기 시험용)
    if (new URLSearchParams(window.location.search).has('dev-furniture')) {
      const store = useGameStore.getState();
      for (const item of FURNITURE) {
        if (store.itemCount(item.id) === 0) useGameStore.getState().addItem(item.id);
      }
    }
    if (new URLSearchParams(window.location.search).has('dev-animals')) {
      const store = useGameStore.getState();
      for (const species of ['chicken', 'goat', 'sheep', 'cow', 'bee'] as const) {
        if (!store.animals.some((a) => a.species === species)) useGameStore.getState().addAnimal(species);
      }
    }
    // ?dev-ready 면 밭마다 열매가 열리고(빈 밭엔 사과나무) 동물은 생산물이 준비된다 (수확 소리 · 연출 시험용)
    if (new URLSearchParams(window.location.search).has('dev-ready')) {
      useGameStore.setState((s) => ({
        plots: s.plots.map((plot) => ({
          ...plot,
          species: plot.species ?? 'apple',
          stage: 'fruiting',
          fruitCount: Math.max(plot.fruitCount, 5),
        })),
        animals: s.animals.map((animal) => ({ ...animal, produceReady: true })),
      }));
    }
  }
}
