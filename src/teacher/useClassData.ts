/**
 * 교사 화면이 쓰는 데이터 로딩. (명세 73)
 *
 * 학생 게임과 같은 저장소 인터페이스만 쓴다 — 교사 화면 전용 쿼리를 따로 만들지 않는다.
 *
 * 서버(Firestore) 읽기를 아끼려고 (무료 한도: 하루 읽기 수가 정해져 있다, 2026-11 사용자 요청):
 *  - 학생 이름 문서(가볍다)는 모두 읽는다 — 반마다 인원 · 반 없는 학생 수를 세야 한다.
 *  - 무거운 진행도 · 통계는 지금 고른 반 학생만 읽는다 (showDetails). 한 번 읽은 학생은 기억해 둔다.
 *  - 이름 바꾸기 · 반 옮기기 · 지우기처럼 이름 문서만 바뀌면 화면의 목록만 고치고, 다시 읽지 않는다.
 *  - 진행도를 바꾼 학생(초기화 · 돈 바꾸기)은 그 학생만 다시 읽는다.
 *  - [새로고침]을 누르면 목록과 지금 반 학생의 기록을 새로 읽는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { repositories, storageMode, type StorageMode } from '@/data';
import {
  MAX_CLASSES,
  MAX_STUDENTS_PER_CLASS,
  type AvatarId,
  type ClassRoom,
  type GameSaveData,
  type PlayerProfile,
} from '@/types/game';
import { createEmptyLearningStats, type LearningStats } from '@/types/learning';
import type { ClassPick } from './ClassBar';
import { buildStudentRow, summarizeClass, type ClassSummary, type StudentRow } from './summary';

export interface ClassData {
  /** 모든 반의 학생. 기록(진행도 · 통계)은 지금까지 본 반 학생만 채워져 있다 */
  rows: StudentRow[];
  /** 모든 반을 합친 요약. 반별 요약은 화면에서 rows 를 걸러 summarizeClass 로 만든다 */
  summary: ClassSummary;
  classes: ClassRoom[];
  /** 학급 목록을 못 읽은 경우 (서버 규칙에 classes3d 를 아직 안 올렸을 때 등) */
  classError: string | null;
}

export interface UseClassData {
  data: ClassData | null;
  /** 목록 또는 지금 반 학생 기록을 읽는 중 */
  loading: boolean;
  /** 목록 자체를 못 읽은 경우 */
  error: string | null;
  storage: StorageMode;
  refresh: () => Promise<void>;
  /** 이 반 학생의 기록(진행도 · 통계)을 읽는다. 이미 읽은 학생은 다시 읽지 않는다. null 이면 모든 학생 (학급이 없을 때) */
  showDetails: (pick: ClassPick | null) => void;
  /** 명단을 한 번에 등록한다. */
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

/** 한 학생의 기록 (읽은 것) */
interface Detail {
  stats: LearningStats | null;
  save: GameSaveData | null;
  error: string | null;
}

function message(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string };
    return e.code ?? e.message ?? String(error);
  }
  return String(error);
}

async function loadDetail(playerId: string): Promise<Detail> {
  const repos = repositories();
  try {
    const [stats, save] = await Promise.all([repos.learning.loadStats(playerId), repos.gameState.load(playerId)]);
    return { stats, save, error: null };
  } catch (e) {
    // 한 학생을 못 읽어도 나머지는 보여준다. 그 학생 줄에만 사유를 남긴다.
    return { stats: null, save: null, error: message(e) };
  }
}

function inPick(profile: PlayerProfile, pick: ClassPick | null): boolean {
  if (pick === null) return true;
  return pick === 'none' ? !profile.classId : profile.classId === pick;
}

