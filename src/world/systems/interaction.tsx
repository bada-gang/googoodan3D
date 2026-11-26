/**
 * 상호작용: 가까이 간 물건의 행동 버튼을 띄우고, 버튼이 눌리면 그 물건에게 알린다. (명세 7)
 *
 * 물건은 useInteractable 로 자기를 등록한다. InteractionSystem 이 매 프레임
 * 캐릭터와 가장 가까운(범위 안의) 물건을 고르고, 바뀌었을 때만 React UI 로 버튼 목록을 보낸다.
 */
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { gameEvents } from '@/bridge/eventBus';
import type { InteractionPrompt } from '@/bridge/events';
import type { Vec2 } from '@/config/layout';
import { useUiStore } from '@/state/uiStore';
import { audio } from '@/audio/sfx';
import { input, player } from '../state/runtime';

export interface Interactable {
  id: string;
  /** 바닥 위치. 움직이는 물건(동물)이면 매번 새로 계산한다 */
  position: () => Vec2;
  /** 상호작용 거리 (m). 기본 1.8 */
  range?: number;
  /**
   * 원(position · range) 대신 이 네모 안에 들어오면 상호작용한다 (길 끝의 장면 이동처럼).
   * 안에 들어오면 다른 물건보다 먼저 고른다.
   */
  area?: Rect;
  prompts: () => InteractionPrompt[];
  onAction: (actionId: string) => void;
  /** 버튼 "딸깍" 소리를 내지 않는다. 장면 이동처럼 행동이 자기 소리(문 소리)를 내면 겹치지 않게 */
  silentTap?: boolean;
}

export const DEFAULT_RANGE = 1.8;

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** 캐릭터가 네모 안에 있는지 */
function playerInside(area: Rect): boolean {
  const { x, z } = player.position;
  return x >= area.minX && x <= area.maxX && z >= area.minZ && z <= area.maxZ;
}

const registry = new Map<string, { current: Interactable }>();

/**
 * 이 컴포넌트가 화면에 있는 동안 물건을 상호작용 대상으로 등록한다.
 * item 은 매 렌더 새 객체여도 된다 — 최신 것을 ref 로 들고 있다.
 */
export function useInteractable(item: Interactable): void {
  const ref = useRef(item);
  ref.current = item;
  useEffect(() => {
    registry.set(item.id, ref);
    return () => {
      registry.delete(item.id);
    };
  }, [item.id]);
}

/** 캐릭터에서 물건까지의 바닥 거리 */
export function distanceToPlayer(position: Vec2): number {
  return Math.hypot(position.x - player.position.x, position.z - player.position.z);
}

/** 버튼 목록을 다시 계산하는 간격. 매 프레임 할 필요는 없다 */
const REFRESH_MS = 120;

export function InteractionSystem(): null {
  const active = useRef<Interactable | null>(null);
  const lastSignature = useRef('');
  const lastRefresh = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastRefresh.current < REFRESH_MS) return;
    lastRefresh.current = now;

    let nearest: Interactable | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const { current: item } of registry.values()) {
      if (item.area) {
        // 네모 범위: 안에 있으면 가장 먼저 (거리 −1)
        if (playerInside(item.area) && nearestDistance > -1) {
          nearest = item;
          nearestDistance = -1;
        }
        continue;
      }
      const distance = distanceToPlayer(item.position());
      if (distance <= (item.range ?? DEFAULT_RANGE) && distance < nearestDistance) {
        nearest = item;
        nearestDistance = distance;
      }
    }
    active.current = nearest;

    // 꾸미기 중에는 행동 버튼을 숨긴다 (명세 78: 꾸미기는 문제를 내지 않는다)
    const decorating = useUiStore.getState().overlay === 'decorate';
    const prompts = decorating ? [] : (nearest?.prompts() ?? []);
    const signature = JSON.stringify(prompts);
    if (signature !== lastSignature.current) {
      lastSignature.current = signature;
      gameEvents.emit('interaction:changed', { prompts });
    }
  });

  useEffect(() => {
    const press = (actionId: string) => {
      const item = active.current;
      if (!item) return;
      const prompt = item.prompts().find((p) => p.id === actionId);
      if (!prompt || !prompt.enabled) return;
      if (!item.silentTap) audio.play('tap');
      // 행동하러 왔으니 걸어가던 것은 멈춘다
      input.tapTarget = null;
      item.onAction(actionId);
    };

    const offAction = gameEvents.on('action:press', ({ actionId }) => press(actionId));

    // 키보드: E 또는 엔터로 첫 번째 버튼 (개발 · 키보드 사용자용)
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' && event.code !== 'Enter') return;
      if (useUiStore.getState().overlay !== null) return;
      const first = active.current?.prompts().find((p) => p.enabled);
      if (first) press(first.id);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      offAction();
      window.removeEventListener('keydown', onKey);
      gameEvents.emit('interaction:changed', { prompts: [] });
    };
  }, []);

  return null;
}
