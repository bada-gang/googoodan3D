/**
 * 하단 터치 조작. (명세 7, 37)
 * - 왼쪽 아래: 이동 조이스틱 (땅을 톡 쳐서 걸어가기도 된다)
 * - 가운데: 가방 · 꾸미기 (자리 고정 — 행동 버튼이 생기고 사라져도 움직이지 않는다)
 * - 오른쪽 아래: 상황별 행동 버튼
 *
 * 멀티터치·길게 누르기·더블 탭을 필수로 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import { gameEvents } from '@/bridge/eventBus';
import { useGameStore } from '@/state/gameStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useUiStore } from '@/state/uiStore';
import { basketIcon } from '../common/icons';
import { Icon } from '../common/ui';
import { audio } from '@/audio/sfx';

/** 조이스틱 바탕 지름과 손잡이 지름 (논리 해상도 px) */
const PAD_SIZE = 184;
const KNOB_SIZE = 84;
/** 손잡이가 움직일 수 있는 거리 */
const KNOB_TRAVEL = (PAD_SIZE - KNOB_SIZE) / 2 + 6;
/**
 * 가방 · 꾸미기 묶음의 가운데 자리 (화면 너비 대비). 화면 가운데보다 조금 왼쪽.
 * 왼손 모드는 행동 버튼이 왼쪽에 오므로 좌우를 뒤집는다.
 */
const MENU_CENTER = 0.45;
/** 이보다 조금 밀면 무시한다 (손가락을 얹기만 해도 움직이지 않게) */
const DEAD_ZONE = 0.18;

/**
 * 이동 조이스틱. 손가락을 바탕 어디에 대도 그쪽으로 걷기 시작한다.
 * 손가락이 바탕 밖으로 나가도 계속 따라간다(포인터 캡처).
 */