export function useClassData(enabled: boolean): UseClassData {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classError, setClassError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<ClassPick | null | undefined>(undefined);
  /** 읽는 중이거나 읽은 학생 (같은 학생을 두 번 읽지 않게) */
  const requested = useRef(new Set<string>());

  /** 이름 목록 · 학급 목록 (가볍다) */
  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const repos = repositories();
      const [list, classResult] = await Promise.all([
        repos.player.listProfiles(),
        repos.classes
          .listClasses()
          .then((rooms) => ({ rooms, err: null as string | null }))
          .catch((e) => ({ rooms: [] as ClassRoom[], err: message(e) })),
      ]);
      setProfiles(list);
      setClasses(classResult.rooms);
      setClassError(classResult.err);
    } catch (e) {
      setError(message(e));
    } finally {
      setListLoading(false);
    }
  }, []);

  /** 이 학생들의 기록을 읽는다 (force 면 이미 읽었어도 다시) */
  const loadDetails = useCallback(async (ids: string[], force = false) => {
    const todo = ids.filter((id) => force || !requested.current.has(id));
    if (todo.length === 0) return;
    for (const id of todo) requested.current.add(id);
    setDetailLoading(true);
    try {
      const loaded = await Promise.all(todo.map(async (id) => [id, await loadDetail(id)] as const));
      setDetails((prev) => ({ ...prev, ...Object.fromEntries(loaded) }));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void loadList();
  }, [enabled, loadList]);

  // 고른 반 학생의 기록만 읽는다 (목록이 바뀌어 새 학생이 생겨도 그 학생만)
  useEffect(() => {
    if (!profiles || pick === undefined) return;
    void loadDetails(profiles.filter((p) => inPick(p, pick)).map((p) => p.id));
  }, [profiles, pick, loadDetails]);

  const showDetails = useCallback((next: ClassPick | null) => setPick(next), []);

  /** 새로고침: 목록을 새로 읽고, 기억해 둔 기록을 비운다 (지금 반 학생 기록은 위 effect 가 다시 읽고, 다른 반은 그 반을 볼 때 읽는다) */
  const refresh = useCallback(async () => {
    requested.current = new Set();
    setDetails({});
    await loadList();
  }, [loadList]);

  const data = useMemo<ClassData | null>(() => {
    if (!profiles) return null;
    const rows = profiles.map((profile) => {
      const d = details[profile.id];
      return buildStudentRow(profile, d?.stats ?? null, d?.save ?? null, d?.error ?? null);
    });
    return { rows, summary: summarizeClass(rows), classes, classError };
  }, [profiles, details, classes, classError]);

  /* ------------------------------ 바꾸기 ------------------------------ */

  const patchProfile = (playerId: string, patch: Partial<PlayerProfile> | null) =>
    setProfiles((prev) =>
      prev ? (patch === null ? prev.filter((p) => p.id !== playerId) : prev.map((p) => (p.id === playerId ? { ...p, ...patch } : p))) : prev,
    );

  const addStudents = useCallback(
    async (entries: { displayName: string; avatarId: AvatarId }[], classId: string | null) => {
      const repos = repositories();
      // 다른 화면에서 방금 넣었을 수도 있으니 서버에서 그 반 인원만 다시 센다
      const now = classId
        ? (await repos.player.listProfiles(classId)).length
        : (profiles ?? []).filter((p) => !p.classId).length;
      if (now + entries.length > MAX_STUDENTS_PER_CLASS)
        throw new Error(`한 학급에 ${MAX_STUDENTS_PER_CLASS}명까지예요 (지금 ${now}명)`);
      // 순서대로 만든다. 한꺼번에 던지면 실패한 이름이 어느 것인지 알기 어렵다.
      const created: PlayerProfile[] = [];
      for (const entry of entries) {
        created.push(await repos.player.createProfile(entry.displayName, entry.avatarId, undefined, classId));
      }
      // 새 학생은 기록이 없다. 목록에만 붙인다 (다시 읽지 않는다)
      setProfiles((prev) => [...created, ...(prev ?? [])]);
      setDetails((prev) => ({
        ...prev,
        ...Object.fromEntries(created.map((p) => [p.id, { stats: null, save: null, error: null }])),
      }));
      for (const p of created) requested.current.add(p.id);
    },
    [profiles],
  );

  const resetStudent = useCallback(
    async (playerId: string) => {
      const repos = repositories();
      await Promise.all([repos.gameState.reset(playerId), repos.learning.saveStats(playerId, createEmptyLearningStats())]);
      await loadDetails([playerId], true);
    },
    [loadDetails],
  );

  const setMoney = useCallback(
    async (playerId: string, money: number) => {
      const repos = repositories();
      const save = await repos.gameState.load(playerId);
      // 저장본이 없으면 만들지 않는다. 빈 저장본을 새로 쓰면 학생이 처음 들어올 때
      // 시작 아이템 없이 시작하게 된다.
      if (!save) throw new Error('아직 게임을 시작하지 않은 학생이에요');
      const next = { ...save, money: Math.max(0, Math.round(money)) };
      await repos.gameState.save(playerId, next);
      // 방금 쓴 것을 그대로 화면에 (다시 읽지 않는다)
      setDetails((prev) => ({ ...prev, [playerId]: { ...(prev[playerId] ?? { stats: null, error: null }), save: next } }));
    },
    [],
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
        for (const profile of (profiles ?? []).filter((p) => !p.classId)) {
          await repos.player.setClass(profile.id, room.id);
          patchProfile(profile.id, { classId: room.id });
        }
      }
      setClasses([...existing, room]);
      return room;
    },
    [profiles],
  );

  const renameClass = useCallback(async (classId: string, name: string) => {
    await repositories().classes.renameClass(classId, name);
    setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, name: name.trim() } : c)));
  }, []);

  const setClassPassword = useCallback(async (classId: string, password: string | null) => {
    await repositories().classes.setClassPassword(classId, password);
    setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, password } : c)));
  }, []);

  const deleteClass = useCallback(async (classId: string) => {
    // 학생이 남은 반은 지우지 않는다 — 그 학생들이 어느 반 이름 목록에도 안 나오게 된다. 그 반만 서버에서 센다
    if ((await repositories().player.listProfiles(classId)).length > 0) throw new Error('학생이 남아 있는 반은 지울 수 없어요');
    await repositories().classes.deleteClass(classId);
    setClasses((prev) => prev.filter((c) => c.id !== classId));
  }, []);

  const moveStudent = useCallback(async (playerId: string, classId: string | null) => {
    // 옮겨 갈 반 인원만 서버에서 센다
    if (classId && (await repositories().player.listProfiles(classId)).length >= MAX_STUDENTS_PER_CLASS)
      throw new Error(`그 반은 이미 ${MAX_STUDENTS_PER_CLASS}명이에요`);
    await repositories().player.setClass(playerId, classId);
    patchProfile(playerId, { classId });
  }, []);

  const removeStudent = useCallback(async (playerId: string) => {
    await repositories().player.deleteProfile(playerId);
    patchProfile(playerId, null);
  }, []);

  return {
    data,
    loading: listLoading || detailLoading,
    error,
    storage: storageMode(),
    refresh,
    showDetails,
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
