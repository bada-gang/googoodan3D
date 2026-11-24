/**
 * 교사 화면이 쓰는 데이터 로딩. (명세 73)
 *
 * 학생 게임과 같은 저장소 인터페이스만 쓴다 — 교사 화면 전용 쿼리를 따로 만들지 않는다.
 * 한 학급(스무 명 남짓)이므로 학생마다 진행도·통계를 한 번씩 읽어도 부담이 없다.
 */
import { useCallback, useEffect, useState } from 'react';
import { repositories, storageMode, type StorageMode } from '@/data';
import { MAX_CLASSES, MAX_STUDENTS_PER_CLASS, type AvatarId, type ClassRoom, type PlayerProfile } from '@/types/game';
import { createEmptyLearningStats } from '@/types/learning';
import { buildStudentRow, summarizeClass, type ClassSummary, type StudentRow } from './summary';

export interface ClassData {
  /** 모든 반의 학생 */
  rows: StudentRow[];
  /** 모든 반을 합친 요약. 반별 요약은 화면에서 rows 를 걸러 summarizeClass 로 만든다 */
  summary: ClassSummary;
  classes: ClassRoom[];
  /** 학급 목록을 못 읽은 경우 (서버 규칙에 classes3d 를 아직 안 올렸을 때 등) */
  classError: string | null;
}

export interface UseClassData {
  data: ClassData | null;
  loading: boolean;
  /** 목록 자체를 못 읽은 경우 */
  error: string | null;
  storage: StorageMode;
  refresh: () => Promise<void>;
  /** 명단을 한 번에 등록한다. 다 끝난 뒤 한 번만 다시 읽는다. */
  addStudents: (
    entries: { displayName: string; avatarId: AvatarId }[],
    classId: string | null,
  ) => Promise<void>;
  /**
   * 학급을 만든다. 처음 만드는 학급이면 반이 없는 학생(학급 기능 전에 만든 학생)을 모두 그 반으로 옮긴다.
   * 만든 학급을 돌려준다.
   */
  createClass: (name: string, password: string | null) => Promise<ClassRoom>;
  renameClass: (classId: string, name: string) => Promise<void>;
  setClassPassword: (classId: string, password: string | null) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  /** 학생을 다른 반으로 옮긴다 */
  moveStudent: (playerId: string, classId: string | null) => Promise<void>;
  /** 이름은 남기고 진행도·학습 기록만 지운다 */
  resetStudent: (playerId: string) => Promise<void>;
  /** 학생을 통째로 지운다 */
  removeStudent: (playerId: string) => Promise<void>;
  /** 학생이 가진 돈을 바꾼다. 저장본이 없는(아직 시작 안 한) 학생은 바꿀 수 없다. */
  setMoney: (playerId: string, money: number) => Promise<void>;
}

function message(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string };
    return e.code ?? e.message ?? String(error);
  }
  return String(error);
}

async function loadStudent(profile: PlayerProfile): Promise<StudentRow> {
  const repos = repositories();
  const [stats, save] = await Promise.all([
    repos.learning.loadStats(profile.id),
    repos.gameState.load(profile.id),
  ]);
  return buildStudentRow(profile, stats, save);
}

