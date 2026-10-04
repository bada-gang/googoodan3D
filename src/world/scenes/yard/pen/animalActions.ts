/**
 * 동물 돌보기 규칙과 동물 위치 공유.
 * 먹이 주기 · 생산물 받기마다 문제를 하나 푼다 — 2D 판 YardScene 과 같다. (명세 78)
 */
import { PALETTE } from '@/config/artTokens';
import { ANIMAL_SPECIES } from '@/config/catalog';
import type { InteractionPrompt } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance } from '@/types/game';
import { audio } from '@/audio/sfx';
import { burstCareStars, floatText } from '../../../effects/effects';
import { askMath, awardExperience, toast } from '../../../gameplay/gameplay';
import { ANIMAL_BODY, INNER_MARGIN, PEN_MIN_X, PEN_MIN_Z, pen } from './penLayout';

/* ------------------------------- 움직임 상태 ------------------------------- */

export interface AnimalMotion {
  x: number;
  z: number;
  facing: number;
  target: { x: number; z: number } | null;
  /** 다음 걸음을 시작할 시각 (초) */
  restUntil: number;
  /** 몸짓 */
  emote: { kind: 'eat' | 'happy'; startedAt: number } | null;
  walkPhase: number;
  moving: boolean;
}

/** 동물 위치. 상호작용 거리 · 느낌표 · 서로 피하기에 쓴다 */
export const motions = new Map<string, AnimalMotion>();

export function randomSpot(): { x: number; z: number } {
  return {
    x: PEN_MIN_X + INNER_MARGIN + 0.8 + Math.random() * (pen.width - INNER_MARGIN * 2 - 0.8),
    z: PEN_MIN_Z + INNER_MARGIN + Math.random() * (pen.depth - INNER_MARGIN * 2),
  };
}

/** 처음 자리는 저장된 spot(0~1)으로 정한다. 다시 들어와도 비슷한 곳에 있다 */
export function startSpot(animal: AnimalInstance, index: number): { x: number; z: number } {
  const t = (animal.spot + index * 0.37) % 1;
  return {
    x: PEN_MIN_X + INNER_MARGIN + 0.8 + t * (pen.width - INNER_MARGIN * 2 - 0.8),
    z: PEN_MIN_Z + INNER_MARGIN + ((index * 0.53 + 0.2) % 1) * (pen.depth - INNER_MARGIN * 2),
  };
}

/* ------------------------------- 행동 규칙 ------------------------------- */

function animalById(animalId: string): AnimalInstance | undefined {
  return useGameStore.getState().animals.find((a) => a.id === animalId);
}

export function animalPrompts(animalId: string): InteractionPrompt[] {
  const animal = animalById(animalId);
  if (!animal) return [];
  const def = ANIMAL_SPECIES[animal.species];
  if (animal.produceReady) {
    return [
      {
        id: 'collect',
        label: `${def.produceName} 받기`,
        enabled: true,
        highlight: true,
        // 생산물 이름에 동물 이름을 또 붙이면 "양 양털 받기" 처럼 겹친다. 부제로 둔다.
        hint: def.name,
      },
    ];
  }
  const feed = useGameStore.getState().itemCount('feed');
  return [
    {
      id: 'feed',
      label: `${def.name} 먹이 주기`,
      enabled: feed > 0,
      hint: feed > 0 ? `돌봄 ${animal.care} / ${def.careGoal} · 먹이 ${feed}개` : '먹이가 없어요. 농장 가게에서 사 오세요',
    },
  ];
}

function emote(animalId: string, kind: 'eat' | 'happy'): void {
  const motion = motions.get(animalId);
  if (motion) motion.emote = { kind, startedAt: performance.now() };
}

function above(animalId: string, height: number): { x: number; y: number; z: number } {
  const motion = motions.get(animalId);
  return { x: motion?.x ?? pen.center.x, y: height, z: motion?.z ?? pen.center.z };
}

export function handleAnimalAction(animalId: string, actionId: string): void {
  const animal = animalById(animalId);
  if (!animal) return;
  const def = ANIMAL_SPECIES[animal.species];
  const body = ANIMAL_BODY[animal.species];

  if (actionId === 'feed') {
    askMath('ANIMAL', `${def.name}에게 먹이를 줄까요?`, (math) => {
      if (!useGameStore.getState().feedAnimal(animalId)) return;
      audio.play('animal', animalById(animalId)?.species);
      emote(animalId, 'eat');
      burstCareStars(above(animalId, body.marker * 0.5), 6);
      floatText(above(animalId, body.marker), '냠냠', PALETTE.accentPink);
      if (animalById(animalId)?.produceReady) {
        toast(`${def.produceName}이(가) 준비됐어요!`, 'reward');
        burstCareStars(above(animalId, body.marker * 0.7), 9);
      }
      awardExperience('ANIMAL', math);
    });
    return;
  }

  if (actionId === 'collect') {
    askMath('ANIMAL', `${def.produceName}을(를) 받아 볼까요?`, (math) => {
      const result = useGameStore.getState().collectProduce(animalId, math.wrongAttempts);
      if (!result) return;
      // 다 틀려도 최소 1개는 받는다 (PRODUCE_BY_ATTEMPTS)
      audio.play('harvest');
      emote(animalId, 'happy');
      burstCareStars(above(animalId, body.marker * 0.7), 6 + result.count * 4);
      floatText(above(animalId, body.marker + 0.4), `${def.produceName} +${result.count}`, PALETTE.goldShade);
      toast(`${def.produceName} ${result.count}개를 얻었어요`, 'reward');
      awardExperience('ANIMAL', math);
    });
  }
}
