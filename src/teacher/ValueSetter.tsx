/**
 * 선생님 화면: 학생 저장본의 숫자 하나(돈 · 레벨)를 바꾸는 칸. StudentDetail 의 관리 칸에서 쓴다.
 * 저장본이 없는(아직 시작 안 한) 학생은 바꿀 수 없다.
 */
import { useEffect, useState } from 'react';
import { Button } from './ui';

export function ValueSetter({
  studentId,
  label,
  current,
  format,
  unit,
  min,
  max,
  busy,
  note,
  onSave,
}: {
  /** 다른 학생을 고르면 입력을 처음으로 되돌린다 */
  studentId: string;
  label: string;
  /** 지금 값. null 이면 아직 게임을 시작하지 않았다 */
  current: number | null;
  format: (value: number) => string;
  unit: string;
  min: number;
  max?: number;
  busy: boolean;
  /** 입력칸 아래 안내 */
  note?: string;
  onSave: (value: number) => Promise<void>;
}): React.ReactElement {
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState(false);

  // current 는 일부러 의존성에 넣지 않는다 — 값을 바꾸면 목록이 갱신되면서 "바꿨어요" 표시가 곧바로 사라진다
  useEffect(() => {
    setSaved(false);
    setInput(current === null ? '' : String(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const value = Number(input);
  const valid = input.trim() !== '' && Number.isFinite(value) && value >= min && (max === undefined || value <= max);

  return (
    <div className="mt-3 border-b border-ink/10 pb-4">
      <p className="text-[0.95rem] text-ink">
        {label} <strong className="tabular-nums">{current === null ? '–' : format(current)}</strong>
      </p>
      {current === null ? (
        <p className="mt-1 text-[0.85rem] text-ink-soft">아직 게임을 시작하지 않아 바꿀 수 없어요.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={min}
              max={max}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSaved(false);
              }}
              aria-label={`바꿀 ${label}`}
              className="font-body w-32 rounded-lg border border-ink/25 px-3 py-2 text-right text-[1rem] tabular-nums outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/40"
            />
            <span className="text-[0.95rem] text-ink-soft">{unit}</span>
            <Button
              tone="primary"
              disabled={busy || !valid}
              onClick={() =>
                void onSave(value).then(() => setSaved(true), () => setSaved(false))
              }
            >
              바꾸기
            </Button>
            {saved && <span className="text-[0.9rem] text-leaf-dark">바꿨어요</span>}
          </div>
          {note && <p className="mt-2 text-[0.85rem] text-ink-soft">{note}</p>}
        </>
      )}
    </div>
  );
}