export function useClassData(enabled: boolean): UseClassData {
  const [data, setData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const repos = repositories();
      const [profiles, classResult] = await Promise.all([
        repos.player.listProfiles(),
        repos.classes
          .listClasses()
          .then((classes) => ({ classes, classError: null }))
          .catch((e) => ({ classes: [] as ClassRoom[], classError: message(e) })),
      ]);

      // 한 학생을 못 읽어도 나머지는 보여준다. 그 학생 줄에만 사유를 남긴다.
      const rows = await Promise.all(
        profiles.map((profile) =>
          loadStudent(profile).catch((e) =>
            buildStudentRow(profile, null, null, message(e)),
          ),
        ),
      );

      setData({ rows, summary: summarizeClass(rows), ...classResult });
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const addStudents = useCallback(
    async (entries: { displayName: string; avatarId: AvatarId }[], classId: string | null) => {
      const repos = repositories();
      // 다른 화면에서 방금 넣었을 수도 있으니 서버 목록으로 다시 센다
      const now = (await repos.player.listProfiles()).filter((p) => (p.classId ?? null) === classId).length;
      if (now + entries.length > MAX_STUDENTS_PER_CLASS)
        throw new Error(`한 학급에 ${MAX_STUDENTS_PER_CLASS}명까지예요 (지금 ${now}명)`);
      // 순서대로 만든다. 한꺼번에 던지면 실패한 이름이 어느 것인지 알기 어렵다.
      for (const entry of entries) {
        await repos.player.createProfile(entry.displayName, entry.avatarId, undefined, classId);
      }
      await refresh();
    },
    [refresh],
  );

  const resetStudent = useCallback(
    async (playerId: string) => {
      const repos = repositories();
      await Promise.all([
        repos.gameState.reset(playerId),
        repos.learning.saveStats(playerId, createEmptyLearningStats()),
      ]);
      await refresh();
    },
    [refresh],
  );

  const setMoney = useCallback(
    async (playerId: string, money: number) => {
      const repos = repositories();
      const save = await repos.gameState.load(playerId);
      // 저장본이 없으면 만들지 않는다. 빈 저장본을 새로 쓰면 학생이 처음 들어올 때
      // 시작 아이템 없이 시작하게 된다.
      if (!save) throw new Error('아직 게임을 시작하지 않은 학생이에요');
      await repos.gameState.save(playerId, { ...save, money: Math.max(0, Math.round(money)) });
      await refresh();
    },
    [refresh],
  );

  const createClass = useCallback(
    async (name: string, password: string | null) => {
      const repos = repositories();
      // 다른 선생님이 방금 만들었을 수도 있으니 서버 목록으로 다시 센다
      const existing = await repos.classes.listClasses();
      if (existing.length >= MAX_CLASSES) throw new Error(`학급은 ${MAX_CLASSES}개까지 만들 수 있어요`);
      const first = existing.length === 0;
      const room = await repos.classes.createClass(name, password);
      if (first) {
        // 학급 기능 전에 만든 학생들은 첫 학급의 학생이다
        const profiles = await repos.player.listProfiles();
        for (const profile of profiles.filter((p) => !p.classId)) {
          await repos.player.setClass(profile.id, room.id);
        }
      }
      await refresh();
      return room;
    },
    [refresh],
  );

  const renameClass = useCallback(
    async (classId: string, name: string) => {
      await repositories().classes.renameClass(classId, name);
      await refresh();
    },
    [refresh],
  );

  const setClassPassword = useCallback(
    async (classId: string, password: string | null) => {
      await repositories().classes.setClassPassword(classId, password);
      await refresh();
    },
    [refresh],
  );

  const deleteClass = useCallback(
    async (classId: string) => {
      // 학생이 남은 반은 지우지 않는다 — 그 학생들이 어느 반 이름 목록에도 안 나오게 된다
      const profiles = await repositories().player.listProfiles();
      if (profiles.some((p) => p.classId === classId)) throw new Error('학생이 남아 있는 반은 지울 수 없어요');
      await repositories().classes.deleteClass(classId);
      await refresh();
    },
    [refresh],
  );

  const moveStudent = useCallback(
    async (playerId: string, classId: string | null) => {
      const profiles = await repositories().player.listProfiles();
      if (classId && profiles.filter((p) => p.classId === classId).length >= MAX_STUDENTS_PER_CLASS)
        throw new Error(`그 반은 이미 ${MAX_STUDENTS_PER_CLASS}명이에요`);
      await repositories().player.setClass(playerId, classId);
      await refresh();
    },
    [refresh],
  );

  const removeStudent = useCallback(
    async (playerId: string) => {
      await repositories().player.deleteProfile(playerId);
      await refresh();
    },
    [refresh],
  );

  return {
    data,
    loading,
    error,
    storage: storageMode(),
    refresh,
    addStudents,
    createClass,
    renameClass,
    setClassPassword,
    deleteClass,
    moveStudent,
    resetStudent,
    removeStudent,
    setMoney,
  };
}
