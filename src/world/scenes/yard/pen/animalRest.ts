/**
 * 가축 휴식: 한 마리(한 통)에서 생산물을 ANIMAL_REST.collectsBeforeRest 번 받으면 restMinutes 분 동안 쉰다.
 * 쉬는 동안은 돌보기 · 받기를 못 하고(버튼에 "○○ 쉬는 중", 남은 시간은 안 띄운다), 머리 위에 "zzz" 표시가 뜬다 (느낌표 대신).
 * 시각은 벽시계(Date.now) 기준이라 게임을 껐다 켜도 이어진다. 숫자는 config/balance.ts 의 ANIMAL_REST.
 */
import { useEffect, useState } from 'react';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance } from '@/types/game';

/** 남은 휴식 시간 (ms). 쉬는 중이 아니면 0 */
export function restLeftMs(animal: AnimalInstance | undefined, now = Date.now()): number {
  return Math.max(0, (animal?.restUntil ?? 0) - now);
}

/** 이 동물이 지금 쉬는 중인지. 쉬는 시간이 끝나는 순간 다시 그리게 한다 */
export function useAnimalResting(animalId: string): boolean {
  const restUntil = useGameStore((s) => s.animals.find((a) => a.id === animalId)?.restUntil ?? 0);
  const [, wake] = useState(0);
  const left = restUntil - Date.now();
  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => wake((n) => n + 1), left + 50);
    return () => window.clearTimeout(timer);
  }, [restUntil, left]);
  return left > 0;
}
