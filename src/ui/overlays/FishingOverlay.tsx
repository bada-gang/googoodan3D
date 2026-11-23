/**
 * 낚시 창. 낚시 중에는 화면 아래에 작은 판을 띄우고, 3D 연못(찌)이 보이게 가운데는 비워 둔다.
 *
 *  - 기다리기: "입질을 기다려요" + 그만하기
 *  - 입질: 막대 멈추기 게임. 표시가 좌우로 오가고, 초록 칸에서 멈추면 잡는다 (화면 어디를 눌러도 멈춘다).
 *          물고기마다 표시 빠르기와 칸 너비가 다르다 (config/fishing). 한 번만 멈출 수 있다.
 *  - 잡음: 물고기 카드 (도감에 처음 오르면 알려 준다)
 *  - 놓침: 짧은 안내 뒤 저절로 닫힌다
 * 낚시 중에는 화면 전체를 덮어(투명) 다른 버튼 · 조이스틱을 막는다.
 */
import { useEffect, useRef, useState } from 'react';
import { BITE_MESSAGE, FISH, caughtMessage } from '@/config/fishing';
import { CURRENCY } from '@/config/strings';
import { useFishing } from '@/state/fishingStore';
import { useGameStore } from '@/state/gameStore';
import { cropIcon } from '../common/icons';
import { GameButton, Icon } from '../common/ui';

/** 멈춘 뒤 결과(맞음/빗나감)를 막대 위에 보여 주는 시간 (ms) */
const STOP_SHOW_MS = 550;

export function FishingOverlay(): React.ReactElement | null {
  const phase = useFishing((s) => s.phase);
  if (phase === 'idle') return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-[44]">
      {phase === 'bite' ? (
        <BiteGame />
      ) : phase === 'caught' ? (
        <CaughtCard />
      ) : (
        <StatusPanel />
      )}
    </div>
  );
}

/** 던지기 · 기다리기 · 끌어올리기 · 놓침 안내 */
function StatusPanel(): React.ReactElement {
  const phase = useFishing((s) => s.phase);
  const cancel = useFishing((s) => s.cancel);
  const left = useGameStore((s) => s.fishingCastsLeft());
  const text =
    phase === 'casting'
      ? '찌를 던졌어요!'
      : phase === 'waiting'
        ? '물고기가 물 때까지 기다려요…'
        : phase === 'reeling'
          ? '영차! 끌어올려요!'
          : '앗, 놓쳤어요! 다음엔 꼭 잡아요';
  return (
    <BottomPanel>
      <p className="font-game text-ink text-[1.5rem]">{text}</p>
      {phase === 'waiting' && (
        <div className="flex items-center gap-4">
          <span className="font-game text-ink-soft text-[1.1rem]">오늘 {left}번 남았어요</span>
          <GameButton onClick={cancel}>그만하기</GameButton>
        </div>
      )}
    </BottomPanel>
  );
}

