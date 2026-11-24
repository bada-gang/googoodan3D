/**
 * 학생 프로필 미리 만들기. (명세 10, 73)
 *
 * 명단을 통째로 붙여 넣게 한다. 수업 전에 스무 명 넘는 이름을
 * 하나씩 입력하고 캐릭터를 고르는 건 준비 시간을 너무 잡아먹는다.
 */
import { useMemo, useState } from 'react';
import { avatarName } from '@/config/strings';
import { MAX_PLAYER_NAME_LENGTH, type PlayerProfile } from '@/types/game';
import { planNewStudents } from './roster';
import { Button } from './ui';

export function AddStudentForm({
  existing,
  remaining,
  className,
  onAdd,
  onClose,
}: {
  existing: PlayerProfile[];
  /** 이 반에 더 넣을 수 있는 학생 수 */
  remaining: number;
  /** 학생을 넣을 반 이름 (학급이 없으면 없음) */
  className?: string;
  onAdd: (entries: { displayName: string; avatarId: PlayerProfile['avatarId'] }[]) => Promise<void>;
  onClose: () => void;
}): React.ReactElement {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const planned = useMemo(() => planNewStudents(raw, existing), [raw, existing]);
  const duplicates = planned.filter((p) => p.sharesName);
  const tooMany = planned.length > remaining;
  const tooLong = planned.filter((p) => [...p.displayName].length > MAX_PLAYER_NAME_LENGTH);
  const blocked = planned.length === 0 || tooMany || tooLong.length > 0;

  const submit = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await onAdd(planned.map(({ displayName, avatarId }) => ({ displayName, avatarId })));
      onClose();
    } catch (error) {
      setFailed((error as { code?: string; message?: string })?.code ?? String(error));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-label="학생 추가"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-lg flex-col overflow-y-auto rounded-2xl bg-sky-soft p-6 shadow-2xl"
      >
        <h2 className="font-game text-[1.5rem] text-ink">{className ? `${className}에 학생 추가` : '학생 추가'}</h2>
        <p className="mt-1 text-[0.9rem] text-ink-soft">
          이름을 한 줄에 하나씩 적거나 쉼표로 구분해 붙여 넣으세요 ({MAX_PLAYER_NAME_LENGTH}글자까지). 캐릭터는
          자동으로 배정합니다.
        </p>

        <textarea
          value={raw}
          autoFocus
          onChange={(event) => setRaw(event.target.value)}
          rows={8}
          placeholder={'김민준\n이서연\n박도윤'}
          aria-label="학생 이름 목록"
          className="font-body mt-4 w-full resize-y rounded-lg border border-ink/25 bg-white px-4 py-3 text-[1rem] leading-7 outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/40"
        />

        {planned.length > 0 && (
          <div className="mt-4">
            <p className="text-[0.9rem] text-ink-soft">{planned.length}명을 만듭니다.</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {planned.map((student, index) => (
                <li
                  key={`${student.displayName}-${index}`}
                  className="rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[0.95rem]"
                >
                  <span className="font-game text-[1.05rem]">{student.displayName}</span>
                  <span className="ml-2 text-[0.85rem] text-ink-soft">
                    {avatarName(student.avatarId)}
                  </span>
                </li>
              ))}
            </ul>

            {duplicates.length > 0 && (
              <p className="mt-3 text-[0.85rem] text-ink-soft">
                이름이 겹치는 학생이 있어서 서로 다른 캐릭터를 배정했어요 — 학생이 자기 이름을
                찾을 때 캐릭터로 구분합니다.
              </p>
            )}
          </div>
        )}

        {tooMany && (
          <p className="mt-3 text-[0.9rem] text-berry">
            이 반에는 {remaining}명만 더 넣을 수 있어요 (한 학급 최대 20명). {planned.length - remaining}명을 빼 주세요.
          </p>
        )}

        {tooLong.length > 0 && (
          <p className="mt-3 text-[0.9rem] text-berry">
            이름은 {MAX_PLAYER_NAME_LENGTH}글자까지 쓸 수 있어요. 줄여 주세요:{' '}
            {tooLong.map((p) => p.displayName).join(', ')}
          </p>
        )}

        {failed &&<p className="mt-3 text-[0.9rem] text-berry">만들지 못했어요 ({failed}).</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button tone="primary" onClick={() => void submit()} disabled={blocked || busy}>
            {busy ? '만드는 중…' : `${planned.length || ''}명 만들기`}
          </Button>
        </div>
      </div>
    </div>
  );
}
