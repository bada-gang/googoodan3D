/**
 * 낚시 한 번의 진행 (저장하지 않는다). 3D 연못(찌 · 낚싯대 움직임)과 React 낚시 창이 같이 본다.
 *
 *   idle → casting(찌 던지기) → waiting(입질 기다리기) → bite(막대 멈추기 게임)
 *        → reeling(끌어올리기) → caught(잡은 물고기 카드) → idle
 *                              ↘ escaped(놓침) → idle
 *
 * 문제 풀기와 오늘 횟수 쓰기는 던지기 전에 연못(world/scenes/town/FishingSpot)이 한다.
 * 잡은 물고기를 가방 · 도감에 넣는 것은 게임 스토어(fishingSlice)가 한다.
 */
import { create } from 'zustand';
import { FISHING, isFishId, rollFish } from '@/config/fishing';
import type { FishId } from '@/types/game';
import { audio } from '@/audio/sfx';
import { useGameStore } from './gameStore';

export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'caught' | 'escaped';

interface FishingState {
  phase: FishingPhase;
  /** 지금 단계가 시작된 때 (performance.now) — 3D 연출이 시간을 잰다 */
  phaseAt: number;
  /** 찌가 떨어질 자리 (바닥 좌표) */
  target: { x: number; z: number };
  /** 문 물고기 (bite 부터) */
  fish: FishId | null;
  /** 이번에 잡은 물고기가 도감에 처음 오른 것인지 */
  firstTime: boolean;

  /** 찌를 던진다 (문제를 맞히고 오늘 횟수를 쓴 뒤에 부른다) */
  start: (target: { x: number; z: number }) => void;
  /** 막대를 멈췄다. 칸 안에서 멈췄으면 hit */
  reel: (hit: boolean) => void;
  /** 잡은 물고기 카드를 닫는다 */
  finish: () => void;
  /** 그만두기 (던진 횟수는 돌려주지 않는다) */
  cancel: () => void;
}

let timer: number | undefined;

/** 개발 서버에서만: 주소에 ?dev-fish=crown 처럼 붙이면 늘 그것이 문다 (막대 빠르기 시험용) */
const DEV_FISH = (() => {
  if (!import.meta.env.DEV || typeof location === 'undefined') return null;
  const id = new URLSearchParams(location.search).get('dev-fish');
  return id && isFishId(id) ? id : null;
})();

function later(seconds: number, run: () => void): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(run, seconds * 1000);
}

export const useFishing = create<FishingState>()((set, get) => {
  const go = (phase: FishingPhase, extra: Partial<FishingState> = {}) =>
    set({ phase, phaseAt: performance.now(), ...extra });

  return {
    phase: 'idle',
    phaseAt: 0,
    target: { x: 0, z: 0 },
    fish: null,
    firstTime: false,

    start: (target) => {
      if (get().phase !== 'idle') return;
      go('casting', { target, fish: null, firstTime: false });
      audio.play('tap');
      later(FISHING.castSeconds, () => {
        go('waiting');
        const wait = FISHING.biteMinSeconds + Math.random() * (FISHING.biteMaxSeconds - FISHING.biteMinSeconds);
        later(wait, () => {
          go('bite', { fish: DEV_FISH ?? rollFish() });
          audio.play('place');
        });
      });
    },

    reel: (hit) => {
      const { phase, fish } = get();
      if (phase !== 'bite' || !fish) return;
      if (!hit) {
        go('escaped');
        audio.play('wrong');
        later(FISHING.escapeSeconds, () => go('idle', { fish: null }));
        return;
      }
      go('reeling');
      later(FISHING.reelSeconds, () => {
        const firstTime = useGameStore.getState().catchFish(fish);
        go('caught', { firstTime });
        audio.play('harvest');
      });
    },

    finish: () => {
      if (get().phase !== 'caught') return;
      go('idle', { fish: null, firstTime: false });
    },

    cancel: () => {
      window.clearTimeout(timer);
      go('idle', { fish: null, firstTime: false });
    },
  };
});

/** 낚시 중인지 (걷기 · 다른 버튼을 막는다) */
export function isFishing(): boolean {
  return useFishing.getState().phase !== 'idle';
}
