/**
 * 문제 출제기 점검 (개발용): 묶음마다 문제를 많이 만들어 정답 · 선택지가 맞는지 보고, 유형별 출현 비율을 센다.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/check-questions.ts
 */
import { PROBLEM_SETS, type ProblemSet } from '@/config/curriculum';
import { generateQuestion } from '@/math/questionGenerator';
import { setPool } from '@/math/problemSets';
import { createEmptyLearningStats, type MathQuestion } from '@/types/learning';

function check(q: MathQuestion): string | null {
  const { left: a, right: b } = q;
  let expected: string;
  if (q.op === 'mul') {
    expected = q.kind === 'basic' ? String(a * b) : q.kind === 'blankRight' ? String(b) : String(a);
  } else if (q.op === 'sub') {
    if (a % 10 >= b) return `받아내림 없음 ${q.prompt}`;
    expected = String(a - b);
  } else if (q.set === 'div2r') {
    if (a % b === 0) return `나누어떨어짐 ${q.prompt}`;
    expected = `${Math.floor(a / b)} … ${a % b}`;
  } else {
    if (a % b !== 0) return `안 나누어떨어짐 ${q.prompt}`;
    expected = String(a / b);
  }
  if (q.correctAnswer !== expected) return `정답 틀림 ${q.prompt} ${q.correctAnswer} ≠ ${expected}`;
  if (q.choices.length !== 4 || new Set(q.choices).size !== 4) return `선택지 ${q.prompt} ${q.choices.join(', ')}`;
  if (!q.choices.includes(q.correctAnswer)) return `정답 없음 ${q.prompt}`;
  if (q.choices.some((c) => c.startsWith('-'))) return `음수 ${q.prompt} ${q.choices.join(', ')}`;
  return null;
}

const N = 20000;
const stats = createEmptyLearningStats();
const errors: string[] = [];

for (const set of PROBLEM_SETS) console.log(`${set}: ${setPool(set).length}문제`);

const scenarios: { name: string; tables: number[]; sets: ProblemSet[] }[] = [
  { name: '곱셈만 (2~9단)', tables: [2, 3, 4, 5, 6, 7, 8, 9], sets: [] },
  { name: '곱셈 + 네 묶음', tables: [2, 3, 4, 5, 6, 7, 8, 9], sets: [...PROBLEM_SETS] },
  { name: '네 묶음만', tables: [], sets: [...PROBLEM_SETS] },
];
for (const sc of scenarios) {
  const count = new Map<string, number>();
  for (let i = 0; i < N; i += 1) {
    const q = generateQuestion({ tables: sc.tables, sets: sc.sets, stats, recent: [] });
    const err = check(q);
    if (err) errors.push(err);
    const kind = q.set === 'mul' ? `곱셈 ${q.kind}` : q.set;
    count.set(kind, (count.get(kind) ?? 0) + 1);
  }
  console.log(`\n${sc.name}`);
  for (const [kind, n] of [...count].sort()) console.log(`  ${kind}: ${((n / N) * 100).toFixed(1)}%`);
}

console.log('\n보기 예시');
for (const set of PROBLEM_SETS) {
  const q = generateQuestion({ tables: [], sets: [set], stats, recent: [] });
  console.log(`  ${set}: ${q.prompt}  →  [${q.choices.join(' | ')}]  정답 ${q.correctAnswer}`);
}
for (const kind of ['basic', 'blankRight', 'blankLeft'] as const) {
  const q = generateQuestion({ tables: [6], sets: [], stats, recent: [], forceKind: kind });
  console.log(`  곱셈 ${kind}: ${q.prompt}  →  [${q.choices.join(' | ')}]  정답 ${q.correctAnswer}`);
}

console.log(errors.length === 0 ? '\n문제 없음' : `\n오류 ${errors.length}개:\n${[...new Set(errors)].slice(0, 20).join('\n')}`);
