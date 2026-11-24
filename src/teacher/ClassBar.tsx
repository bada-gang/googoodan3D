/**
 * 선생님 화면 맨 위의 학급 고르기 · 만들기 · 이름 바꾸기 · 비밀번호 바꾸기 · 지우기.
 *
 * 학급을 만들면 학생 게임 첫 화면이 '우리 반을 선택하세요' 로 시작한다 (학급이 없으면 그 화면을 건너뛴다).
 * 학생은 반을 고른 뒤 그 반 비밀번호(숫자 4자리)를 눌러야 들어간다.
 * 학급은 MAX_CLASSES(10)개까지 만들 수 있다.
 * 처음 만드는 학급으로는 반이 없는 학생(학급 기능 전에 만든 학생)이 모두 옮겨진다.
 */
import { useState } from 'react';
import {
  CLASS_PASSWORD_LENGTH,
  MAX_CLASSES,
  MAX_CLASS_NAME_LENGTH,
  isValidClassPassword,
  type ClassRoom,
} from '@/types/game';
import { Banner, Button, Card } from './ui';

/** 'none' 은 '반 없음' 묶음 */
export type ClassPick = string | 'none';

type Editing =
  | { mode: 'create' }
  | { mode: 'rename'; id: string }
  | { mode: 'password'; id: string }
  | null;

const INPUT =
  'font-body rounded-lg border border-ink/25 bg-white px-3 py-2 text-[1rem] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/40';