function Joystick(): React.ReactElement {
  const padRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    // 화면 배율(LogicalLayer)이 걸려 있어 실제 픽셀을 논리 px 로 되돌린다
    const scale = rect.width / PAD_SIZE;
    let dx = (event.clientX - (rect.left + rect.width / 2)) / scale;
    let dy = (event.clientY - (rect.top + rect.height / 2)) / scale;
    const distance = Math.hypot(dx, dy);
    if (distance > KNOB_TRAVEL) {
      dx = (dx / distance) * KNOB_TRAVEL;
      dy = (dy / distance) * KNOB_TRAVEL;
    }
    setKnob({ x: dx, y: dy });
    const strength = Math.min(1, distance / KNOB_TRAVEL);
    if (strength < DEAD_ZONE) {
      gameEvents.emit('move:vector', { x: 0, y: 0 });
      return;
    }
    // 화면 아래가 +y 라서 위로 밀면 앞으로 가도록 뒤집는다
    gameEvents.emit('move:vector', { x: dx / KNOB_TRAVEL, y: -dy / KNOB_TRAVEL });
  };

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    gameEvents.emit('move:vector', { x: 0, y: 0 });
  };

  return (
    <div
      ref={padRef}
      role="application"
      aria-label="이동 조이스틱"
      onPointerDown={(event) => {
        if (pointerId.current !== null) return;
        pointerId.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* 일부 환경에서는 캡처가 안 될 수 있다. 이동 자체에는 영향이 없다. */
        }
        audio.unlock();
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === pointerId.current) update(event);
      }}
      onPointerUp={(event) => {
        if (event.pointerId === pointerId.current) release();
      }}
      onPointerCancel={(event) => {
        if (event.pointerId === pointerId.current) release();
      }}
      onContextMenu={(event) => event.preventDefault()}
      className="pointer-events-auto relative touch-none rounded-full border-4 border-ink bg-cream/70 shadow-[0_5px_0_rgba(74,58,47,0.35)]"
      style={{ width: PAD_SIZE, height: PAD_SIZE }}
    >
      {/* 방향 눈금 */}
      {[0, 90, 180, 270].map((angle) => (
        <span
          key={angle}
          aria-hidden
          className="absolute top-1/2 left-1/2 h-0 w-0 border-x-[10px] border-b-[13px] border-x-transparent border-b-ink/35"
          style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${PAD_SIZE / 2 - 18}px)` }}
        />
      ))}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 rounded-full border-4 border-ink bg-[#fff6e2] shadow-[inset_0_-6px_0_rgba(74,58,47,0.15)]"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </div>
  );
}

function BagGlyph(): React.ReactElement {
  return <Icon src={basketIcon()} size={44} alt="" />;
}

function BrushGlyph(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
      <path
        d="M17.4 2.9a2.2 2.2 0 0 1 3.1 3.1l-8.2 8.2-3.9.8.8-3.9 8.2-8.2ZM6.6 15.2c1.6 0 2.9 1.3 2.9 2.9 0 1.9-1.6 3.3-4 3.3-1.4 0-2.6-.3-3.4-.7 1.1-.5 1.6-1.3 1.6-2.6 0-1.6 1.3-2.9 2.9-2.9Z"
        fill="#4a3a2f"
      />
    </svg>
  );
}

export function TouchControls(): React.ReactElement {
  const prompts = useUiStore((s) => s.prompts);
  const scene = useUiStore((s) => s.currentScene);
  const overlay = useUiStore((s) => s.overlay);
  const openOverlay = useUiStore((s) => s.openOverlay);
  const leftHanded = useSettingsStore((s) => s.leftHanded);
  const chests = useGameStore((s) => s.chests);

  const inMinigame = scene === 'FruitCatchScene';
  const canDecorate = scene === 'HomeScene' || scene === 'YardScene';

  // 미니게임은 3D 마당이 아니라 자체 조작을 쓴다 (6단계)
  const moveCluster = inMinigame ? <div /> : <Joystick />;

  const actionCluster = (
    <div className="pointer-events-auto flex max-w-[46%] flex-wrap items-end justify-end gap-3">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          disabled={!prompt.enabled}
          onClick={() => {
            audio.unlock();
            gameEvents.emit('action:press', { actionId: prompt.id });
          }}
          className={[
            'btn-game min-h-[76px] flex-col gap-0 px-7 text-[1.6rem]',
            prompt.highlight ? 'btn-gold animate-glow' : 'btn-leaf',
          ].join(' ')}
        >
          <span>{prompt.label}</span>
          {prompt.hint && (
            <span className="font-body text-[1rem] font-medium opacity-85">{prompt.hint}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-3">
      {leftHanded ? actionCluster : moveCluster}

      {!inMinigame && !overlay && (
        <div
          className="pointer-events-auto absolute bottom-3 flex -translate-x-1/2 items-end gap-3"
          style={{ left: `${(leftHanded ? 1 - MENU_CENTER : MENU_CENTER) * 100}%` }}
        >
          <button
            type="button"
            aria-label="가방"
            onClick={() => {
              audio.play('tap');
              openOverlay('inventory');
            }}
            className="btn-game relative h-[80px] w-[96px] flex-col gap-0 px-0 text-[1rem]"
          >
            <BagGlyph />
            <span>가방</span>
            {chests > 0 && (
              <span className="font-game absolute -top-2 -right-2 flex h-8 min-w-8 items-center justify-center rounded-full border-[3px] border-ink bg-gold px-1 text-[0.95rem]">
                {chests}
              </span>
            )}
          </button>

          {canDecorate && (
            <button
              type="button"
              aria-label="꾸미기"
              onClick={() => {
                audio.play('tap');
                openOverlay('decorate');
              }}
              className="btn-game h-[80px] w-[96px] flex-col gap-0 px-0 text-[1rem]"
            >
              <BrushGlyph />
              <span>꾸미기</span>
            </button>
          )}
        </div>
      )}

      {leftHanded ? moveCluster : actionCluster}
    </div>
  );
}
