/**
 * 지금 보이는 장면과 화면 덮개 상태. three.js 를 불러오지 않는 가벼운 파일이다
 * (GameCanvas 는 첫 화면 번들에 있어서, 여기서 three.js 를 끌어오면 안 된다).
 * 장면을 바꾸는 함수는 scenes.ts.
 */
import { create } from 'zustand';
import type { SceneKey } from '@/bridge/events';

/** 3D 로 만든 장면. 미니게임은 아직 정하지 않았다 */
export type WorldSceneKey = Extract<SceneKey, 'YardScene' | 'HomeScene' | 'TownScene'>;

export interface Spawn {
  x: number;
  z: number;
  /** 바라보는 방향 (라디안). 0 = 카메라 쪽 */
  facing?: number;
}

interface SceneState {
  scene: WorldSceneKey;
  /** 이 장면에서 처음 설 자리. 없으면 장면의 기본 자리 */
  spawn: Spawn | null;
  /** 장면을 바꾸는 중 (화면이 덮여 있다) */
  fading: boolean;
}

export const useWorldScene = create<SceneState>(() => ({ scene: 'YardScene', spawn: null, fading: false }));

/** 문을 지날 때 화면이 덮였다 걷히는 시간 */
export const SCENE_FADE_MS = 220;