export function ClassBar({
  classes,
  selected,
  counts,
  unassigned,
  classError,
  onSelect,
  onCreate,
  onRename,
  onSetPassword,
  onDelete,
}: {
  classes: ClassRoom[];
  selected: ClassPick | null;
  /** 반마다 학생 수 */
  counts: Record<string, number>;
  /** 반이 없는 학생 수 */
  unassigned: number;
  classError: string | null;
  onSelect: (pick: ClassPick) => void;
  onCreate: (name: string, password: string) => Promise<void>;
  onRename: (classId: string, name: string) => Promise<void>;
  onSetPassword: (classId: string, password: string) => Promise<void>;
  onDelete: (classId: string) => Promise<void>;
}): React.ReactElement {
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const current = classes.find((c) => c.id === selected) ?? null;
  const full = classes.length >= MAX_CLASSES;
  const trimmed = name.trim();
  const taken = classes.some(
    (c) => c.name === trimmed && !(editing?.mode === 'rename' && editing.id === c.id),
  );
  const needsName = editing?.mode === 'create' || editing?.mode === 'rename';
  const needsPassword = editing?.mode === 'create' || editing?.mode === 'password';
  const canSubmit =
    !busy &&
    editing !== null &&
    (!needsName || (trimmed !== '' && !taken)) &&
    (!needsPassword || isValidClassPassword(password));

  const open = (next: Editing, startName = '', startPassword = '') => {
    setEditing(next);
    setName(startName);
    setPassword(startPassword);
    setFailed(null);
    setConfirmDelete(false);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    try {
      await action();
      setEditing(null);
      setConfirmDelete(false);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      setFailed(e?.code ?? e?.message ?? String(error));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!canSubmit || !editing) return;
    if (editing.mode === 'create') void run(() => onCreate(trimmed, password));
    else if (editing.mode === 'rename') void run(() => onRename(editing.id, trimmed));
    else void run(() => onSetPassword(editing.id, password));
  };

  return (
    <Card
      title="학급"
      right={
        <div className="flex items-center gap-3">
          <span className="text-[0.9rem] text-ink-soft tabular-nums">
            {classes.length}/{MAX_CLASSES}개
          </span>
          <Button
            tone="primary"
            disabled={full}
            title={full ? `학급은 ${MAX_CLASSES}개까지 만들 수 있어요` : undefined}
            onClick={() => open({ mode: 'create' })}
          >
            학급 만들기
          </Button>
        </div>
      }
    >
      {full && (
        <p className="mb-3 text-[0.9rem] text-ink-soft">
          학급은 {MAX_CLASSES}개까지 만들 수 있어요. 새로 만들려면 쓰지 않는 빈 학급을 먼저 지워 주세요.
        </p>
      )}

      {classError && (
        <div className="mb-3">
          <Banner tone="error">
            학급 목록을 읽지 못했어요 ({classError}). Firebase 보안 규칙에 학급(classes3d)이 들어갔는지
            확인해 주세요.
          </Banner>
        </div>
      )}

      {classes.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">
          아직 학급이 없어요. 학급을 만들면 학생 게임 첫 화면에 <strong>우리 반을 선택하세요</strong>가
          나와요.
          {unassigned > 0 && ` 처음 만드는 학급으로 지금 학생 ${unassigned}명이 옮겨져요.`}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {classes.map((room) => (
            <Button
              key={room.id}
              tone={selected === room.id ? 'primary' : 'plain'}
              onClick={() => {
                onSelect(room.id);
                setConfirmDelete(false);
              }}
            >
              {room.name} <span className="opacity-75">({counts[room.id] ?? 0}명)</span>
            </Button>
          ))}
          {unassigned > 0 && (
            <Button tone={selected === 'none' ? 'primary' : 'plain'} onClick={() => onSelect('none')}>
              반 없음 <span className="opacity-75">({unassigned}명)</span>
            </Button>
          )}
        </div>
      )}

      {current && editing === null && (
        <div className="mt-3 flex flex-col gap-2 border-t border-ink/10 pt-3">
          <p className="text-[0.95rem] text-ink">
            <strong>{current.name}</strong> 비밀번호{' '}
            {current.password ? (
              <strong className="tabular-nums">{current.password}</strong>
            ) : (
              <span className="text-berry">없음 — 아무나 이 반에 들어갈 수 있어요</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => open({ mode: 'rename', id: current.id }, current.name)}>
              이름 바꾸기
            </Button>
            <Button onClick={() => open({ mode: 'password', id: current.id })}>비밀번호 바꾸기</Button>
            {(counts[current.id] ?? 0) > 0 ? (
              <span className="text-[0.85rem] text-ink-soft">
                학생이 있는 반은 지울 수 없어요 (학생을 다른 반으로 옮기거나 지운 뒤에 지울 수 있어요).
              </span>
            ) : confirmDelete ? (
              <>
                <span className="text-[0.95rem] text-ink">{current.name}을(를) 지울까요?</span>
                <Button tone="danger" disabled={busy} onClick={() => void run(() => onDelete(current.id))}>
                  {busy ? '지우는 중…' : '네, 지울게요'}
                </Button>
                <Button disabled={busy} onClick={() => setConfirmDelete(false)}>
                  취소
                </Button>
              </>
            ) : (
              <Button tone="danger" onClick={() => setConfirmDelete(true)}>
                학급 지우기
              </Button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {needsName && (
            <input
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value.slice(0, MAX_CLASS_NAME_LENGTH))}
              placeholder="예: 2학년 3반"
              aria-label="학급 이름"
              className={`${INPUT} w-56`}
            />
          )}
          {needsPassword && (
            <input
              value={password}
              autoFocus={!needsName}
              inputMode="numeric"
              onChange={(event) =>
                setPassword(event.target.value.replace(/\D/g, '').slice(0, CLASS_PASSWORD_LENGTH))
              }
              placeholder={`비밀번호 숫자 ${CLASS_PASSWORD_LENGTH}자리`}
              aria-label="학급 비밀번호"
              className={`${INPUT} w-48 tracking-[0.2em]`}
            />
          )}
          <Button tone="primary" type="submit" disabled={!canSubmit}>
            {busy ? '저장 중…' : editing.mode === 'create' ? '만들기' : '바꾸기'}
          </Button>
          <Button disabled={busy} onClick={() => setEditing(null)}>
            취소
          </Button>
          {needsName && taken && <span className="text-[0.85rem] text-berry">같은 이름의 학급이 있어요.</span>}
          {needsPassword && (
            <span className="w-full text-[0.85rem] text-ink-soft">
              학생이 반을 고른 뒤 이 숫자 {CLASS_PASSWORD_LENGTH}자리를 눌러야 들어가요. 다른 반 학생이 들어오지
              않게 하는 정도의 잠금이에요.
            </span>
          )}
        </form>
      )}

      {failed && <p className="mt-2 text-[0.9rem] text-berry">처리하지 못했어요 ({failed}).</p>}
    </Card>
  );
}
