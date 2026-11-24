/**
 * localStorage 기반 저장소 구현. Phase 1~7 동안의 기본 구현이며,
 * Phase 8 에서 Firebase 구현으로 교체된다. (명세 72, 74)
 */
import { sortClasses, type AvatarId, type CharacterId, type ClassRoom, type GameSaveData, type PlayerProfile } from '@/types/game';
import type { LearningStats } from '@/types/learning';
import type {
  ClassRepository,
  GameStateRepository,
  LearningRepository,
  PlayerRepository,
  RepositoryBundle,
} from '../repositories';
import { KEYS, readJson, removeRaw, writeJson } from './storage';

function newId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export class LocalPlayerRepository implements PlayerRepository {
  async listProfiles(): Promise<PlayerProfile[]> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    return [...profiles].sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''));
  }

  async getProfile(playerId: string): Promise<PlayerProfile | null> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    return profiles.find((p) => p.id === playerId) ?? null;
  }

  async createProfile(
    displayName: string,
    avatarId: AvatarId,
    characterId: CharacterId = 'boy',
    classId: string | null = null,
  ): Promise<PlayerProfile> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    const now = new Date().toISOString();
    const profile: PlayerProfile = {
      id: newId('player'),
      displayName: displayName.trim(),
      avatarId,
      characterId,
      createdAt: now,
      lastPlayedAt: null,
      classId,
    };
    profiles.push(profile);
    writeJson(KEYS.profiles, profiles);
    return profile;
  }

  async updateLook(
    playerId: string,
    look: { avatarId?: AvatarId; characterId?: CharacterId },
  ): Promise<void> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    const target = profiles.find((p) => p.id === playerId);
    if (!target) return;
    if (look.avatarId) target.avatarId = look.avatarId;
    if (look.characterId) target.characterId = look.characterId;
    writeJson(KEYS.profiles, profiles);
  }

  async rename(playerId: string, displayName: string): Promise<void> {
    this.patch(playerId, { displayName: displayName.trim() });
  }

  async setClass(playerId: string, classId: string | null): Promise<void> {
    this.patch(playerId, { classId });
  }

  private patch(playerId: string, patch: Partial<PlayerProfile>): void {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    const target = profiles.find((p) => p.id === playerId);
    if (!target) return;
    Object.assign(target, patch);
    writeJson(KEYS.profiles, profiles);
  }

  async touchLastPlayed(playerId: string): Promise<void> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    const target = profiles.find((p) => p.id === playerId);
    if (!target) return;
    target.lastPlayedAt = new Date().toISOString();
    writeJson(KEYS.profiles, profiles);
  }

  async deleteProfile(playerId: string): Promise<void> {
    const profiles = readJson<PlayerProfile[]>(KEYS.profiles, []);
    writeJson(
      KEYS.profiles,
      profiles.filter((p) => p.id !== playerId),
    );
    removeRaw(KEYS.save(playerId));
    removeRaw(KEYS.stats(playerId));
    // 기록을 남기지 않게 바뀌기 전에 쌓인 것까지 지운다
    removeRaw(KEYS.attempts(playerId));
  }
}

export class LocalGameStateRepository implements GameStateRepository {
  async load(playerId: string): Promise<GameSaveData | null> {
    return readJson<GameSaveData | null>(KEYS.save(playerId), null);
  }

  async save(playerId: string, data: GameSaveData): Promise<void> {
    writeJson(KEYS.save(playerId), data);
  }

  async reset(playerId: string): Promise<void> {
    removeRaw(KEYS.save(playerId));
  }
}


export class LocalLearningRepository implements LearningRepository {
  async loadStats(playerId: string): Promise<LearningStats | null> {
    return readJson<LearningStats | null>(KEYS.stats(playerId), null);
  }

  async saveStats(playerId: string, stats: LearningStats): Promise<void> {
    writeJson(KEYS.stats(playerId), stats);
  }

}

export class LocalClassRepository implements ClassRepository {
  async listClasses(): Promise<ClassRoom[]> {
    return sortClasses(readJson<ClassRoom[]>(KEYS.classes, []));
  }

  async createClass(name: string): Promise<ClassRoom> {
    const list = readJson<ClassRoom[]>(KEYS.classes, []);
    const room: ClassRoom = { id: newId('class'), name: name.trim(), createdAt: new Date().toISOString() };
    list.push(room);
    writeJson(KEYS.classes, list);
    return room;
  }

  async renameClass(classId: string, name: string): Promise<void> {
    const list = readJson<ClassRoom[]>(KEYS.classes, []);
    const target = list.find((c) => c.id === classId);
    if (!target) return;
    target.name = name.trim();
    writeJson(KEYS.classes, list);
  }

  async deleteClass(classId: string): Promise<void> {
    const list = readJson<ClassRoom[]>(KEYS.classes, []);
    writeJson(
      KEYS.classes,
      list.filter((c) => c.id !== classId),
    );
  }
}

export function createLocalRepositories(): RepositoryBundle {
  return {
    player: new LocalPlayerRepository(),
    classes: new LocalClassRepository(),
    gameState: new LocalGameStateRepository(),
    learning: new LocalLearningRepository(),
  };
}
