/**
 * 무엇을 가르치는가. (명세 11)
 *
 * 연습하는 단 목록이 세 곳에 따로 적혀 있던 것을 여기로 모았다 —
 * 학생 선택 화면, 교사 화면, 연습 필요 판단.
 * 1단과 10단은 넣지 않는다. 2학년 교육과정의 곱셈구구는 2~9단이다.
 */
export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9] as const;

export type Table = (typeof TABLES)[number];

/**
 * 곱셈구구 말고 고를 수 있는 문제 묶음. 곱셈구구 단과 함께 여러 개를 고를 수 있다.
 * 문제 범위는 math/problemSets.ts 에 있다.
 */
export const PROBLEM_SETS = ['div1', 'div2', 'div2r', 'sub'] as const;

export type ProblemSet = (typeof PROBLEM_SETS)[number];

/** 학생 화면 · 교사 화면에 보이는 묶음 이름 */
export const PROBLEM_SET_LABEL: Record<ProblemSet, string> = {
  div1: '한 자리 ÷ 한 자리',
  div2: '두 자리 ÷ 한 자리',
  div2r: '나머지가 있는 나눗셈',
  sub: '받아내림 뺄셈',
};

/** 묶음 버튼 아래 작은 예시 */
export const PROBLEM_SET_EXAMPLE: Record<ProblemSet, string> = {
  div1: '8 ÷ 2',
  div2: '42 ÷ 6',
  div2r: '45 ÷ 6 = 7 … 3',
  sub: '43 − 7',
};

export function isProblemSet(value: unknown): value is ProblemSet {
  return typeof value === 'string' && (PROBLEM_SETS as readonly string[]).includes(value);
}
