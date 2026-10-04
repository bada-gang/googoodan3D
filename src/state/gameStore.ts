/**
 * 게임 상태 스토어. 3D 월드와 React 가 같은 상태를 본다. (명세 70)
 *
 * 규칙:
 *  - 여기에는 게임 규칙만 둔다. 저장은 persistence.ts 가 구독해서 처리한다. (명세 9번 원칙)
 *  - 문제 풀이 성공 여부는 UI 가 판단해 액션을 호출한다. 스토어는 문제를 모른다.
 *
 * 내용은 주제별 파일(state/game/)에 나뉘어 있고, 여기서 하나의 스토어로 합친다:
 *  - sessionSlice   세션 시작/끝, 저장본 불러오기
 *  - progressSlice  돈 · 경험치 · 레벨 · 상자 · 열매 받기 게임 점수
 *  - inventorySlice 가방, 가게에서 사고팔기
 *  - farmSlice      밭 (심기 · 키우기 · 따기)
 *  - animalSlice    동물 (들이기 · 먹이 · 생산물)
 *  - decorateSlice  꾸미기 (가구 놓기 · 벽지 · 바닥)
 *  - learningSlice  학습 기록
 *  - saveData       저장 데이터 모양 (처음 상태, 오래된 저장본 메꾸기)
 */
import { create } from 'zustand';
import { createAnimalSlice } from './game/animalSlice';
import { createDecorateSlice } from './game/decorateSlice';
import { createFarmSlice } from './game/farmSlice';
import { createInventorySlice } from './game/inventorySlice';
import { createLearningSlice } from './game/learningSlice';
import { createProgressSlice } from './game/progressSlice';
import { createSessionSlice } from './game/sessionSlice';
import type { GameStoreState } from './game/types';

export { isSavingBlocked } from './game/sessionSlice';
export type { GameStoreState } from './game/types';

export const useGameStore = create<GameStoreState>()((...a) => ({
  ...createSessionSlice(...a),
  ...createProgressSlice(...a),
  ...createInventorySlice(...a),
  ...createFarmSlice(...a),
  ...createAnimalSlice(...a),
  ...createDecorateSlice(...a),
  ...createLearningSlice(...a),
}));
