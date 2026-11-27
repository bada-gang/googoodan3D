/**
 * 동물 돌보기 규칙과 동물 위치 공유.
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
import { ANIMAL_BODY, PEN_MIN_X, PEN_MIN_Z, TROUGH, WATER_TROUGH, pen } from './penLayout';
import { APIARY_AREA } from '../apiary/apiaryLayout';

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

/**
 * 동물이 다니는 범위: 울타리 안 구석구석까지. 몸(반지름)에 이만큼만 더 띄워 울타리에 붙지 않게 한다.
 * 예전에는 울타리에서 0.8m 안쪽만 다녀서 가장자리 · 구석이 늘 비어 있었다.
 */
const WALL_GAP = 0.15;
/** 여물통 · 물통 · 양봉 구석 자리 (가운데 기준 반 너비 · 반 길이). 동물이 들어가지 않는다 */
const TROUGHS = [
  ...[TROUGH, WATER_TROUGH].map((t) => ({ x: t.x, z: t.z, halfX: 0.35, halfZ: t.length / 2 })),
  // 양봉 통 구석 (yard/apiary). 통이 없어도 비워 둔다
  {
    x: (APIARY_AREA.minX + APIARY_AREA.maxX) / 2,
    z: (APIARY_AREA.minZ + APIARY_AREA.maxZ) / 2,
    halfX: (APIARY_AREA.maxX - APIARY_AREA.minX) / 2,
    halfZ: (APIARY_AREA.maxZ - APIARY_AREA.minZ) / 2,
  },
];

/** 이 자리에 몸이 통에 닿는지 */
function hitsTrough(x: number, z: number, radius: number): boolean {
  const pad = radius + 0.1;
  return TROUGHS.some((t) => Math.abs(x - t.x) < t.halfX + pad && Math.abs(z - t.z) < t.halfZ + pad);
}

/** 곧장 걸어가는 길이 통을 지나는지 (동물은 장애물을 돌아가지 않는다) */
function pathHitsTrough(from: { x: number; z: number }, to: { x: number; z: number }, radius: number): boolean {
  for (let i = 1; i <= 8; i += 1) {
    const k = i / 8;
    if (hitsTrough(from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k, radius)) return true;
  }
  return false;
}

function spotAt(u: number, v: number, radius: number): { x: number; z: number } {
  const m = radius + WALL_GAP;
  return { x: PEN_MIN_X + m + u * (pen.width - m * 2), z: PEN_MIN_Z + m + v * (pen.depth - m * 2) };
}

/** 다음에 걸어갈 곳. 우리 안 아무 곳이나 (통 자리와 통을 지나는 길은 빼고) */
export function randomSpot(from: { x: number; z: number }, radius: number): { x: number; z: number } {
  for (let tries = 0; tries < 12; tries += 1) {
    const spot = spotAt(Math.random(), Math.random(), radius);
    if (!hitsTrough(spot.x, spot.z, radius) && !pathHitsTrough(from, spot, radius)) return spot;
  }
  return { x: pen.center.x, z: pen.center.z };
}

/** 처음 자리는 저장된 spot(0~1)으로 정한다. 다시 들어와도 비슷한 곳에 있다 */
export function startSpot(animal: AnimalInstance, index: number, radius: number): { x: number; z: number } {
  const spot = spotAt((animal.spot + index * 0.37) % 1, (index * 0.53 + 0.2) % 1, radius);
  // 통 자리에 걸리면 가운데 쪽으로 옮긴다
  return hitsTrough(spot.x, spot.z, radius) ? { x: pen.center.x + (index - 1.5) * 0.9, z: spot.z } : spot;
}

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
