/**
 * 첫 화면: 우리 반 고르기. 여러 반이 같은 게임(같은 서버)을 쓰므로 반부터 고르고, 다음 화면에서 그 반 이름만 보여 준다.
 *
 * 학급 목록은 선생님 화면에서 만든다. 학급이 하나도 없거나 목록을 못 읽으면(서버 규칙을 아직 안 올린 경우 등)
 * 이 화면을 건너뛰고 모든 이름을 보여 준다 — 학급 기능이 생기기 전과 같다. 이 화면 때문에 수업이 멈추면 안 된다.
 */
import { useEffect, useState } from 'react';
import { GAME_TITLE } from '@/config/strings';
import { repositories } from '@/data';
import type { ClassRoom } from '@/types/game';
import { EmptyNote } from '../common/ui';
import { ScreenShell } from './ProfileSelectScreen';
import { audio } from '@/audio/sfx';

export function ClassSelectScreen({
  onReady,
}: {
  /** 고른 반. null 이면 반 구분 없이 (학급이 없을 때) */
  onReady: (classRoom: ClassRoom | null, skipped: boolean) => void;
}): React.ReactElement {
  const [classes, setClasses] = useState<ClassRoom[] | null>(null);

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
                onClick={() => {
                  audio.unlock();
                  audio.play('tap');
                  onReady(room, false);
                }}
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
