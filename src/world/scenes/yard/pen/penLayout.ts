/** 동물 우리 배치(울타리 · 문 · 여물통 · 물통 · 헛간 자리)와 동물마다 크기. */
import { PALETTE } from '@/config/artTokens';
import { YARD } from '@/config/layout';
import type { AnimalSpeciesId } from '@/types/game';

export const pen = YARD.pen;
export const PEN_MIN_X = pen.center.x - pen.width / 2;
export const PEN_MAX_X = pen.center.x + pen.width / 2;
export const PEN_MIN_Z = pen.center.z - pen.depth / 2;
export const PEN_MAX_Z = pen.center.z + pen.depth / 2;
/** 앞쪽(카메라 쪽) 울타리 가운데의 문 너비 */
export const GATE_WIDTH = 1.8;
/** 울타리 두께 (부딪힘) */
export const FENCE_THICKNESS = 0.2;
/** 여물통(건초) 자리 (우리 안 왼쪽 벽 앞, 세로로) */
export const TROUGH = { x: PEN_MIN_X + 0.9, z: pen.center.z, length: 1.6 };
/** 물통 자리 (우리 안 오른쪽 벽 앞, 세로로). 여물통과 마주 본다 */
export const WATER_TROUGH = { x: PEN_MAX_X - 0.9, z: pen.center.z, length: 1.6 };
/** 헛간 모델의 반 너비 · 반 깊이 (3.7m 정사각형, 모델을 재서 맞춤) */
const BARN_HALF = 1.85;
/** 헛간은 우리 가운데(앞문과 같은 x), 앞면이 뒤 울타리에 닿게 */
export const BARN = { x: pen.center.x, z: PEN_MIN_Z - BARN_HALF - 0.05 };
/** 헛간 문 앞만 뒤 울타리를 튼다 (트인 자리는 헛간이 막는다) */
export const BARN_OPENING = 2.6;

/** 동물마다 크기 (부딪히는 반지름, 느낌표 높이, 걷는 빠르기) */
export const ANIMAL_BODY: Record<AnimalSpeciesId, { radius: number; marker: number; speed: number; color: string }> = {
  chicken: { radius: 0.3, marker: 1.1, speed: 0.9, color: PALETTE.chicken },
  goat: { radius: 0.45, marker: 1.6, speed: 0.7, color: PALETTE.woodLight },
  sheep: { radius: 0.5, marker: 1.55, speed: 0.6, color: PALETTE.sheep },
  cow: { radius: 0.65, marker: 2.0, speed: 0.55, color: PALETTE.cow },
  // 꿀벌: 걷지 않는 양봉 통 (반지름 · 느낌표 높이는 통 기준, yard/apiary)
  bee: { radius: 0.55, marker: 1.55, speed: 0, color: '#f2c14e' },
};
