/**
 * 화질 단계. 태블릿이 버거워하면(프레임이 떨어지면) 스스로 낮춘다. (WorldRoot 의 PerformanceMonitor)
 *
 *  2 높음: 화면 배율 최대 1.5, 그림자
 *  1 보통: 화면 배율 1, 그림자
 *  0 낮음: 화면 배율 1, 그림자 없음
 *
 * 그림자는 해(light) 쪽에서만 끈다. 장면 전체 그림자 설정을 바꾸면 모든 재질을 다시 만들어야 해서 한동안 멈춘다.
 * three.js 를 불러오지 않는 작은 스토어다.
 */
import { create } from 'zustand';

export type QualityLevel = 0 | 1 | 2;

export const useQuality = create<{ level: QualityLevel }>(() => ({ level: 2 }));

export function lowerQuality(): void {
  useQuality.setState((s) => ({ level: Math.max(0, s.level - 1) as QualityLevel }));
}

export function raiseQuality(): void {
  useQuality.setState((s) => ({ level: Math.min(2, s.level + 1) as QualityLevel }));
}

/** 화면 배율: 레티나 태블릿의 2~3배를 그대로 쓰면 픽셀 수가 4~9배가 되어 프레임이 떨어진다 */
export function dprFor(level: QualityLevel): number | [number, number] {
  return level === 2 ? [1, 1.5] : 1;
}
