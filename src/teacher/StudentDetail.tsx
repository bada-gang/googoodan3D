/**
 * 학생 한 명 상세. (명세 73)
 * 단별 정답률 · 자주 틀리는 문제, 그리고 데이터 초기화·삭제.
 *
 * 되돌릴 수 없는 버튼은 한 번 더 묻는다. 브라우저 confirm() 대신 화면 안에서 묻는 이유는
 * 무엇을 지우는지(이름은 남는지) 글로 보여 줄 수 있어서다.
 */
import { useEffect, useState } from 'react';
import { PROBLEM_SET_LABEL } from '@/config/curriculum';
import { CURRENCY, avatarName, formatMoney } from '@/config/strings';
import { MAX_STUDENTS_PER_CLASS, type ClassRoom } from '@/types/game';
import { formatAccuracy, formatLastPlayed, type StudentRow } from './summary';
import { AccuracyBar, Button, EmptyNote } from './ui';
import { ValueSetter } from './ValueSetter';
import { MAX_LEVEL } from '@/config/balance';

type Pending = 'reset' | 'remove' | null;

export function StudentDetail({
  row,
  onClose,
  onReset,
  onRemove,
  onSetMoney,
  onSetLevel,
  classes,
  counts,
  onMove,
}: {
  row: StudentRow;
  /** 옮길 수 있는 반들. 비어 있으면 반 옮기기를 보여 주지 않는다 */
  classes: ClassRoom[];
  /** 반마다 학생 수 (꽉 찬 반으로는 옮기지 못한다) */
  counts: Record<string, number>;
  onMove: (playerId: string, classId: string | null) => Promise<void>;
  onClose: () => void;
  onReset: (playerId: string) => Promise<void>;
  onRemove: (playerId: string) => Promise<void>;
  onSetMoney: (playerId: string, money: number) => Promise<void>;
  onSetLevel: (playerId: string, level: number) => Promise<void>;
}): React.ReactElement {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // 다른 학생을 고르면 물어보던 것을 없던 일로 한다 (입력칸은 ValueSetter 가 스스로 되돌린다)
  useEffect(() => {
    setPending(null);
    setFailed(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.profile.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** closeOnDone: 지우기·초기화는 끝나면 패널을 닫고, 금액 바꾸기는 열어 둔다. */
  /** 처리하고 성공했는지 돌려준다. 실패하면 "처리하지 못했어요"를 띄운다 */
  const run = async (action: () => Promise<void>, closeOnDone = true): Promise<boolean> => {
    setBusy(true);
    setFailed(null);
    try {
      await action();
      if (closeOnDone) onClose();
      else setBusy(false);
      return true;
    } catch (error) {
      const e = error as { code?: string; message?: string };
      setFailed(e?.code ?? e?.message ?? String(error));
      setBusy(false);
      return false;
    }
  };
  /** 값 바꾸기 칸(ValueSetter)용: 실패하면 "바꿨어요"를 띄우지 않게 오류로 알린다 */
  const runOrThrow = async (action: () => Promise<void>): Promise<void> => {
    if (!(await run(action, false))) throw new Error('failed');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35" onClick={onClose}>
      <aside
        role="dialog"
        aria-label={`${row.profile.displayName} 학생 기록`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-sky-soft shadow-2xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-ink/15 bg-sky-soft/95 px-6 py-4 backdrop-blur">
          <div>
            <h2 className="font-game text-[1.6rem] text-ink">{row.profile.displayName}</h2>
            <p className="text-[0.9rem] text-ink-soft">
              {avatarName(row.profile.avatarId)} ·{' '}
              {row.level === null ? '아직 시작 안 함' : `레벨 ${row.level}`} · 마지막 플레이{' '}
              {formatLastPlayed(row.profile.lastPlayedAt)}
            </p>
          </div>
          <Button onClick={onClose} aria-label="닫기">
            닫기
          </Button>
        </header>

        <div className="flex flex-col gap-6 px-6 py-5">
          {row.loadError && (
            <p className="rounded-lg border border-berry/40 bg-berry/10 px-4 py-3 text-[0.9rem] text-berry">
              이 학생의 기록을 읽지 못했어요 ({row.loadError}). 아래 숫자는 비어 있을 수 있어요.
            </p>
          )}

          <section>
            <h3 className="font-game text-[1.2rem] text-ink">전체</h3>
            <p className="mt-1 text-[0.95rem] text-ink-soft">
              푼 문제 {row.totalAttempts}개 · 맞힌 문제 {row.totalCorrect}개 · 정답률{' '}
              {formatAccuracy(row.accuracy)}
            </p>
          </section>

          <section>
            <h3 className="font-game text-[1.2rem] text-ink">단별 정답률</h3>
            <div className="mt-3 flex flex-col gap-2">
              {row.byTable.map((table) => (
                <AccuracyBar
                  key={table.table}
                  label={`${table.table}단`}
                  value={table.accuracy}
                  attempts={table.attempts}
                />
              ))}
            </div>
              <h3 className="font-game mt-5 text-[1.1rem] text-ink">나눗셈 · 뺄셈 정답률</h3>
              <div className="mt-3 flex flex-col gap-2">
                {row.bySet.map((row) => (
                  <AccuracyBar
                    key={row.set}
                    label={PROBLEM_SET_LABEL[row.set]}
                    labelClass="w-40"
                    value={row.accuracy}
                    attempts={row.attempts}
                  />
                ))}
              </div>
          </section>

          <section>
            <h3 className="font-game text-[1.2rem] text-ink">자주 틀리는 문제</h3>
            {row.weakProblems.length === 0 ? (
              <EmptyNote>틀린 문제가 아직 없어요.</EmptyNote>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {row.weakProblems.slice(0, 12).map((problem) => (
                  <li
                    key={problem.key}
                    className="rounded-lg border border-berry/30 bg-berry/10 px-3 py-2"
                  >
                    <span className="font-game block text-[1.15rem] leading-tight text-ink">
                      {problem.label}
                    </span>
                    <span className="block text-[0.8rem] text-ink-soft tabular-nums">
                      {problem.wrong}번 틀림 · {problem.accuracy}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-2 rounded-xl border border-ink/15 bg-white/70 p-4">
            <h3 className="font-game text-[1.2rem] text-ink">관리</h3>

            {failed && (
              <p className="mt-2 text-[0.9rem] text-berry">처리하지 못했어요 ({failed}).</p>
            )}

            {classes.length > 0 && (
              <div className="mt-3 border-b border-ink/10 pb-4">
                <label className="flex flex-wrap items-center gap-2 text-[0.95rem] text-ink">
                  반
                  <select
                    value={row.profile.classId ?? ''}
                    disabled={busy}
                    onChange={(event) =>
                      void run(() => onMove(row.profile.id, event.target.value || null), false)
                    }
                    className="font-body rounded-lg border border-ink/25 bg-white px-3 py-2 text-[1rem] outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/40"
                  >
                    {!row.profile.classId && <option value="">반 없음</option>}
                    {classes.map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                        disabled={room.id !== row.profile.classId && (counts[room.id] ?? 0) >= MAX_STUDENTS_PER_CLASS}
                      >
                        {room.name} ({counts[room.id] ?? 0}/{MAX_STUDENTS_PER_CLASS}명)
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-[0.85rem] text-ink-soft">
                  다른 반으로 옮기면 그 반 이름 목록에 나타나요. 진행도는 그대로예요.
                </p>
              </div>
            )}

            {/* 레벨 · 돈 바꾸기 (ValueSetter). 실패하면 위에 "처리하지 못했어요" */}
            <ValueSetter
              studentId={row.profile.id}
              label="레벨"
              current={row.level}
              format={(level) => `${level}레벨`}
              unit="레벨"
              min={1}
              max={MAX_LEVEL}
              busy={busy}
              note={`1 ~ ${MAX_LEVEL}레벨. 바꾸면 경험치는 0 부터 다시 모으고, 그 레벨까지의 나무 · 동물이 열린다(낮추면 다시 잠긴다, 이미 가진 것은 그대로).`}
              onSave={(level) => runOrThrow(() => onSetLevel(row.profile.id, level))}
            />
            <ValueSetter
              studentId={row.profile.id}
              label="가진 돈"
              current={row.money}
              format={formatMoney}
              unit={CURRENCY}
              min={0}
              busy={busy}
              note="학생이 지금 게임 중이면 잠시 뒤 학생 쪽 값으로 덮어써질 수 있어요. 쉬는 시간에 바꾸는 게 안전합니다."
              onSave={(money) => runOrThrow(() => onSetMoney(row.profile.id, money))}
            />

            {pending === null && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button tone="danger" onClick={() => setPending('reset')}>
                  기록 초기화
                </Button>
                <Button tone="danger" onClick={() => setPending('remove')}>
                  학생 지우기
                </Button>
              </div>
            )}

            {pending === 'reset' && (
              <Confirm
                busy={busy}
                question={`${row.profile.displayName} 학생의 진행도와 학습 기록을 모두 지웁니다. 이름과 캐릭터는 남습니다.`}
                confirmLabel="네, 초기화할게요"
                onCancel={() => setPending(null)}
                onConfirm={() => void run(() => onReset(row.profile.id))}
              />
            )}

            {pending === 'remove' && (
              <Confirm
                busy={busy}
                question={`${row.profile.displayName} 학생을 목록에서 지웁니다. 진행도와 학습 기록도 함께 사라지고 되돌릴 수 없어요.`}
                confirmLabel="네, 지울게요"
                onCancel={() => setPending(null)}
                onConfirm={() => void run(() => onRemove(row.profile.id))}
              />
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Confirm({
  question,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <div className="mt-3">
      <p className="text-[0.95rem] text-ink">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button tone="danger" disabled={busy} onClick={onConfirm}>
          {busy ? '처리 중…' : confirmLabel}
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}
