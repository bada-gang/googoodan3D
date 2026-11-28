/**
 * 저장소 안전망.
 *
 * 서버(Firestore)가 거부해도 수업이 멈추면 안 된다.
 * 되돌릴 수 없는 오류가 한 번 나면 그 세션은 통째로 이 기기 저장으로 내려가고,
 * 실패한 그 호출은 이 기기 저장으로 다시 실행된다. 학생 화면에는 아무 일도 일어나지 않는다.
 *
 * 잠깐 끊긴 것(unavailable 등)은 여기서 처리하지 않는다.
 * Firestore 오프라인 캐시가 읽기는 캐시로 주고 쓰기는 큐에 쌓아 두었다가 알아서 올린다.
 * 그런 오류까지 이 기기 저장으로 내려버리면 다시 연결돼도 서버로 올라가지 않는다.
 */
import type {
  ClassRepository,
  GameStateRepository,
  LearningRepository,
  PlayerRepository,
  RepositoryBundle,
} from './repositories';

/**
 * 기다린다고 나아지지 않는 오류들. 규칙·인증·설정 문제다.
 * invalid-argument(저장 내용이 잘못됨, 예: 빈 값)는 넣지 않는다 — 이 기기 저장으로 내려가면 그 수업 내내
 * 서버에 아무것도 안 올라간다 (2026-11 버그). 그 한 번만 실패하고, 다음 저장 때 서버에 다시 시도한다.
 */
const FATAL_CODES = new Set(['permission-denied', 'unauthenticated', 'failed-precondition', 'unimplemented']);

function isFatal(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && FATAL_CODES.has(code);
}

/**
 * primary 를 감싸서, 치명적 오류가 나면 fallback 으로 갈아타고 같은 호출을 다시 한다.
 * 한 번 갈아타면 그 세션 동안 되돌아가지 않는다 — 데이터가 두 곳으로 갈리지 않게.
 */
export function createResilientBundle(
  primary: RepositoryBundle,
  makeFallback: () => RepositoryBundle,
  onDowngrade: (error: unknown) => void,
): RepositoryBundle {
  let fallback: RepositoryBundle | null = null;

  async function run<T>(pick: (bundle: RepositoryBundle) => Promise<T>): Promise<T> {
    if (fallback) return pick(fallback);
    try {
      return await pick(primary);
    } catch (error) {
      if (!isFatal(error)) throw error;
      fallback = makeFallback();
      onDowngrade(error);
      return pick(fallback);
    }
  }

  /**
   * 학급은 갈아타기 없이 그대로 부른다. 학급 컬렉션은 나중에 생겨서, 서버 규칙을 올리기 전이면
   * 거부(permission-denied)가 난다 — 그 때문에 학생 저장까지 이 기기로 내려가면 안 된다.
   * 오류는 부른 쪽(학급 고르기 화면 · 선생님 화면)이 받아서 처리한다.
   */
  function direct<T>(pick: (bundle: RepositoryBundle) => Promise<T>): Promise<T> {
    return pick(fallback ?? primary);
  }

  const player: PlayerRepository = {
    listProfiles: (classId) => run((b) => b.player.listProfiles(classId)),
    getProfile: (id) => run((b) => b.player.getProfile(id)),
    createProfile: (name, avatar, character, classId) =>
      run((b) => b.player.createProfile(name, avatar, character, classId)),
    updateLook: (id, look) => run((b) => b.player.updateLook(id, look)),
    rename: (id, name) => run((b) => b.player.rename(id, name)),
    setClass: (id, classId) => run((b) => b.player.setClass(id, classId)),
    touchLastPlayed: (id) => run((b) => b.player.touchLastPlayed(id)),
    deleteProfile: (id) => run((b) => b.player.deleteProfile(id)),
  };

  const classes: ClassRepository = {
    listClasses: () => direct((b) => b.classes.listClasses()),
    createClass: (name, password) => direct((b) => b.classes.createClass(name, password)),
    setClassPassword: (id, password) => direct((b) => b.classes.setClassPassword(id, password)),
    renameClass: (id, name) => direct((b) => b.classes.renameClass(id, name)),
    deleteClass: (id) => direct((b) => b.classes.deleteClass(id)),
  };

  const gameState: GameStateRepository = {
    load: (id) => run((b) => b.gameState.load(id)),
    save: (id, data) => run((b) => b.gameState.save(id, data)),
    reset: (id) => run((b) => b.gameState.reset(id)),
  };

  const learning: LearningRepository = {
    loadStats: (id) => run((b) => b.learning.loadStats(id)),
    saveStats: (id, stats) => run((b) => b.learning.saveStats(id, stats)),
  };

  return { player, classes, gameState, learning };
}
