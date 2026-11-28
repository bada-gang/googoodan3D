/**
 * Firestore 기반 저장소 구현. (명세 72 · Phase 8)
 *
 * 데이터 구조 — 한 학급이 하나의 프로젝트를 함께 쓴다.
 * 2D 판(googoodan)과 같은 Firebase 프로젝트를 쓰므로, 3D 판은 이름 끝에 3d 를 붙인 컬렉션에 따로 둔다.
 * 저장 데이터 모양이 달라서 섞이면 안 된다. 두 판의 학생 명단도 따로다.
 *
 *   classes3d/{classId}                 학급 이름 (여러 반이 같은 프로젝트를 쓴다)
 *   players3d/{playerId}                이름 · 캐릭터 · 반(classId) · 마지막 접속
 *   saves3d/{playerId}                  진행도 (돈 · 밭 · 동물 · 가방 · 집 · 마당)
 *   stats3d/{playerId}                  학습 통계 (문제별 정답률)
 *
 * 학생 계정이 없으므로 문서 키는 익명 UID 가 아니라 playerId 다.
 * 그래서 어느 태블릿에서 접속하든 이름만 고르면 이어서 할 수 있다.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { sortClasses, type AvatarId, type CharacterId, type ClassRoom, type GameSaveData, type PlayerProfile } from '@/types/game';
import type { LearningStats } from '@/types/learning';
import type {
  ClassRepository,
  GameStateRepository,
  LearningRepository,
  PlayerRepository,
  RepositoryBundle,
} from '../repositories';
import { firestore } from './app';
import { CLASSES, PLAYERS, SAVES, STATS } from './collections';

function newPlayerId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `player_${Date.now().toString(36)}_${random}`;
}

export class FirebasePlayerRepository implements PlayerRepository {
  async listProfiles(classId?: string): Promise<PlayerProfile[]> {
    // 반을 주면 그 반 학생 문서만 서버에서 골라 읽는다 (Firestore 는 읽은 문서 수만큼 센다)
    const players = collection(firestore(), PLAYERS);
    const snapshot = await getDocs(classId ? query(players, where('classId', '==', classId)) : players);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PlayerProfile)
      .sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''));
  }

  async getProfile(playerId: string): Promise<PlayerProfile | null> {
    const snapshot = await getDoc(doc(firestore(), PLAYERS, playerId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() } as PlayerProfile;
  }

  async createProfile(
    displayName: string,
    avatarId: AvatarId,
    characterId: CharacterId = 'boy',
    classId: string | null = null,
  ): Promise<PlayerProfile> {
    const now = new Date().toISOString();
    const profile: PlayerProfile = {
      id: newPlayerId(),
      displayName: displayName.trim(),
      avatarId,
      characterId,
      createdAt: now,
      lastPlayedAt: null,
      classId,
    };
    const { id, ...body } = profile;
    await setDoc(doc(firestore(), PLAYERS, id), body);
    return profile;
  }

  async updateLook(
    playerId: string,
    look: { avatarId?: AvatarId; characterId?: CharacterId },
  ): Promise<void> {
    // undefined 를 그대로 보내면 Firestore 가 거부한다. 채워진 것만 보낸다.
    const patch = Object.fromEntries(Object.entries(look).filter(([, v]) => v !== undefined));
    if (Object.keys(patch).length === 0) return;
    await updateDoc(doc(firestore(), PLAYERS, playerId), patch);
  }

  async rename(playerId: string, displayName: string): Promise<void> {
    await updateDoc(doc(firestore(), PLAYERS, playerId), { displayName: displayName.trim() });
  }

  async setClass(playerId: string, classId: string | null): Promise<void> {
    await updateDoc(doc(firestore(), PLAYERS, playerId), { classId });
  }

  async touchLastPlayed(playerId: string): Promise<void> {
    await updateDoc(doc(firestore(), PLAYERS, playerId), {
      lastPlayedAt: new Date().toISOString(),
    });
  }

  async deleteProfile(playerId: string): Promise<void> {
    const db = firestore();
    await Promise.all([
      deleteDoc(doc(db, PLAYERS, playerId)),
      deleteDoc(doc(db, SAVES, playerId)),
      deleteDoc(doc(db, STATS, playerId)),
    ]);
  }
}

export class FirebaseGameStateRepository implements GameStateRepository {
  async load(playerId: string): Promise<GameSaveData | null> {
    const snapshot = await getDoc(doc(firestore(), SAVES, playerId));
    return snapshot.exists() ? (snapshot.data() as GameSaveData) : null;
  }

  async save(playerId: string, data: GameSaveData): Promise<void> {
    // 오프라인이면 이 호출은 로컬 큐에 쌓였다가 연결되면 자동으로 올라간다.
    await setDoc(doc(firestore(), SAVES, playerId), data);
  }

  async reset(playerId: string): Promise<void> {
    await deleteDoc(doc(firestore(), SAVES, playerId));
  }
}

export class FirebaseLearningRepository implements LearningRepository {
  async loadStats(playerId: string): Promise<LearningStats | null> {
    const snapshot = await getDoc(doc(firestore(), STATS, playerId));
    return snapshot.exists() ? (snapshot.data() as LearningStats) : null;
  }

  async saveStats(playerId: string, stats: LearningStats): Promise<void> {
    await setDoc(doc(firestore(), STATS, playerId), stats);
  }

}

export class FirebaseClassRepository implements ClassRepository {
  async listClasses(): Promise<ClassRoom[]> {
    const snapshot = await getDocs(collection(firestore(), CLASSES));
    return sortClasses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassRoom));
  }

  async createClass(name: string, password: string | null): Promise<ClassRoom> {
    const room: ClassRoom = {
      id: `class_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      password,
    };
    const { id, ...body } = room;
    await setDoc(doc(firestore(), CLASSES, id), body);
    return room;
  }

  async renameClass(classId: string, name: string): Promise<void> {
    await updateDoc(doc(firestore(), CLASSES, classId), { name: name.trim() });
  }

  async setClassPassword(classId: string, password: string | null): Promise<void> {
    await updateDoc(doc(firestore(), CLASSES, classId), { password });
  }

  async deleteClass(classId: string): Promise<void> {
    await deleteDoc(doc(firestore(), CLASSES, classId));
  }
}

export function createFirebaseRepositories(): RepositoryBundle {
  return {
    player: new FirebasePlayerRepository(),
    classes: new FirebaseClassRepository(),
    gameState: new FirebaseGameStateRepository(),
    learning: new FirebaseLearningRepository(),
  };
}
