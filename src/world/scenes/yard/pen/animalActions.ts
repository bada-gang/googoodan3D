/**
 * 동물 돌보기 규칙 (먹이 주기 · 생산물 받기). 걸어 다니기는 animalWander.ts.
 * 먹이 주기 · 생산물 받기마다 문제를 하나 푼다 — 2D 판 YardScene 과 같다. (명세 78)
 */
import { josa } from '@/config/josa';
import { PALETTE } from '@/config/artTokens';
import { ANIMAL_SPECIES } from '@/config/catalog';
import { ANIMAL_REST } from '@/config/balance';
import { restLeftMs } from './animalRest';
import type { InteractionPrompt } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance } from '@/types/game';
import { audio } from '@/audio/sfx';
import { burstStars, floatText } from '../../../effects/effects';
import { askMath, awardExperience, toast } from '../../../gameplay/gameplay';
import { ANIMAL_BODY, pen } from './penLayout';
import { motions } from './animalWander';

/* ------------------------------- 행동 규칙 ------------------------------- */

function animalById(animalId: string): AnimalInstance | undefined {
  return useGameStore.getState().animals.find((a) => a.id === animalId);
}

export function animalPrompts(animalId: string): InteractionPrompt[] {
  const animal = animalById(animalId);
  if (!animal) return [];
  const def = ANIMAL_SPECIES[animal.species];
  // 쉬는 중: 누를 수 없는 버튼 (ANIMAL_REST)
  const rest = restLeftMs(animal);
  if (rest > 0) {
    // 남은 시간(카운트다운)은 띄우지 않는다 (사용자 요청)
    return [{ id: 'rest', label: `${def.name} 쉬는 중`, enabled: false }];
  }
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
      label: def.careLabel ?? `${def.name} 먹이 주기`,
      enabled: feed > 0,
      // 돌봄 횟수 · 남은 먹이 개수는 띄우지 않는다 (사용자 요청). 먹이가 없을 때만 알려 준다
      hint: feed > 0 ? undefined : '먹이가 없어요. 농장 가게에서 사 오세요',
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
  if (!animal || restLeftMs(animal) > 0) return;
  const def = ANIMAL_SPECIES[animal.species];
  const body = ANIMAL_BODY[animal.species];

  if (actionId === 'feed') {
    askMath('ANIMAL', def.careQuestion ?? `${def.name}에게 먹이를 줄까요?`, (math) => {
      if (!useGameStore.getState().feedAnimal(animalId)) return;
      audio.play('animal', animalById(animalId)?.species);
      emote(animalId, 'eat');
      burstStars(above(animalId, body.marker * 0.5), 6);
      floatText(above(animalId, body.marker), def.careText ?? '냠냠', PALETTE.accentPink);
      if (animalById(animalId)?.produceReady) {
        toast(`${josa(def.produceName, '이/가')} 준비됐어요!`, 'reward');
        burstStars(above(animalId, body.marker * 0.7), 9);
      }
      awardExperience('ANIMAL', math);
    });
    return;
  }

  if (actionId === 'collect') {
    askMath('ANIMAL', `${josa(def.produceName, '을/를')} 받아 볼까요?`, (math) => {
      const result = useGameStore.getState().collectProduce(animalId, math.wrongAttempts);
      if (!result) return;
      // 다 틀려도 최소 1개는 받는다 (PRODUCE_BY_ATTEMPTS)
      audio.play('harvest');
      emote(animalId, 'happy');
      burstStars(above(animalId, body.marker * 0.7), 6 + result.count * 4);
      floatText(above(animalId, body.marker + 0.4), `${def.produceName} +${result.count}`, PALETTE.goldShade);
      toast(`${def.produceName} ${result.count}개를 얻었어요`, 'reward');
      if (result.rests) toast(`${josa(def.name, '이/가')} ${ANIMAL_REST.restMinutes}분 동안 쉬어요. 조금 뒤에 다시 와 주세요`, 'info');
      awardExperience('ANIMAL', math);
    });
  }
}
