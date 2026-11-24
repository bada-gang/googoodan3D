/**
 * 문제 출제기. (명세 13, 14, 17, 18)
 *
 * - 고른 것(곱셈구구 단 묶음 하나 + 문제 묶음들) 중 한 묶음을 같은 확률로 고른 뒤, 그 안에서 낸다.
 *   예) 2단 · 3단 + 받아내림 뺄셈 → 곱셈구구 50%, 뺄셈 50%
 * - 곱셈구구는 선택한 단 × 1~9 범위에서만 출제한다. 문제 묶음의 범위는 problemSets.ts.
 * - 70% 균형 출제 / 30% 취약 문제 우선.
 * - 최근에 나온 문제는 연속으로 다시 내지 않는다.
 */
import {
  MASTERY_STREAK,
  QUESTION_KIND_WEIGHT,
  RECENT_MEMORY,
  WEAK_PROBLEM_RATIO,
} from '@/config/balance';
import type { ProblemSet } from '@/config/curriculum';
import { problemKey } from '@/types/learning';
import type { LearningStats, MathQuestion, QuestionKind } from '@/types/learning';
import {
  buildChoices,
  factorDistractorPool,
  productDistractorPool,
  shuffle,
} from './distractors';
import { buildSetQuestion, drawPool, iga, setHint } from './problemSets';

export const RIGHT_FACTORS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Candidate {
  left: number;
  right: number;
  key: string;
}

function buildPool(tables: number[]): Candidate[] {
  const pool: Candidate[] = [];
  for (const table of tables) {
    for (const right of RIGHT_FACTORS) {
      pool.push({ left: table, right, key: problemKey(table, right) });
    }
  }
  return pool;
}

/** 정답률이 낮거나 최근에 틀린 문제 */
function weakCandidates<T extends { key: string }>(pool: T[], stats: LearningStats): T[] {
  const wrongSet = new Set(stats.wrongQueue);
  return pool.filter((c) => {
    const record = stats.byProblem[c.key];
    if (!record) return false;
    // 연속으로 여러 번 맞혔으면 취약 목록에서 뺀다. (명세 18)
    if (record.streak >= MASTERY_STREAK) return false;
    if (wrongSet.has(c.key)) return true;
    if (record.attempts >= 2 && record.correct / record.attempts < 0.7) return true;
    return false;
  });
}

/** 아직 적게 풀어본 문제를 우선하는 균형 출제 */
function balancedPick<T extends { key: string }>(pool: T[], stats: LearningStats): T {
  const withCount = pool.map((c) => ({
    candidate: c,
    attempts: stats.byProblem[c.key]?.attempts ?? 0,
  }));
  const min = Math.min(...withCount.map((w) => w.attempts));
  const leastPracticed = withCount.filter((w) => w.attempts <= min).map((w) => w.candidate);
  return leastPracticed[Math.floor(Math.random() * leastPracticed.length)];
}

function pickKind(): QuestionKind {
  const roll = Math.random();
  if (roll < QUESTION_KIND_WEIGHT.basic) return 'basic';
  if (roll < QUESTION_KIND_WEIGHT.basic + QUESTION_KIND_WEIGHT.blankRight) return 'blankRight';
  return 'blankLeft';
}

let questionSeq = 0;

export interface GenerateOptions {
  tables: number[];
  /** 곱셈구구 말고 고른 문제 묶음 */
  sets?: ProblemSet[];
  stats: LearningStats;
  /** 최근에 출제된 문제 키 목록 (앞이 가장 최근) */
  recent: string[];
  /** 특정 유형으로 고정하고 싶을 때 */
  forceKind?: QuestionKind;
}

/** 묶음 안에서 문제 하나 고르기: 최근 문제 피하기 → 30% 취약 문제 / 70% 덜 푼 문제 */
function pickFrom<T extends { key: string }>(pool: T[], stats: LearningStats, recent: string[]): T {
  const recentSet = new Set(recent.slice(0, RECENT_MEMORY));
  const fresh = pool.filter((c) => !recentSet.has(c.key));
  const usablePool = fresh.length > 0 ? fresh : pool;
  const weak = weakCandidates(usablePool, stats);
  const useWeak = weak.length > 0 && Math.random() < WEAK_PROBLEM_RATIO;
  return useWeak ? shuffle(weak)[0] : balancedPick(usablePool, stats);
}

export function generateQuestion({
  tables,
  sets = [],
  stats,
  recent,
  forceKind,
}: GenerateOptions): MathQuestion {
  // 곱셈구구(고른 단 전체)가 한 묶음, 문제 묶음이 하나씩. 아무것도 안 골랐으면 2단
  const groups: ('mul' | ProblemSet)[] = [...(tables.length > 0 ? (['mul'] as const) : []), ...sets];
  if (groups.length === 0) groups.push('mul');
  const group = groups[Math.floor(Math.random() * groups.length)];
  if (group !== 'mul') {
    const picked = pickFrom(drawPool(group), stats, recent);
    return buildSetQuestion(group, picked.left, picked.right);
  }

  const activeTables = tables.length > 0 ? tables : [2];
  const pool = buildPool(activeTables);

  const picked = pickFrom(pool, stats, recent);

  const kind = forceKind ?? pickKind();
  return buildQuestion(picked.left, picked.right, kind);
}

export function buildQuestion(left: number, right: number, kind: QuestionKind): MathQuestion {
  const product = left * right;
  questionSeq += 1;
  const key = problemKey(left, right);
  const base = {
    id: `q${questionSeq}_${key}`,
    key,
    set: 'mul' as const,
    op: 'mul' as const,
    left,
    right,
    product,
    kind,
    table: left,
    solved: `${left} × ${right} = ${product}`,
  };
  const factorChoices = (answer: number) =>
    buildChoices(String(answer), factorDistractorPool(answer).map(String));

  if (kind === 'blankRight') {
    return { ...base, correctAnswer: String(right), prompt: `${left} × ? = ${product}`, choices: factorChoices(right) };
  }
  if (kind === 'blankLeft') {
    return { ...base, correctAnswer: String(left), prompt: `? × ${right} = ${product}`, choices: factorChoices(left) };
  }
  return {
    ...base,
    kind: 'basic',
    correctAnswer: String(product),
    prompt: `${left} × ${right} = ?`,
    choices: buildChoices(String(product), productDistractorPool(left, right).map(String)),
  };
}

/**
 * 오답일 때 보여줄 힌트. "6씩 7번 모으면 몇 개일까요?" (명세 19)
 */
export function hintFor(question: MathQuestion): string {
  if (question.set !== 'mul') return setHint(question);
  const { left, right, kind } = question;
  if (kind === 'basic') {
    return `${left}씩 ${right}번 모으면 몇 개일까요?`;
  }
  if (kind === 'blankRight') {
    return `${left}씩 몇 번 모으면 ${iga(question.product)} 될까요?`;
  }
  return `몇씩 ${right}번 모으면 ${iga(question.product)} 될까요?`;
}
