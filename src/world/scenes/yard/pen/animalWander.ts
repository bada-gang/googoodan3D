/**
 * 우리 동물이 어디로 걸어갈지 (움직임 상태 · 다음 자리 · 쉬러 가는 통 자리).
 * 걷는 모습(뒤뚱 · 숨쉬기 · 먹기)은 Animal.tsx, 돌보기 규칙(먹이 · 생산물)은 animalActions.ts.
 *
 * 2026-11 사용자 요청:
 *  - 쉬기 시작한 동물은 건초통이나 물통 앞까지 꼭 간다 (가다가 다른 동물이 막으면 잠깐 기다렸다 다시 간다).
 *    도착하면 통을 보고 먹기나 마시기를 한 번 하고, 그 뒤로는 자유롭게 돌아다닌다.
 *  - 자유롭게 다니는 동물은 통 앞(쉬러 오는 자리)을 목적지로 고르지 않는다.
 *  - 양봉 통이 있는 자리만 피한다 (예전에는 통이 없어도 왼쪽 울타리 앞 3.4m 를 늘 비워 둬서 그쪽에 안 갔다).
 *  - 넓게 다니게: 갈 만한 자리를 몇 개 뽑아 지금 자리에서 가장 먼 곳으로 간다.
 */
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance } from '@/types/game';
import { HIVE_RADIUS, HIVE_SLOTS } from '../apiary/apiaryLayout';
import { PEN_MIN_X, PEN_MIN_Z, TROUGH, WATER_TROUGH, pen } from './penLayout';

export interface AnimalMotion {
  x: number;
  z: number;
  facing: number;
  target: { x: number; z: number } | null;
  /** 다음 걸음을 시작할 시각 (초) */
  restUntil: number;
  /** 몸짓. duration 은 ms (없으면 1.2초) */
  emote: { kind: 'eat' | 'happy'; startedAt: number; duration?: number } | null;
  walkPhase: number;
  moving: boolean;
  /** 쉬러 통에 가는 중 (도착하면 먹기 · 마시기 한 번) */
  visit: TroughVisit | null;
  /** 이 방향을 보도록 천천히 돈다 (통 앞에서 먹을 때) */
  faceTo: number | null;
}

export interface TroughVisit {
  spot: { x: number; z: number };
  /** 통을 보는 방향 */
  face: number;
  /** 다른 동물에 막혀 기다리기 시작한 시각 (초) */
  waitingSince: number | null;
}

/** 동물 위치. 상호작용 거리 · 느낌표 · 서로 피하기에 쓴다 */
export const motions = new Map<string, AnimalMotion>();

/** 울타리에서 몸(반지름)에 이만큼만 더 띄운다 (구석구석까지 다니게) */
const WALL_GAP = 0.15;
/** 통의 반 두께 (x) */
const TROUGH_HALF_X = 0.35;
/** 먹는 몸짓 길이 (ms) */
export const VISIT_EAT_MS = 3000;
/** 쉬러 가다 막혀서 이만큼 기다려도 안 비키면 비집고 지나간다 (초) */
const VISIT_PUSH_SECONDS = 3;

interface Box {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
}

const TROUGH_BOXES: Box[] = [TROUGH, WATER_TROUGH].map((t) => ({ x: t.x, z: t.z, halfX: TROUGH_HALF_X, halfZ: t.length / 2 }));

/** 통 앞 띠: 쉬러 온 동물이 서는 곳. 자유롭게 다니는 동물은 여기를 목적지로 고르지 않는다 */
const TROUGH_FRONT: Box = (() => {
  const minZ = Math.min(TROUGH.z - TROUGH.length / 2, WATER_TROUGH.z - WATER_TROUGH.length / 2);
  const maxZ = Math.max(TROUGH.z + TROUGH.length / 2, WATER_TROUGH.z + WATER_TROUGH.length / 2);
  const maxX = Math.min(TROUGH.x, WATER_TROUGH.x) - TROUGH_HALF_X;
  const width = 1.6;
  return { x: maxX - width / 2, z: (minZ + maxZ) / 2, halfX: width / 2, halfZ: (maxZ - minZ) / 2 };
})();

/** 지금 있는 양봉 통 자리 (산 통 수만큼 앞에서부터) */
function hiveBoxes(): Box[] {
  const hives = useGameStore.getState().animals.filter((a) => a.species === 'bee').length;
  return HIVE_SLOTS.slice(0, hives).map((slot) => ({ x: slot.x, z: slot.z, halfX: HIVE_RADIUS + 0.1, halfZ: HIVE_RADIUS + 0.1 }));
}

