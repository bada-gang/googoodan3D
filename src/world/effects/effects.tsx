/**
 * 짧은 연출: 떠오르는 글자, 별 터뜨리기, 느낌표 표시. 별 · 물방울 같은 입자는 particles.tsx.
 *
 * 연출은 어디서든(행동 처리 코드에서) 함수 하나로 부를 수 있게 작은 스토어에 쌓고,
 * EffectsLayer 가 그린다. 정답/보상 연출은 1초 안에 끝낸다. (ART_DIRECTION 8)
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace, type Sprite, type SpriteMaterial } from 'three';
import { create } from 'zustand';
import { PALETTE } from '@/config/artTokens';
import { distanceToPlayer } from '../systems/interaction';
import { ParticleField, spawnParticles } from './particles';

interface Point {
  x: number;
  y: number;
  z: number;
}

type Effect = { id: number; kind: 'text'; at: Point; text: string; color: string };

const EFFECT_MS = { text: 1100 } as const;

const useEffects = create<{ list: Effect[] }>(() => ({ list: [] }));
let nextId = 1;

function spawn(effect: Effect): void {
  useEffects.setState((s) => ({ list: [...s.list, effect] }));
  window.setTimeout(() => {
    useEffects.setState((s) => ({ list: s.list.filter((e) => e.id !== effect.id) }));
  }, EFFECT_MS[effect.kind]);
}

/** 머리 위로 떠오르는 글자 ("사과 +3", "쑥쑥!") */
export function floatText(at: Point, text: string, color: string = PALETTE.outline): void {
  spawn({ id: nextId++, kind: 'text', at, text, color });
}

/** 별이 사방으로 튀는 보상 연출 */
export function burstStars(at: Point, count = 10): void {
  spawnParticles('stars', at, count);
}

/** 입자(별 · 물방울 등)와 떠오르는 글자 */
export function EffectsLayer(): React.ReactElement {
  const list = useEffects((s) => s.list);
  return (
    <>
      <ParticleField />
      {list.map((effect) => (
        <FloatingText key={effect.id} at={effect.at} text={effect.text} color={effect.color} />
      ))}
    </>
  );
}

function FloatingText({ at, text, color }: { at: Point; text: string; color: string }): React.ReactElement {
  return (
    <Html position={[at.x, at.y, at.z]} center zIndexRange={[30, 0]} pointerEvents="none">
      <div
        className="font-game animate-float-up text-[2.1rem] whitespace-nowrap select-none"
        style={{
          color,
          WebkitTextStroke: `5px ${PALETTE.cream}`,
          paintOrder: 'stroke fill',
          filter: 'drop-shadow(0 3px 0 rgba(74,58,47,0.35))',
        }}
      >
        {text}
      </div>
    </Html>
  );
}

/**
 * 할 일이 있는 곳 위에 뜨는 느낌표. 가까우면 진하게, 멀면 옅게.
 * height 는 바닥에서 느낌표까지 높이(m), nearDistance 안이면 진하게.
 * 움직이는 대상(동물)은 follow 로 매 프레임 위치를 준다.
 *
 * 3D 장면 안의 그림(sprite)으로 그린다. 예전에는 웹 요소(drei Html)로 띄웠는데,
 * 게임을 처음 열 때 여러 개가 한꺼번에 생기면 몇 개가 사라지는 일이 있었다 (재접속하면 느낌표가 빠졌다).
 */
export function Marker({
  x = 0,
  z = 0,
  follow,
  height,
  nearDistance = 4.5,
  kind = 'ready',
}: {
  x?: number;
  z?: number;
  follow?: () => { x: number; z: number };
  height: number;
  nearDistance?: number;
  /** ready: 금색 느낌표 (받을 것이 있다) · sleep: zzz (가축이 쉬는 중) */
  kind?: 'ready' | 'sleep';
}): React.ReactElement {
  const sprite = useRef<Sprite>(null);
  const material = useRef<SpriteMaterial>(null);
  // 느낌표마다 위아래 박자를 조금씩 다르게
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(() => {
    const at = follow ? follow() : { x, z };
    // 2.4초에 한 번 8px 쯤 들썩 (CSS animate-bob 과 같은 느낌)
    const bob = (Math.sin((performance.now() / 2400) * Math.PI * 2 + phase) + 1) * 0.04;
    sprite.current?.position.set(at.x, height + bob, at.z);
    if (material.current) material.current.opacity = distanceToPlayer(at) <= nearDistance ? 1 : 0.6;
  });
  return (
    // 건물 · 나무 뒤에 있어도 가려지지 않게 맨 나중에, 깊이 검사 없이 그린다
    <sprite ref={sprite} position={[x, height, z]} scale={MARKER_SIZE} renderOrder={10}>
      <spriteMaterial ref={material} map={kind === 'sleep' ? sleepTexture() : markerTexture()} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** 느낌표 크기 (m). 동물 머리 위에 작게 (사용자가 정한 크기) */
const MARKER_SIZE = 0.3;

let markerTextureCache: CanvasTexture | null = null;

/** 금색 동그라미 + 진한 테두리 + 느낌표. 글꼴이 늦게 와도 모양이 같도록 글자 대신 도형으로 그린다 */
function markerTexture(): CanvasTexture {
  if (markerTextureCache) return markerTextureCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.beginPath();
  g.arc(c, c, c - 7, 0, Math.PI * 2);
  g.fillStyle = PALETTE.gold;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = PALETTE.outline;
  g.stroke();
  g.fillStyle = PALETTE.outline;
  // 느낌표 막대 (위가 조금 넓은 둥근 막대)
  g.beginPath();
  g.moveTo(c - 10, 30);
  g.lineTo(c + 10, 30);
  g.lineTo(c + 6, 78);
  g.lineTo(c - 6, 78);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.fill();
  g.stroke();
  // 점
  g.beginPath();
  g.arc(c, 94, 8.5, 0, Math.PI * 2);
  g.fill();
  markerTextureCache = new CanvasTexture(canvas);
  markerTextureCache.colorSpace = SRGBColorSpace;
  return markerTextureCache;
}

let sleepTextureCache: CanvasTexture | null = null;

/**
 * 쉬는 가축 머리 위 "zzz": 느낌표와 같은 크기의 연보라 동그라미 + 진한 테두리 + 크기가 다른 Z 셋.
 * 느낌표처럼 글자 대신 선으로 그린다 (글꼴이 늦게 와도 모양이 같다).
 */
function sleepTexture(): CanvasTexture {
  if (sleepTextureCache) return sleepTextureCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  g.beginPath();
  g.arc(c, c, c - 7, 0, Math.PI * 2);
  g.fillStyle = '#d9d2f5';
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = PALETTE.outline;
  g.stroke();
  // Z 하나: 윗변 → 대각선 → 아랫변
  const drawZ = (x: number, y: number, s: number, width: number) => {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + s, y);
    g.lineTo(x, y + s);
    g.lineTo(x + s, y + s);
    g.lineWidth = width;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = PALETTE.outline;
    g.stroke();
  };
  drawZ(24, 66, 30, 9);
  drawZ(62, 46, 21, 7.5);
  drawZ(89, 30, 14, 6);
  sleepTextureCache = new CanvasTexture(canvas);
  sleepTextureCache.colorSpace = SRGBColorSpace;
  return sleepTextureCache;
}
