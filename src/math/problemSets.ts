/**
 * 곱셈구구 말고 고를 수 있는 문제 묶음: 문제 범위 · 선택지(헷갈리기 쉬운 오답) · 힌트.
 *
 *  - div1  한 자리 ÷ 한 자리, 나누어떨어지는 것 (÷1 과 같은 수 나누기 포함, 23문제)
 *  - div2  두 자리 ÷ 한 자리, 나누어떨어지는 것 (나누는 수 2~9, 몫이 10을 넘기도 한다)
 *  - div2r 두 자리 ÷ 한 자리, 나머지가 있는 것 (답은 "몫 … 나머지", 몫이 한 자리 수인 문제를 70%)
 *  - sub   받아내림이 있는 두 자리 − 한 자리 (일의 자리끼리 뺄 수 없는 것만)
 */
import { REMAINDER_ONE_DIGIT_RATIO } from '@/config/balance';
import type { ProblemSet } from '@/config/curriculum';
import type { MathOp, MathQuestion } from '@/types/learning';
import { buildChoices } from './distractors';

export interface SetCandidate {
  key: string;
  left: number;
  right: number;
}

const OP: Record<ProblemSet, MathOp> = { div1: 'div', div2: 'div', div2r: 'div', sub: 'sub' };

export function setOp(set: ProblemSet): MathOp {
  return OP[set];
}

function keyOf(op: MathOp, left: number, right: number): string {
  return op === 'div' ? `${left}/${right}` : `${left}-${right}`;
}

const pools = new Map<ProblemSet, SetCandidate[]>();

/** 묶음의 모든 문제 (한 번 만들어 두고 쓴다) */
export function setPool(set: ProblemSet): SetCandidate[] {
  const cached = pools.get(set);
  if (cached) return cached;
  const list: SetCandidate[] = [];
  const add = (left: number, right: number) => list.push({ key: keyOf(OP[set], left, right), left, right });
  if (set === 'div1') {
    for (let divisor = 1; divisor <= 9; divisor += 1)
      for (let dividend = divisor; dividend <= 9; dividend += divisor) add(dividend, divisor);
  } else if (set === 'div2' || set === 'div2r') {
    for (let divisor = 2; divisor <= 9; divisor += 1)
      for (let dividend = 10; dividend <= 99; dividend += 1) {
        const exact = dividend % divisor === 0;
        if (exact === (set === 'div2')) add(dividend, divisor);
      }
  } else {
    for (let minuend = 10; minuend <= 99; minuend += 1)
      for (let subtrahend = (minuend % 10) + 1; subtrahend <= 9; subtrahend += 1) add(minuend, subtrahend);
  }
  pools.set(set, list);
  return list;
}

const subPools = new Map<ProblemSet, SetCandidate[][]>();

/**
 * 이번 문제를 고를 범위. 보통은 묶음 전체.
 * 나머지가 있는 나눗셈은 몫이 한 자리 수인 문제를 70%, 두 자리 수인 문제를 30% 낸다.
 */
export function drawPool(set: ProblemSet): SetCandidate[] {
  if (set !== 'div2r') return setPool(set);
  let split = subPools.get(set);
  if (!split) {
    const all = setPool(set);
    split = [
      all.filter((c) => Math.floor(c.left / c.right) < 10),
      all.filter((c) => Math.floor(c.left / c.right) >= 10),
    ];
    subPools.set(set, split);
  }
  return Math.random() < REMAINDER_ONE_DIGIT_RATIO ? split[0] : split[1];
}

const remainderText =(q: number, r: number) => `${q} … ${r}`;

/** 오답 후보: 정답에 가까운 것 · 실제로 자주 하는 실수부터 */
function numberPool(answer: number, candidates: number[]): string[] {
  const seen = new Set<number>([answer]);
  const kept: number[] = [];
  for (const value of candidates) {
    if (value < 0 || seen.has(value)) continue;
    seen.add(value);
    kept.push(value);
  }
  return kept.map(String);
}

let seq = 0;

