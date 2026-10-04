/** 동물 우리 배치(울타리 · 문 · 여물통 · 헛간 자리)와 동물마다 크기. */
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
/** 동물이 울타리에 붙지 않게 안쪽으로 띄우는 거리 */
export const INNER_MARGIN = 0.8;
/** 여물통 자리 (우리 안 왼쪽 벽 앞, 세로로) */
export const TROUGH = { x: PEN_MIN_X + 0.9, z: pen.center.z, length: 1.6 };
/** 헛간은 우리 뒤 울타리 바깥 */
export const BARN = { x: pen.center.x + 1.5, z: PEN_MIN_Z - 2.3 };

/** 동물마다 크기 (부딪히는 반지름, 느낌표 높이, 걷는 빠르기) */
export const ANIMAL_BODY: Record<AnimalSpeciesId, { radius: number; marker: number; speed: number; color: string }> = {
  chicken: { radius: 0.3, marker: 1.1, speed: 0.9, color: PALETTE.chicken },
  goat: { radius: 0.45, marker: 1.6, speed: 0.7, color: PALETTE.woodLight },
  sheep: { radius: 0.5, marker: 1.55, speed: 0.6, color: PALETTE.sheep },
  cow: { radius: 0.65, marker: 2.0, speed: 0.55, color: PALETTE.cow },
};
