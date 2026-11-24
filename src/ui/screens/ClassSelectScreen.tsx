/**
 * 첫 화면: 우리 반 고르기 → (비밀번호가 있는 반이면) 반 비밀번호 누르기.
 * 여러 반이 같은 게임(같은 서버)을 쓰므로 반부터 고르고, 다음 화면에서 그 반 이름만 보여 준다.
 *
 * 학급 목록과 비밀번호는 선생님 화면에서 만든다. 학급이 하나도 없거나 목록을 못 읽으면(서버 규칙 문제 등)
 * 이 화면을 건너뛰고 모든 이름을 보여 준다 — 학급 기능이 생기기 전과 같다. 이 화면 때문에 수업이 멈추면 안 된다.
 *
 * 비밀번호는 2학년이 태블릿 자판 없이 누를 수 있게 큰 숫자판으로 받는다. 한 번 맞히면 이 탭을 닫거나
 * 새로 고칠 때까지 같은 반은 다시 묻지 않는다 (선생님이 비밀번호를 바꾸면 다시 묻는다).
 */
import { useEffect, useState } from 'react';
import { GAME_TITLE } from '@/config/strings';
import { repositories } from '@/data';
import { CLASS_PASSWORD_LENGTH, type ClassRoom } from '@/types/game';
import { EmptyNote, GameButton } from '../common/ui';
import { ScreenShell } from './ProfileSelectScreen';
import { audio } from '@/audio/sfx';

const UNLOCKED_KEY = 'googoo3d:class-unlocked';

/** 이번 탭에서 맞힌 반 비밀번호 { classId: password } */
function readUnlocked(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(UNLOCKED_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function rememberUnlocked(room: ClassRoom): void {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, JSON.stringify({ ...readUnlocked(), [room.id]: room.password }));
  } catch {
    // 기억 못 하면 다음에 한 번 더 누르면 된다
  }
}

export function ClassSelectScreen({
  onReady,
}: {
  /** 고른 반. null 이면 반 구분 없이 (학급이 없을 때) */
  onReady: (classRoom: ClassRoom | null, skipped: boolean) => void;
}): React.ReactElement {
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);
  /** 비밀번호를 누르는 중인 반 */
  const [locked, setLocked] = useState<ClassRoom | null>(null);

  useEffect(() => {
    let alive = true;
    void repositories()
      .classes.listClasses()
      .catch((error) => {
        console.warn('[class] 학급 목록을 읽지 못해 반 고르기를 건너뜁니다.', error);
        return [] as ClassRoom[];
      })
      .then((list) => {
        if (!alive) return;
        if (list.length === 0) onReady(null, true);
        else setClasses(list);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (room: ClassRoom) => {
    audio.unlock();
    audio.play('tap');
    if (!room.password || readUnlocked()[room.id] === room.password) onReady(room, false);
    else setLocked(room);
  };

  if (locked) {
    return (
      <PasswordPad
        room={locked}
        onBack={() => setLocked(null)}
        onPass={() => {
          rememberUnlocked(locked);
          onReady(locked, false);
        }}
      />
    );
  }

  return (
    <ScreenShell title={GAME_TITLE}>
      {classes === null ? (
        <EmptyNote>반 목록을 불러오는 중이에요…</EmptyNote>
      ) : (
        <div className="flex w-full flex-col items-center gap-5">
          <p className="font-game text-[1.6rem] text-ink">우리 반을 선택하세요</p>
          <div className="no-scrollbar grid max-h-[400px] w-full grid-cols-3 gap-4 overflow-y-auto px-2 pb-2">
            {classes.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => choose(room)}
                className="panel-paper font-game flex min-h-[110px] items-center justify-center px-4 py-3 text-center text-[1.8rem] leading-tight text-ink transition active:translate-y-[3px]"
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </ScreenShell>
  );
}

/** 반 비밀번호 숫자판. 자리 수를 다 누르면 바로 맞는지 본다. */
function PasswordPad({
  room,
  onPass,
  onBack,
}: {
  room: ClassRoom;
  onPass: () => void;
  onBack: () => void;
}): React.ReactElement {
  const [digits, setDigits] = useState('');
  const [wrong, setWrong] = useState(false);
  /** 틀릴 때마다 바뀌어 흔들기 애니메이션을 다시 튼다 */
  const [shake, setShake] = useState(0);

  const press = (digit: string) => {
    if (digits.length >= CLASS_PASSWORD_LENGTH) return;
    audio.play('tap');
    setWrong(false);
    const next = digits + digit;
    setDigits(next);
    if (next.length < CLASS_PASSWORD_LENGTH) return;
    if (next === room.password) {
      audio.play('correct');
      onPass();
    } else {
      // 다 누른 칸을 잠깐 보여 준 뒤 비운다
      window.setTimeout(() => {
        audio.play('wrong');
        setWrong(true);
        setShake((n) => n + 1);
        setDigits('');
      }, 250);
    }
  };

  const erase = () => {
    audio.play('tap');
    setDigits((d) => d.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <ScreenShell title={room.name}>
      <div className="flex flex-col items-center gap-4">
        <p className="font-game text-[1.5rem] text-ink">우리 반 비밀번호를 눌러 주세요</p>

        <div key={shake} className={['flex gap-3', shake > 0 ? 'animate-shake-soft' : ''].join(' ')}>
          {Array.from({ length: CLASS_PASSWORD_LENGTH }, (_, i) => (
            <div
              key={i}
              className={[
                'panel-paper flex h-[64px] w-[58px] items-center justify-center',
                wrong ? 'ring-4 ring-[var(--color-berry)]' : i === digits.length ? 'ring-4 ring-[var(--color-gold)]' : '',
              ].join(' ')}
            >
              {i < digits.length && <span className="h-5 w-5 rounded-full bg-[var(--color-ink)]" />}
            </div>
          ))}
        </div>

        <p className="font-game min-h-[1.6rem] text-[1.2rem] text-[var(--color-berry)]">
          {wrong ? '비밀번호가 달라요. 다시 눌러 주세요' : ''}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="btn-game h-[64px] w-[96px] text-[2rem]"
            >
              {key}
            </button>
          ))}
          <button type="button" onClick={erase} className="btn-game h-[64px] w-[96px] whitespace-nowrap !px-0 text-[1.2rem]">
            지우기
          </button>
          <button type="button" onClick={() => press('0')} className="btn-game h-[64px] w-[96px] text-[2rem]">
            0
          </button>
          <span />
        </div>

        <GameButton
          onClick={() => {
            audio.play('tap');
            onBack();
          }}
        >
          다른 반 고르기
        </GameButton>
      </div>
    </ScreenShell>
  );
}