export function buildSetQuestion(set: ProblemSet, left: number, right: number): MathQuestion {
  seq += 1;
  const op = OP[set];
  const key = keyOf(op, left, right);
  const base = { id: `s${seq}_${key}`, key, set, op, left, right, product: 0, table: 0, kind: 'basic' as const };

  if (set === 'sub') {
    const answer = left - right;
    const ones = left % 10;
    // 받아내림을 잊은 실수: 큰 수에서 작은 수를 뺌 (43 − 7 → 44), 십의 자리를 안 줄임 (43 − 7 → 46)
    const noBorrow = Math.floor(left / 10) * 10 + (right - ones);
    const pool = numberPool(answer, [noBorrow, answer + 10, answer + 1, answer - 1, answer - 10, answer + 2, answer - 2]);
    return {
      ...base,
      correctAnswer: String(answer),
      prompt: `${left} − ${right} = ?`,
      solved: `${left} − ${right} = ${answer}`,
      choices: buildChoices(String(answer), pool),
    };
  }

  const quotient = Math.floor(left / right);
  if (set === 'div2r') {
    const remainder = left % right;
    const answer = remainderText(quotient, remainder);
    const wrong: string[] = [];
    // 나머지가 나누는 수보다 큰 실수 (45 ÷ 6 → 6 … 9), 몫을 하나 크게/작게, 나머지를 하나 다르게
    if (quotient >= 1) wrong.push(remainderText(quotient - 1, remainder + right));
    if (remainder + 1 < right) wrong.push(remainderText(quotient, remainder + 1));
    if (remainder - 1 >= 1) wrong.push(remainderText(quotient, remainder - 1));
    wrong.push(remainderText(quotient + 1, remainder));
    if (quotient >= 2) wrong.push(remainderText(quotient - 1, remainder));
    wrong.push(remainderText(quotient, right - remainder));
    return {
      ...base,
      correctAnswer: answer,
      prompt: `${left} ÷ ${right} = ?`,
      solved: `${left} ÷ ${right} = ${answer}`,
      choices: buildChoices(answer, wrong.filter((w, i) => w !== answer && wrong.indexOf(w) === i)),
    };
  }

  // 나누어떨어지는 나눗셈: 몫 근처, 나누는 수 · 십의 자리를 헷갈린 수
  const pool = numberPool(quotient, [
    quotient + 1,
    quotient - 1,
    quotient + 2,
    quotient - 2,
    ...(quotient >= 10 ? [quotient + 10, quotient - 10] : [right]),
    quotient + 3,
  ]).filter((v) => v !== '0');
  return {
    ...base,
    correctAnswer: String(quotient),
    prompt: `${left} ÷ ${right} = ?`,
    solved: `${left} ÷ ${right} = ${quotient}`,
    choices: buildChoices(String(quotient), pool),
  };
}

/** 받침이 있는 수 읽기인지 (일 · 삼 · 육 · 칠 · 팔 · 십 …) — 조사 을/를, 이/가 고르기 */
export function hasFinal(n: number): boolean {
  const last = n % 10;
  if (last === 0) return n !== 0; // 십 · 이십 · 백 …
  return [1, 3, 6, 7, 8].includes(last);
}
const eul = (n: number) => `${n}${hasFinal(n) ? '을' : '를'}`;
export const iga = (n: number) => `${n}${hasFinal(n) ? '이' : '가'}`;

/** 오답일 때 보여 줄 힌트 */
export function setHint(question: MathQuestion): string {
  const { left, right } = question;
  if (question.op === 'sub') {
    const ones = left % 10;
    return `일의 자리 ${ones}에서 ${eul(right)} 뺄 수 없으니 십의 자리에서 10을 받아내려요 (${10 + ones} − ${right})`;
  }
  if (question.set === 'div2r') {
    return `${right}단에서 ${left}보다 크지 않은 가장 큰 수를 찾고, 남는 수를 세어 봐요`;
  }
  if (Math.floor(left / right) >= 10) {
    return `${right} × 10 = ${right * 10}부터 생각해 봐요. ${right} × ? = ${left}`;
  }
  return `${right} × ? = ${iga(left)} 되는 수를 떠올려 봐요`;
}