function inBox(x: number, z: number, box: Box, pad: number): boolean {
  return Math.abs(x - box.x) < box.halfX + pad && Math.abs(z - box.z) < box.halfZ + pad;
}

/** 몸이 통 · 양봉 통에 닿는 자리인가 */
function blocked(x: number, z: number, radius: number, boxes: Box[]): boolean {
  return boxes.some((box) => inBox(x, z, box, radius + 0.1));
}

/** 곧장 걸어가는 길이 통을 지나는지 (동물은 장애물을 돌아가지 않는다) */
function pathBlocked(from: { x: number; z: number }, to: { x: number; z: number }, radius: number, boxes: Box[]): boolean {
  for (let i = 1; i <= 8; i += 1) {
    const k = i / 8;
    if (blocked(from.x + (to.x - from.x) * k, from.z + (to.z - from.z) * k, radius, boxes)) return true;
  }
  return false;
}

function spotAt(u: number, v: number, radius: number): { x: number; z: number } {
  const m = radius + WALL_GAP;
  return { x: PEN_MIN_X + m + u * (pen.width - m * 2), z: PEN_MIN_Z + m + v * (pen.depth - m * 2) };
}

/**
 * 다음에 걸어갈 곳. 우리 안 아무 곳 중 (통 · 양봉 통 · 통 앞 띠 · 그것들을 지나는 길은 빼고)
 * 갈 만한 자리 4개를 뽑아 지금 자리에서 가장 먼 곳 — 우리 안을 넓게 돌아다닌다.
 */
export function randomSpot(from: { x: number; z: number }, radius: number): { x: number; z: number } {
  const boxes = [...TROUGH_BOXES, ...hiveBoxes()];
  let best: { x: number; z: number } | null = null;
  let bestDistance = -1;
  let found = 0;
  for (let tries = 0; tries < 24 && found < 4; tries += 1) {
    const spot = spotAt(Math.random(), Math.random(), radius);
    if (blocked(spot.x, spot.z, radius, boxes) || inBox(spot.x, spot.z, TROUGH_FRONT, radius)) continue;
    if (pathBlocked(from, spot, radius, boxes)) continue;
    found += 1;
    const distance = Math.hypot(spot.x - from.x, spot.z - from.z);
    if (distance > bestDistance) {
      best = spot;
      bestDistance = distance;
    }
  }
  return best ?? { x: pen.center.x, z: pen.center.z };
}

/** 쉬러 갈 통: 건초통(먹기)이나 물통(마시기) 중 하나, 통 길이 안 아무 자리 바로 앞 */
export function troughVisit(radius: number): TroughVisit {
  const trough = Math.random() < 0.5 ? TROUGH : WATER_TROUGH;
  return {
    spot: {
      x: trough.x - TROUGH_HALF_X - radius - 0.15,
      z: trough.z + (Math.random() - 0.5) * Math.max(0, trough.length - 0.6),
    },
    // 통은 동물 오른쪽(+x)에 있다
    face: Math.PI / 2,
    waitingSince: null,
  };
}

/**
 * 쉬러 가다가 다른 동물에 막혔다. 기다려야 하면 true.
 * 막은 동물이 그냥 서 있으면 다른 곳으로 비켜 준다. 그래도 VISIT_PUSH_SECONDS 넘게 막히면 비집고 지나간다 (false).
 */
export function keepWaiting(motion: AnimalMotion, blocker: AnimalMotion, now: number): boolean {
  const visit = motion.visit;
  if (!visit) return false;
  if (visit.waitingSince === null) visit.waitingSince = now;
  const idle = !blocker.target && !blocker.visit && !blocker.emote;
  if (idle) {
    blocker.target = randomSpot(blocker, 0.5);
    blocker.restUntil = 0;
  }
  return now - visit.waitingSince < VISIT_PUSH_SECONDS;
}

/** 처음 자리는 저장된 spot(0~1)으로 정한다. 다시 들어와도 비슷한 곳에 있다 */
export function startSpot(animal: AnimalInstance, index: number, radius: number): { x: number; z: number } {
  const spot = spotAt((animal.spot + index * 0.37) % 1, (index * 0.53 + 0.2) % 1, radius);
  const boxes = [...TROUGH_BOXES, ...hiveBoxes()];
  // 통 자리에 걸리면 가운데 쪽으로 옮긴다
  return blocked(spot.x, spot.z, radius, boxes) ? { x: pen.center.x + (index - 1.5) * 0.9, z: spot.z } : spot;
}
