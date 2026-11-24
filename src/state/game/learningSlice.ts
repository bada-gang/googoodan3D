/** 학습 기록: 문제별 · 단별 · 묶음별 정답률, 오답 복습 줄, 최근에 낸 문제. */
import { RECENT_MEMORY, WRONG_REVIEW_MAX_GAP } from '@/config/balance';
import type { LearningStats, MathQuestion } from '@/types/learning';
import { createEmptyLearningStats } from '@/types/learning';
import type { GameSlice } from './types';

export interface LearningSlice {
  stats: LearningStats;
  /** 최근 출제된 문제 키 (앞이 최신) */
  recentQuestions: string[];
  /** 문제를 푼 횟수 — 오답 복습 간격 계산용 */
  questionCounter: number;

  recordAttempt: (question: MathQuestion, isCorrect: boolean) => void;
  noteQuestionAsked: (question: MathQuestion) => void;
}

export const createLearningSlice: GameSlice<LearningSlice> = (set, get) => ({
  stats: createEmptyLearningStats(),
  recentQuestions: [],
  questionCounter: 0,

  noteQuestionAsked: (question) =>
    set((s) => ({
      recentQuestions: [question.key, ...s.recentQuestions].slice(
        0,
        RECENT_MEMORY * 2,
      ),
      questionCounter: s.questionCounter + 1,
    })),

  recordAttempt: (question, isCorrect) => {
    const profile = get().profile;
    if (!profile) return;
    const key = question.key;
    const now = new Date().toISOString();

    set((s) => {
      const stats = s.stats;
      const prev = stats.byProblem[key] ?? {
        key,
        left: question.left,
        right: question.right,
        op: question.op,
        attempts: 0,
        correct: 0,
        streak: 0,
        lastAttemptedAt: null,
      };
      const record = {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (isCorrect ? 1 : 0),
        streak: isCorrect ? prev.streak + 1 : 0,
        lastAttemptedAt: now,
      };

      const bump = (row: { attempts: number; correct: number } | undefined) => ({
        attempts: (row?.attempts ?? 0) + 1,
        correct: (row?.correct ?? 0) + (isCorrect ? 1 : 0),
      });
      const wrongQueue = isCorrect
        ? stats.wrongQueue.filter((k) => k !== key)
        : [key, ...stats.wrongQueue.filter((k) => k !== key)].slice(0, WRONG_REVIEW_MAX_GAP);

      return {
        stats: {
          totalAttempts: stats.totalAttempts + 1,
          totalCorrect: stats.totalCorrect + (isCorrect ? 1 : 0),
          totalWrong: stats.totalWrong + (isCorrect ? 0 : 1),
          // 곱셈구구는 단별로, 나머지 묶음은 묶음별로 모은다
          byTable:
            question.set === 'mul'
              ? { ...stats.byTable, [question.table]: bump(stats.byTable[question.table]) }
              : stats.byTable,
          bySet:
            question.set === 'mul'
              ? (stats.bySet ?? {})
              : { ...(stats.bySet ?? {}), [question.set]: bump(stats.bySet?.[question.set]) },
          byProblem: { ...stats.byProblem, [key]: record },
          wrongQueue,
        },
      };
    });
  },
});
