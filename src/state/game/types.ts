/**
 * 게임 스토어 전체 모양. 스토어는 주제별 조각(slice)을 합친 것이다:
 * 세션 · 진행(돈·경험치·보상) · 가방과 가게 · 밭 · 동물 · 꾸미기 · 낚시 · 학습.
 */
import type { StateCreator } from 'zustand';
import type { AnimalSlice } from './animalSlice';
import type { DecorateSlice } from './decorateSlice';
import type { FarmSlice } from './farmSlice';
import type { FishingSlice } from './fishingSlice';
import type { InventorySlice } from './inventorySlice';
import type { LearningSlice } from './learningSlice';
import type { ProgressSlice } from './progressSlice';
import type { SessionSlice } from './sessionSlice';

export type GameStoreState = SessionSlice &
  ProgressSlice &
  InventorySlice &
  FarmSlice &
  AnimalSlice &
  DecorateSlice &
  FishingSlice &
  LearningSlice;

/** 조각 하나를 만드는 함수. set · get 은 스토어 전체를 본다 (다른 조각의 액션도 부를 수 있다) */
export type GameSlice<T> = StateCreator<GameStoreState, [], [], T>;
