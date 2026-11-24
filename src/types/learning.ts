/**
 * 문제 풀이 학습 관련 타입. (명세 35)
 * 곱셈구구가 기본이고, 나눗셈 · 받아내림 뺄셈 묶음(config/curriculum 의 PROBLEM_SETS)도 같은 틀로 낸다.
 */
import type { ProblemSet } from '@/config/curriculum';

/** 문제 풀이가 요청된 게임 맥락 */
export type MathContext =
  | 'PLANT'
  | 'GROW'
  | 'HARVEST'
  | 'ANIMAL'
  | 'SHOP'
  | 'SELL'
  | 'MINIGAME'
  | 'CHEST'
  | 'FISH';

export type QuestionKind = 'basic' | 'blankRight' | 'blankLeft';

/** 연산 종류. 기록의 문제 키와 교사 화면의 식 표시에 쓴다 */
export type MathOp = 'mul' | 'div' | 'sub';

export interface MathQuestion {
  id: string;
  /** 기록에 쓰는 문제 키. "6x7", "42/6", "43-7" */
  key: string;
  /** 'mul' 이면 곱셈구구, 아니면 문제 묶음 */
  set: 'mul' | ProblemSet;
  op: MathOp;
  /** 곱셈: 단 · 곱하는 수, 나눗셈: 나뉠 수 · 나누는 수, 뺄셈: 빼어질 수 · 빼는 수 */
  left: number;
  right: number;
  /** 정답 글자 (선택지와 같은 모양). 예: "42", "7 … 3" */
  correctAnswer: string;
  /** 곱셈의 곱 (곱셈이 아니면 0) */
  product: number;
  kind: QuestionKind;
  /** 화면에 보여줄 식. 예: "6 × 7 = ?" 또는 "3 × ? = 12" */
  prompt: string;
  /** 맞혔거나 답을 알려 줄 때 보여 줄 완성된 식. 예: "45 ÷ 6 = 7 … 3" */
  solved: string;
  choices: string[];
  /** 곱셈의 단 (곱셈이 아니면 0) */
  table: number;
}

/** 문제별 누적 기록 */
export interface ProblemRecord {
  /** "6x7", "42/6", "43-7" */
  key: string;
  left: number;
  right: number;
  /** 없으면 곱셈 (묶음이 생기기 전 기록) */
  op?: MathOp;
  attempts: number;
  correct: number;
  /** 연속 정답 수. 오답 우선순위를 낮추는 데 사용. (명세 18) */
  streak: number;
  lastAttemptedAt: string | null;
}

export interface LearningStats {
  totalAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  /** 곱셈구구 단 -> {attempts, correct} */
  byTable: Record<number, { attempts: number; correct: number }>;
  /** 문제 묶음 -> {attempts, correct}. 묶음이 생기기 전 기록에는 없다 */
  bySet?: Partial<Record<ProblemSet, { attempts: number; correct: number }>>;
  /** 문제 키 -> ProblemRecord */
  byProblem: Record<string, ProblemRecord>;
  /** 최근 오답 큐. 5~10문제 이내에 다시 등장시킨다. (명세 18) */
  wrongQueue: string[];
}

export function createEmptyLearningStats(): LearningStats {
  return {
    totalAttempts: 0,
    totalCorrect: 0,
    totalWrong: 0,
    byTable: {},
    bySet: {},
    byProblem: {},
    wrongQueue: [],
  };
}

export function problemKey(left: number, right: number): string {
  return `${left}x${right}`;
}

const OP_SIGN: Record<MathOp, string> = { mul: '×', div: '÷', sub: '−' };

/** 교사 화면 등에 보이는 식. "6 × 7", "42 ÷ 6", "43 − 7" */
export function formatProblem(record: Pick<ProblemRecord, 'left' | 'right' | 'op'>): string {
  return `${record.left} ${OP_SIGN[record.op ?? 'mul']} ${record.right}`;
}
