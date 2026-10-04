/**
 * 월드에서 일어나는 행동이 공통으로 쓰는 규칙: 문제 풀기, 경험치, 안내.
 * (2D 판 WorldScene 의 askMath · awardExperience · toast 를 그대로 옮겼다)
 */
import { gameEvents } from '@/bridge/eventBus';
import type { ToastTone } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { MathContext } from '@/types/learning';
import { audio } from '@/audio/sfx';
import { player, playEmote } from './runtime';
import { burstStars } from './effects';
import { spawnParticles } from './particles';

/** 문제를 맞히고 돌아온 결과. 수확량과 경험치를 정하는 데 쓴다. */
export interface MathAskResult {
  /** 틀린 횟수 전체 (새 문제를 받은 것까지 합친다). 적을수록 많이 딴다. */
  wrongAttempts: number;
  /** 두 번 틀려 답을 보고 넘어간 문제 수. 하나라도 있으면 경험치가 없다. (요청 2) */
  failedQuestions: number;
}

/**
 * 곱셈 문제를 요청하고, 정답일 때만 onCorrect 를 실행한다. (명세 71)
 * 문제 생성과 화면 표시는 React 쪽(useGameBridge → mathFlow)이 담당한다.
 * 반환값은 기다리기를 그만둘 때 부르는 함수다 (장면이 사라질 때).
 */
export function askMath(
  context: MathContext,
  title: string,
  onCorrect: (result: MathAskResult) => void,
): () => void {
  const requestId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const off = gameEvents.on('math:result', (payload) => {
    if (payload.requestId !== requestId) return;
    off();
    if (!payload.correct) return;
    playEmote('happy');
    onCorrect({ wrongAttempts: payload.wrongAttempts, failedQuestions: payload.failedQuestions });
  });
  playEmote('interact');
  gameEvents.emit('math:request', { requestId, context, title });
  return off;
}

export function toast(text: string, tone: ToastTone = 'info'): void {
  gameEvents.emit('toast', { text, tone });
}

/**
 * 정답 보상으로 경험치를 준다. 레벨이 오르면 짧은 연출과 안내를 띄운다. (명세 32, 33)
 *
 * 두 번 틀려서 답을 보고 넘어간 문제가 있으면 주지 않는다. (요청 2)
 * 행동 자체(수확·구입)는 그대로 되지만 경험치만 없다 — 빈손으로 돌려보내면
 * 2학년에게는 벌처럼 느껴진다. 대신 수확량은 틀린 횟수만큼 줄어든다.
 */
export function awardExperience(context: MathContext, result?: MathAskResult): void {
  if (result && result.failedQuestions > 0) return;
  const gain = useGameStore.getState().gainExperience(context);
  if (!gain.leveledUp) return;
  audio.play('levelUp');
  burstStars({ x: player.position.x, y: 2.2, z: player.position.z }, 16);
  // 캐릭터 둘레로 반짝이가 올라간다
  spawnParticles('sparkle', { x: player.position.x, y: 0.2, z: player.position.z }, 22);
  gameEvents.emit('level:up', { level: gain.newLevel });
}
