/**
 * 설정. 소리는 스위치 하나로 배경음과 효과음을 함께 켜고 끈다. (명세 61, 요청: 하나로 합치기)
 * 저장 값은 배경음 · 효과음 따로 남겨 둔다 — 다시 나누고 싶을 때 화면만 바꾸면 된다.
 * 오늘의 학습 상황도 여기서 가볍게 보여준다.
 */
import { useState } from 'react';
import { missingArtCount } from '@/config/artReady';
import { PROBLEM_SET_LABEL } from '@/config/curriculum';
import { useGameStore } from '@/state/gameStore';
import { flushSave, stopAutoSave } from '@/state/persistence';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { GameButton, OverlayShell } from '../common/ui';
import { audio } from '@/audio/sfx';
import { CREDITS } from '@/config/credits';
import { enterFullscreen, exitFullscreen, isFullscreenSupported } from '../fullscreen';

/** 기록 항목 이름(푼 문제 · 맞힌 문제 · 정답률) 글씨색. 크림색 바탕에서 잘 읽히는 진한 파랑 */
const RECORD_LABEL_COLOR = '#2f6fb8';

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        audio.play('tap');
        onToggle();
      }}
      // 높이는 처음(70px)보다 5% 낮게 (사용자 요청)
      className="panel-paper flex h-[66.5px] w-full items-center justify-between px-5 py-2"
    >
      <span className="font-game text-[1.35rem]">{label}</span>
      <span
        className={[
          'relative h-[38px] w-[76px] rounded-full border-4 border-ink transition-colors',
          on ? 'bg-leaf' : 'bg-white',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-[1px] h-[26px] w-[26px] rounded-full border-[3px] border-ink bg-cream transition-all',
            on ? 'left-[38px]' : 'left-[2px]',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

export function SettingsOverlay(): React.ReactElement {
  const closeOverlay = useUiStore((s) => s.closeOverlay);
  const setScreen = useUiStore((s) => s.setScreen);
  const settings = useSettingsStore();
  const stats = useGameStore((s) => s.stats);
  const tables = useGameStore((s) => s.selectedTables);
  const sets = useGameStore((s) => s.selectedSets);
  const practicing = [...(tables.length > 0 ? [tables.join(', ') + '단'] : []), ...sets.map((set) => PROBLEM_SET_LABEL[set])];
  const level = useGameStore((s) => s.level);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);

  const accuracy =
    stats.totalAttempts > 0 ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100) : 0;

  /**
   * 게임을 끝낸다. 순서가 중요하다.
   * 저장이 **끝날 때까지 기다린** 뒤에 화면을 넘겨야 마지막 수확·정답이 빠지지 않는다.
   * (기존 "다시 시작하기"는 새로고침이라 저장이 중간에 끊길 수 있다.)
   */
  const endGame = async () => {
    if (ending) return;
    setEnding(true);
    audio.setBgmEnabled(false);
    try {
      stopAutoSave();
      await flushSave();
    } catch (error) {
      console.error('[settings] 마지막 저장에 실패했습니다.', error);
    }
    // 수업이 끝났으니 전체화면에서도 나온다. 태블릿을 걷을 때 빠져나올 방법이 없으면 곤란하다.
    await exitFullscreen();
    closeOverlay();
    setScreen('ended');
  };

  return (
    <OverlayShell title="설정" onClose={closeOverlay}>
      <div className="flex flex-col gap-3">
        <Toggle
          label="소리"
          // 둘 중 하나라도 켜져 있으면 켜진 것으로 보여 준다 (예전 설정에서 하나만 꺼 둔 경우)
          on={settings.bgmOn || settings.sfxOn}
          onToggle={() => {
            const next = !(settings.bgmOn || settings.sfxOn);
            settings.set('bgmOn', next);
            settings.set('sfxOn', next);
            audio.setBgmEnabled(next);
            audio.setSfxEnabled(next);
          }}
        />
        <Toggle
          label="왼손잡이 버튼 배치"
          on={settings.leftHanded}
          onToggle={() => settings.toggle('leftHanded')}
        />

        {isFullscreenSupported() && (
          <Toggle
            label="전체화면"
            on={settings.fullscreen}
            onToggle={() => {
              const next = !settings.fullscreen;
              settings.set('fullscreen', next);
              // 이 탭 자체가 사용자 제스처라 지금 바로 전환할 수 있다
              void (next ? enterFullscreen() : exitFullscreen());
            }}
          />
        )}

        <div className="panel-paper mt-2 flex flex-col gap-1 px-5 py-4">
          {/* 제목과 기록을 한 줄로. 항목 이름은 파란 글씨 (사용자 요청) */}
          <p className="font-game flex flex-wrap items-baseline gap-x-3 text-[1.15rem] text-ink-soft">
            <span className="text-[1.35rem] text-ink">오늘까지의 기록</span>
            <span>
              <span style={{ color: RECORD_LABEL_COLOR }}>푼 문제</span> {stats.totalAttempts}개 ·{' '}
              <span style={{ color: RECORD_LABEL_COLOR }}>맞힌 문제</span> {stats.totalCorrect}개 ·{' '}
              <span style={{ color: RECORD_LABEL_COLOR }}>정답률</span> {accuracy}%
            </span>
          </p>
          <p className="font-game text-[1.15rem] text-ink-soft">
            지금 연습하는 것: {practicing.length > 0 ? practicing.join(' · ') : '없음'} · 레벨 {level}
          </p>
        </div>

        {missingArtCount() > 0 && (
          <p className="font-game px-2 text-center text-[1rem] text-ink-soft">
            아직 임시 그림이 섞여 있어요. 그림을 만들면 자동으로 바뀌어요.
          </p>
        )}

        <GameButton
          className="mt-1 w-full"
          onClick={() => {
            audio.setBgmEnabled(false);
            window.location.reload();
          }}
        >
          다른 이름으로 다시 시작하기
        </GameButton>

        {/*
          맨 아래 종료 버튼. 한 번 더 묻는다 — 잘못 눌러서 판이 끝나면
          2학년에게는 되돌릴 방법이 없다.
        */}
        {confirming ? (
          <div className="panel-paper mt-1 flex flex-col items-center gap-3 px-5 py-4">
            <p className="font-game text-center text-[1.3rem] text-ink">
              게임을 끝낼까요? 지금까지 한 것은 저장돼요.
            </p>
            <div className="flex gap-3">
              <GameButton onClick={() => setConfirming(false)}>더 할래요</GameButton>
              <GameButton tone="berry" disabled={ending} onClick={() => void endGame()}>
                {ending ? '저장 중…' : '네, 끝낼래요'}
              </GameButton>
            </div>
          </div>
        ) : (
          <GameButton tone="berry" className="w-full" onClick={() => setConfirming(true)}>
            게임 종료
          </GameButton>
        )}

        {/* 출처 표기가 필요한 음원 (config/credits.ts). 맨 아래 게임 종료 버튼 밑에 작게 */}
        <div className="px-2 text-center">
          {CREDITS.map((line) => (
            <p key={line} className="text-[0.8rem] text-ink-soft">
              {line}
            </p>
          ))}
        </div>
      </div>
    </OverlayShell>
  );
}
