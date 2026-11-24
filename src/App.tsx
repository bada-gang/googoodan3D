/**
 * 앱 흐름: 반 선택 -> 이름 선택 -> 구구단 선택 -> 게임. (명세 8)
 * 학급이 하나도 없으면 반 선택은 건너뛴다.
 *
 * 게임 셸은 항상 논리 해상도 비율(1280×800)을 유지하고,
 * React UI 는 LogicalLayer 로 같은 좌표계에서 그린 뒤 통째로 배율 조정한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProblemSet } from '@/config/curriculum';
import { GAME_HEIGHT, GAME_WIDTH } from '@/config/layout';
import { useGameStore } from '@/state/gameStore';
import { startAutoSave, stopAutoSave } from '@/state/persistence';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import type { ClassRoom, PlayerProfile } from '@/types/game';
import { audio } from '@/audio/sfx';
import { enterFullscreenOnFirstTouch } from '@/ui/fullscreen';
import { LogicalLayer, useShellScale } from '@/ui/common/LogicalLayer';
import { ClassSelectScreen } from '@/ui/screens/ClassSelectScreen';
import { GameEndScreen } from '@/ui/screens/GameEndScreen';
import { GameScreen } from '@/ui/screens/GameScreen';
import { ProfileSelectScreen } from '@/ui/screens/ProfileSelectScreen';
import { TableSelectScreen } from '@/ui/screens/TableSelectScreen';

const ASPECT = GAME_WIDTH / GAME_HEIGHT;

export function App(): React.ReactElement {
  const screen = useUiStore((s) => s.screen);
  const setScreen = useUiStore((s) => s.setScreen);
  const beginSession = useGameStore((s) => s.beginSession);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [classRoom, setClassRoom] = useState<ClassRoom | null>(null);
  /** 학급이 없어 반 고르기를 건너뛰었는지 (그러면 '반 다시 고르기'도 없다) */
  const [classSkipped, setClassSkipped] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const scale = useShellScale(shellRef);

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.05);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  useEffect(() => () => stopAutoSave(), []);

  // 브라우저는 사용자가 화면을 만진 직후에만 전체화면을 허용한다.
  // 그래서 자동 진입은 첫 터치에 걸어 두는 수밖에 없다.
  useEffect(
    () => enterFullscreenOnFirstTouch(() => useSettingsStore.getState().fullscreen),
    [],
  );

  const start = useCallback(
    async (tables: number[], sets: ProblemSet[]) => {
      if (!profile) return;
      audio.unlock();
      const { bgmOn, sfxOn } = useSettingsStore.getState();
      audio.setSfxEnabled(sfxOn);
      audio.setBgmEnabled(bgmOn);

      await beginSession(profile, tables, sets);
      startAutoSave();
      setScreen('game');
    },
    [profile, beginSession, setScreen],
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#2b332d]">
      <div
        ref={shellRef}
        className="bg-sky-soft relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.45)]"
        style={{
          width: `min(100dvw, calc(100dvh * ${ASPECT}))`,
          height: `min(100dvh, calc(100dvw / ${ASPECT}))`,
        }}
      >
        {/* 3D 캔버스는 실제 화면 크기로 그린다 (선명도 유지) */}
        {screen === 'game' && <GameScreen.Canvas />}

        <LogicalLayer scale={scale}>
          {screen === 'class' && (
            <ClassSelectScreen
              onReady={(room, skipped) => {
                setClassRoom(room);
                setClassSkipped(skipped);
                setScreen('profile');
              }}
            />
          )}

          {screen === 'profile' && (
            <ProfileSelectScreen
              classRoom={classRoom}
              onBack={
                classSkipped
                  ? undefined
                  : () => {
                      setClassRoom(null);
                      setScreen('class');
                    }
              }
              onReady={(selected) => {
                setProfile(selected);
                setScreen('tables');
              }}
            />
          )}

          {screen === 'tables' && profile && (
            <TableSelectScreen
              profile={profile}
              onStart={(tables, sets) => void start(tables, sets)}
              onBack={() => {
                setProfile(null);
                setScreen('profile');
              }}
              // 바뀐 모습 · 이름으로 세션을 시작해야 게임 안 캐릭터와 저장 데이터가 어긋나지 않는다
              onProfileChanged={(patch) =>
                setProfile((current) => (current ? { ...current, ...patch } : current))
              }
            />
          )}

          {screen === 'game' && <GameScreen />}

          {screen === 'ended' && <GameEndScreen />}
        </LogicalLayer>
      </div>

      {portrait && <RotateHint />}
    </div>
  );
}

/** 가로 화면 최적화이므로 세로일 때는 안내한다. (명세 1) */
function RotateHint(): React.ReactElement {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-[#2b332d] p-8 text-center">
      <svg viewBox="0 0 24 24" width="96" height="96" aria-hidden="true">
        <path
          d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm0 3v14h10V5H7Z"
          fill="#fff6e2"
        />
        <path d="M12 17.2a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z" fill="#f6c453" />
      </svg>
      <p className="font-game text-cream text-[2rem]">태블릿을 가로로 돌려 주세요</p>
    </div>
  );
}
