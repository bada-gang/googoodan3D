/**
 * 선생님 화면. (명세 73, Phase 9)
 *
 * 학생 게임과 분리된 페이지다 (teacher.html). 그래서 three.js 도 게임 스토어도 여기 없다.
 * 학생 데이터는 게임과 똑같은 저장소 인터페이스로만 읽는다.
 */
import { useEffect, useMemo, useState } from 'react';
import { GAME_TITLE } from '@/config/strings';
import { MAX_STUDENTS_PER_CLASS } from '@/types/game';
import { AddStudentForm } from './AddStudentForm';
import { ClassBar, type ClassPick } from './ClassBar';
import { PasscodeGate, useUnlocked } from './PasscodeGate';
import { StudentDetail } from './StudentDetail';
import { StudentTable } from './StudentTable';
import { formatAccuracy, summarizeClass, type StudentRow } from './summary';
import { useClassData } from './useClassData';
import { AccuracyBar, Banner, Button, Card, EmptyNote } from './ui';

/** 마지막으로 본 반 (이 브라우저에만 기억) */
const PICK_KEY = 'googoo3d:teacher-class';

function rememberedPick(): ClassPick | null {
  try {
    return localStorage.getItem(PICK_KEY);
  } catch {
    return null;
  }
}

export function TeacherApp(): React.ReactElement {
  const [unlocked, unlock] = useUnlocked();
  const state = useClassData(unlocked);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState<ClassPick | null>(rememberedPick);

  const allRows = useMemo(() => state.data?.rows ?? [], [state.data]);
  const classes = useMemo(() => state.data?.classes ?? [], [state.data]);
  const unassigned = allRows.filter((r) => !r.profile.classId).length;
  const counts: Record<string, number> = {};
  for (const r of allRows) if (r.profile.classId) counts[r.profile.classId] = (counts[r.profile.classId] ?? 0) + 1;

  // 고른 반이 없어졌거나 아직 안 골랐으면 첫 반으로
  const validPick =
    pick !== null && (classes.some((c) => c.id === pick) || (pick === 'none' && unassigned > 0));
  const activePick: ClassPick | null = classes.length === 0 ? null : validPick ? pick : classes[0].id;
  const activeClass = classes.find((c) => c.id === activePick) ?? null;

  useEffect(() => {
    if (activePick === null) return;
    try {
      localStorage.setItem(PICK_KEY, activePick);
    } catch {
      // 기억 못 해도 괜찮다
    }
  }, [activePick]);

  // 학급이 없으면 모든 학생, 있으면 고른 반 학생만
  const rows = useMemo(
    () =>
      activePick === null
        ? allRows
        : allRows.filter((r) => (activePick === 'none' ? !r.profile.classId : r.profile.classId === activePick)),
    [allRows, activePick],
  );
  const classFull = rows.length >= MAX_STUDENTS_PER_CLASS;
  const summary = useMemo(() => (state.data ? summarizeClass(rows) : undefined), [state.data, rows]);

  if (!unlocked) return <PasscodeGate onUnlock={unlock} />;
  const selected: StudentRow | undefined = rows.find((r) => r.profile.id === selectedId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col gap-5 px-5 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-game text-[1.9rem] text-ink">{GAME_TITLE} · 선생님 화면</h1>
          <p className="text-[0.9rem] text-ink-soft">
            학생들의 곱셈구구 기록을 봅니다. 이 화면은 학생 게임과 분리돼 있어요.
          </p>
        </div>
      </header>

      {state.storage === 'local' && (
        <Banner tone="error">
          아직 서버 저장이 없어 <strong>이 브라우저에 저장된 데이터만</strong> 보고 있어요. 학생
          태블릿의 기록은 여기 나타나지 않습니다.
        </Banner>
      )}

      {state.error && (
        <Banner tone="error">학생 목록을 읽지 못했어요 ({state.error}).</Banner>
      )}

      {state.data && (
        <ClassBar
          classes={classes}
          selected={activePick}
          counts={counts}
          unassigned={unassigned}
          classError={state.data.classError}
          onSelect={setPick}
          onCreate={async (name, password) => {
            const room = await state.createClass(name, password);
            setPick(room.id);
          }}
          onRename={state.renameClass}
          onSetPassword={state.setClassPassword}
          onDelete={state.deleteClass}
        />
      )}

      <Card
        title={activeClass ? `${activeClass.name} 학생` : '학생'}
        right={
          <div className="flex items-center gap-3">
            <span className="text-[0.9rem] text-ink-soft tabular-nums">
              {rows.length}/{MAX_STUDENTS_PER_CLASS}명
            </span>
            <Button
              tone="primary"
              disabled={state.data === null || classFull}
              title={classFull ? `한 학급에 ${MAX_STUDENTS_PER_CLASS}명까지 넣을 수 있어요` : undefined}
              onClick={() => setAdding(true)}
            >
              학생 추가
            </Button>
          </div>
        }
      >
        <p className="-mt-1 mb-3 text-[0.9rem] text-ink-soft">
          학생 이름을 클릭하면 그 학생의 단별 정답률과 자주 틀리는 문제를 볼 수 있어요.
        </p>
        {classFull && (
          <p className="mb-3 text-[0.9rem] text-ink-soft">
            한 학급에는 학생을 {MAX_STUDENTS_PER_CLASS}명까지 넣을 수 있어요.
          </p>
        )}
        {state.data === null && state.loading ? (
          <EmptyNote>불러오는 중이에요…</EmptyNote>
        ) : (
          <StudentTable rows={rows} onSelect={(row) => setSelectedId(row.profile.id)} />
        )}
      </Card>

      {summary && (
        <Card title={activePick === 'none' ? '반 없는 학생 전체' : activeClass ? `${activeClass.name} 전체` : '반 전체'}>
          <p className="text-[1rem] text-ink">
            학생 {summary.studentCount}명
            {summary.studentCount > 0 && ` (${summary.activeCount}명이 문제를 풀었어요)`} · 푼 문제{' '}
            {summary.totalAttempts}개 · 정답률 {formatAccuracy(summary.accuracy)}
          </p>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-game text-[1.1rem] text-ink">단별 정답률</h3>
              <div className="mt-3 flex flex-col gap-2">
                {summary.byTable.map((table) => (
                  <AccuracyBar
                    key={table.table}
                    label={`${table.table}단`}
                    value={table.accuracy}
                    attempts={table.attempts}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-game text-[1.1rem] text-ink">반에서 자주 틀리는 문제</h3>
              {summary.weakProblems.length === 0 ? (
                <EmptyNote>아직 틀린 문제가 없어요.</EmptyNote>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {summary.weakProblems.map((problem) => (
                    <li
                      key={problem.key}
                      className="rounded-lg border border-berry/30 bg-berry/10 px-3 py-2"
                    >
                      <span className="font-game block text-[1.15rem] leading-tight text-ink">
                        {problem.left} × {problem.right}
                      </span>
                      <span className="block text-[0.8rem] text-ink-soft tabular-nums">
                        {problem.wrong}번 틀림
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}

      {selected && (
        <StudentDetail
          row={selected}
          onClose={() => setSelectedId(null)}
          onReset={state.resetStudent}
          onRemove={state.removeStudent}
          onSetMoney={state.setMoney}
          classes={classes}
          counts={counts}
          onMove={state.moveStudent}
        />
      )}

      {adding && (
        <AddStudentForm
          existing={rows.map((row) => row.profile)}
          remaining={Math.max(0, MAX_STUDENTS_PER_CLASS - rows.length)}
          className={activeClass?.name}
          onAdd={(entries) => state.addStudents(entries, activeClass?.id ?? null)}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