/** 막대 멈추기 게임 */
function BiteGame(): React.ReactElement {
  const fish = useFishing((s) => s.fish);
  const reel = useFishing((s) => s.reel);
  const def = fish ? FISH[fish] : null;
  const marker = useRef<HTMLDivElement>(null);
  const position = useRef(0);
  const [stopped, setStopped] = useState<{ at: number; hit: boolean } | null>(null);
  // 칸 자리: 막대 가운데쯤 어딘가 (처음 표시 자리인 왼쪽 끝에 붙지 않게)
  const [zoneCenter] = useState(() => 0.3 + Math.random() * 0.55);
  const zone = def?.zone ?? 0.2;

  useEffect(() => {
    if (!def || stopped) return;
    const startedAt = performance.now();
    let frame = 0;
    const step = () => {
      // 왼쪽 끝 → 오른쪽 끝 → 왼쪽 끝 ... (삼각파)
      const travel = ((performance.now() - startedAt) / 1000) * def.speed;
      const k = travel % 2;
      position.current = k < 1 ? k : 2 - k;
      if (marker.current) marker.current.style.left = `${position.current * 100}%`;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [def, stopped]);

  // 화면 누르기와 버튼 누르기가 한 번에 같이 와도 한 번만 멈춘다
  const done = useRef(false);
  const stop = () => {
    if (done.current || !def) return;
    done.current = true;
    const at = position.current;
    const hit = Math.abs(at - zoneCenter) <= zone / 2;
    setStopped({ at, hit });
    window.setTimeout(() => reel(hit), STOP_SHOW_MS);
  };

  // 화면 어디를 눌러도 멈춘다 (작은 손가락으로 버튼을 정확히 누르기 어렵다)
  return (
    <div className="absolute inset-0" onPointerDown={stop}>
      <BottomPanel wide>
        <p className="font-game text-ink text-[1.6rem]">
          {def ? BITE_MESSAGE[def.size] : ''}
        </p>
        <p className="font-game text-ink-soft -mt-1 text-[1.1rem]">움직이는 표시가 초록 칸에 왔을 때 멈추세요</p>
        <div className="relative my-1 h-[46px] w-full rounded-full border-4 border-[var(--color-ink)] bg-[#e9dcc0]">
          <div
            className={['absolute top-0 bottom-0 rounded-full', stopped && !stopped.hit ? 'bg-[#a8cf8f]' : 'bg-[#6fbf6a]'].join(' ')}
            style={{ left: `${(zoneCenter - zone / 2) * 100}%`, width: `${zone * 100}%` }}
          />
          <div
            ref={marker}
            className={[
              'absolute -top-[14px] h-[66px] w-[14px] -translate-x-1/2 rounded-full border-4 border-[var(--color-ink)]',
              stopped ? (stopped.hit ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-berry)]') : 'bg-white',
            ].join(' ')}
            style={{ left: stopped ? `${stopped.at * 100}%` : '0%' }}
          />
        </div>
        {/* 누르기는 위의 화면 전체 onPointerDown 이 받는다 (버튼은 어디를 누르면 되는지 보여 주는 표시) */}
        <GameButton tone="gold" big glow={!stopped} className="min-w-[220px]">
          {stopped ? (stopped.hit ? '잡았다!' : '앗!') : '멈추기!'}
        </GameButton>
      </BottomPanel>
    </div>
  );
}

/** 잡은 물고기 · 건진 보물 카드 */
function CaughtCard(): React.ReactElement | null {
  const fish = useFishing((s) => s.fish);
  const firstTime = useFishing((s) => s.firstTime);
  const finish = useFishing((s) => s.finish);
  if (!fish) return null;
  const def = FISH[fish];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[rgba(48,38,30,0.45)]" />
      <div className="panel-wood animate-pop-in relative flex w-[520px] flex-col items-center gap-3 px-10 py-8">
        {firstTime && (
          <span className="font-game rounded-full border-4 border-[var(--color-ink)] bg-[var(--color-gold)] px-5 py-1 text-[1.25rem]">
            도감에 새로 올랐어요!
          </span>
        )}
        <Icon src={cropIcon(fish)} size={170} alt={def.name} />
        <p className="font-game text-ink text-[2.1rem]">{caughtMessage(fish)}</p>
        <p className="font-game text-ink-soft text-[1.2rem]">
          가방에 넣었어요 · 팔면 {def.price}
          {CURRENCY}
        </p>
        <GameButton tone="leaf" big onClick={finish} className="mt-1 min-w-[200px]">
          좋아요
        </GameButton>
      </div>
    </div>
  );
}

function BottomPanel({ children, wide }: { children: React.ReactNode; wide?: boolean }): React.ReactElement {
  return (
    <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
      <div
        className={[
          'panel-paper animate-pop-in flex flex-col items-center gap-3 px-8 py-5',
          wide ? 'w-[min(720px,100%)]' : '',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
