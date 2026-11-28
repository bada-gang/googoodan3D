/**
 * 저장소 인터페이스. (명세 72)
 *
 * 게임 로직과 상태 스토어는 이 인터페이스에만 의존한다.
 * Phase 8 에서 FirebasePlayerRepository 등을 만들어 갈아끼우면 되고,
 * 게임 코드는 한 줄도 바뀌지 않는다.
 *
 * 참고: 농장/동물/인벤토리는 항상 같은 시점에 함께 저장되므로
 * (자동 저장, 명세 36) 하나의 GameStateRepository 애그리게이트로 다룬다.
 * Firestore 에서는 이 구현체 내부에서 하위 문서로 나눌 수 있다.
 */
import type { AvatarId, CharacterId, ClassRoom, GameSaveData, PlayerProfile } from '@/types/game';
import type { LearningStats } from '@/types/learning';

export interface PlayerRepository {
  /**
   * 학생 목록. classId 를 주면 그 반 학생만 (서버에서 골라 읽는다 — 다른 반 학생 문서를 읽지 않아 읽기 횟수가 줄어든다).
   * 주지 않으면 모든 학생.
   */
  listProfiles(classId?: string): Promise<PlayerProfile[]>;
  getProfile(playerId: string): Promise<PlayerProfile | null>;
  createProfile(
    displayName: string,
    avatarId: AvatarId,
    characterId?: CharacterId,
    classId?: string | null,
  ): Promise<PlayerProfile>;
  /** 학생이 자기 모습을 바꾼다. 아바타와 캐릭터를 한 번에 다룬다. (명세 9, 10) */
  updateLook(playerId: string, look: { avatarId?: AvatarId; characterId?: CharacterId }): Promise<void>;
  /** 학생이 자기 이름을 바꾼다 */
  rename(playerId: string, displayName: string): Promise<void>;
  /** 선생님이 학생을 다른 반으로 옮긴다 */
  setClass(playerId: string, classId: string | null): Promise<void>;
  touchLastPlayed(playerId: string): Promise<void>;
  deleteProfile(playerId: string): Promise<void>;
}

/** 학급 목록. 선생님 화면에서 만들고 고치며, 게임 첫 화면은 읽기만 한다. */
export interface ClassRepository {
  listClasses(): Promise<ClassRoom[]>;
  createClass(name: string, password: string | null): Promise<ClassRoom>;
  renameClass(classId: string, name: string): Promise<void>;
  /** 반 비밀번호를 바꾼다. null 이면 비밀번호 없이 들어간다 */
  setClassPassword(classId: string, password: string | null): Promise<void>;
  /** 학급만 지운다. 학생이 남아 있는 반은 화면에서 지우지 못하게 막는다. */
  deleteClass(classId: string): Promise<void>;
}

export interface GameStateRepository {
  load(playerId: string): Promise<GameSaveData | null>;
  save(playerId: string, data: GameSaveData): Promise<void>;
  reset(playerId: string): Promise<void>;
}

export interface LearningRepository {
  loadStats(playerId: string): Promise<LearningStats | null>;
  saveStats(playerId: string, stats: LearningStats): Promise<void>;
}

export interface RepositoryBundle {
  player: PlayerRepository;
  classes: ClassRepository;
  gameState: GameStateRepository;
  learning: LearningRepository;
}
