/**
 * 자동 저장. 학생에게 저장 버튼을 요구하지 않는다. (명세 36)
 *
 * 게임 로직(gameStore)과 저장 코드를 분리하기 위해 스토어를 구독만 한다. (개발원칙 9)
 *
 * 서버(Firestore) 쓰기를 아끼려고 (무료 한도: 하루 쓰기 수가 정해져 있다, 2026-11 사용자 요청):
 *  - 바뀐 것이 있으면 SAVE_EVERY_MS(20초)에 한 번 모아서 저장한다. 그 사이에 더 바뀌어도 기다리는 시간은 늘지 않는다.
 *  - 단, 레벨이 오를 때 · 장면을 옮길 때(집 · 시장 · 마굿간) · 앱을 닫거나 화면이 꺼질 때는 바로 저장한다.
 *  - 게임 진행 문서와 문제 통계 문서는 지난번 저장 뒤에 바뀐 것만 쓴다.
 * 그래서 갑자기 전원이 꺼지는 등 아무 신호 없이 끝나면 최대 20초 분량을 잃을 수 있다.
 */
import { gameEvents } from '@/bridge/eventBus';
import { repositories } from '@/data';
import { isSavingBlocked, useGameStore } from './gameStore';

/** 바뀐 것을 모아서 저장하는 간격 */
const SAVE_EVERY_MS = 20_000;

let timer: number | null = null;
let unsubscribe: (() => void) | null = null;
let offSceneChange: (() => void) | null = null;
let pending = false;

type GameState = ReturnType<typeof useGameStore.getState>;

/** 게임 진행 문서에 들어가는 것 (참조가 바뀌었는지만 본다) */
function saveSnapshot(state: GameState): unknown[] {
  return [
    state.money,
    state.experience,
    state.level,
    state.chests,
    state.plots,
    state.animals,
    state.inventory,
    state.home,
    state.yard,
    state.unlocked,
    state.records,
    state.miniGameScores,
    state.lastMiniGameRewardDate,
    state.fishDex,
    state.fishingDay,
  ];
}

function changed(a: unknown[], b: unknown[]): boolean {
  return a.length !== b.length || a.some((value, index) => value !== b[index]);
}

/** 서버에 마지막으로 쓴 것. 바뀐 문서만 쓰려고 기억한다 */
let writtenSave: unknown[] = [];
let writtenStats: unknown = null;

export async function flushSave(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (!pending) return;
  pending = false;

  if (isSavingBlocked()) return;

  const state = useGameStore.getState();
  const save = state.toSaveData();
  if (!save || !state.profile) return;
  const repos = repositories();
  const nextSave = saveSnapshot(state);
  const writes: Promise<void>[] = [];
  if (changed(writtenSave, nextSave)) {
    writtenSave = nextSave;
    writes.push(repos.gameState.save(state.profile.id, save));
  }
  if (writtenStats !== state.stats) {
    writtenStats = state.stats;
    writes.push(repos.learning.saveStats(state.profile.id, state.stats));
  }
  try {
    await Promise.all(writes);
  } catch (error) {
    console.error('[persistence] 저장 실패', error);
  }
}

/** 바뀐 것이 생겼다: 이미 기다리는 중이면 그대로 두고, 아니면 SAVE_EVERY_MS 뒤에 저장한다 */
function scheduleSave(): void {
  pending = true;
  if (timer !== null) return;
  timer = window.setTimeout(() => {
    timer = null;
    void flushSave();
  }, SAVE_EVERY_MS);
}

/** 바뀐 것이 있으면 지금 바로 저장 */
function saveNow(): void {
  if (pending) void flushSave();
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') saveNow();
}

/** 세션 시작 후 호출. 상태가 바뀔 때마다 모아서 자동 저장한다. */
export function startAutoSave(): () => void {
  stopAutoSave();
  const initial = useGameStore.getState();
  let previousSave = saveSnapshot(initial);
  let previousStats: unknown = initial.stats;
  let previousLevel = initial.level;
  // 불러온 그대로는 서버에 이미 있다
  writtenSave = previousSave;
  writtenStats = previousStats;

  unsubscribe = useGameStore.subscribe((state) => {
    if (state.status !== 'ready') return;
    const nextSave = saveSnapshot(state);
    if (!changed(previousSave, nextSave) && previousStats === state.stats) return;
    previousSave = nextSave;
    previousStats = state.stats;
    scheduleSave();
    // 레벨이 오르면 바로 (잃으면 가장 아쉬운 순간이다)
    if (state.level !== previousLevel) {
      previousLevel = state.level;
      saveNow();
    }
  });

  // 장면을 옮길 때(집 · 시장 · 마굿간 · 마당) 바로
  offSceneChange = gameEvents.on('scene:changed', saveNow);
  window.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onVisibilityChange);
  window.addEventListener('pagehide', saveNow);
  return stopAutoSave;
}

export function stopAutoSave(): void {
  unsubscribe?.();
  unsubscribe = null;
  offSceneChange?.();
  offSceneChange = null;
  window.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('pagehide', onVisibilityChange);
  window.removeEventListener('pagehide', saveNow);
  void flushSave();
}
